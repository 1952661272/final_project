import request from 'supertest'
import mysql from 'mysql2/promise'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createRepository } from './repository.js'

const testMysqlUrl = process.env.TEST_MYSQL_URL || ''

function buildDatabaseUrls(rawUrl) {
  const url = new URL(rawUrl)
  const databaseName = `campus_trade_business_test_${Date.now()}`
  const rootUrl = new URL(rawUrl)
  rootUrl.pathname = '/'
  rootUrl.search = ''

  url.pathname = `/${databaseName}`
  url.search = ''

  return {
    databaseName,
    rootUrl: rootUrl.toString(),
    databaseUrl: url.toString()
  }
}

function encoded(value) {
  return encodeURIComponent(value)
}

describe('mysql business integration', () => {
  it.skipIf(!testMysqlUrl)('persists listing, order, logs and notifications in real mysql tables', async () => {
    const { databaseName, rootUrl, databaseUrl } = buildDatabaseUrls(testMysqlUrl)
    const adminConnection = await mysql.createConnection({ uri: rootUrl })

    await adminConnection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
    await adminConnection.query(`
      CREATE DATABASE \`${databaseName}\`
      DEFAULT CHARACTER SET utf8mb4
      COLLATE utf8mb4_0900_ai_ci
    `)
    await adminConnection.end()

    try {
      const repository = createRepository({
        dataFile: 'unused.json',
        mysqlUrl: databaseUrl,
        driver: 'mysql'
      })
      await repository.init()

      const app = createApp(repository)

      const sellerRegister = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'seller_alpha', studentNo: '20267771', password: 'secret123' })

      const buyerRegister = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'buyer_beta', studentNo: '20267772', password: 'secret123' })

      expect(sellerRegister.status).toBe(200)
      expect(buyerRegister.status).toBe(200)

      const created = await request(app)
        .post('/api/v1/listings')
        .set('x-user-name', encoded('seller_alpha'))
        .send({
          title: 'mysql_flow_listing',
          price: 188,
          category: '\u6570\u7801',
          campus: '\u5317\u6821\u533a',
          condition: 9,
          desc: 'mysql flow integration item',
          shipping: '\u5305\u90ae',
          method: '\u9762\u4ea4\u4f18\u5148',
          images: ['/assets/mysql-flow.jpg'],
          tags: ['mysql', 'flow']
        })

      expect(created.status).toBe(200)

      const reviewed = await request(app)
        .post(`/api/v1/admin/listings/${created.body.data.id}/review`)
        .set('x-admin-account', encoded('admin'))
        .send({ status: '\u4e0a\u67b6' })

      expect(reviewed.status).toBe(200)

      const ordered = await request(app)
        .post('/api/v1/orders')
        .set('x-user-name', encoded('buyer_beta'))
        .send({ listingId: created.body.data.id })

      expect(ordered.status).toBe(200)

      const confirmed = await request(app)
        .patch(`/api/v1/orders/${ordered.body.data.id}/status`)
        .set('x-user-name', encoded('seller_alpha'))
        .send({ status: '\u5df2\u786e\u8ba4' })

      expect(confirmed.status).toBe(200)

      const paid = await request(app)
        .post(`/api/v1/orders/${ordered.body.data.id}/pay`)
        .set('x-user-name', encoded('buyer_beta'))
        .send({ paymentMethod: 'wechat_pay' })

      expect(paid.status).toBe(200)

      const connection = await mysql.createConnection({ uri: databaseUrl })
      try {
        const [listingRows] = await connection.query(`
          SELECT listing_status, review_remark
          FROM ct_listing
          WHERE title = 'mysql_flow_listing'
          LIMIT 1
        `)
        const [orderRows] = await connection.query(`
          SELECT order_status, payment_status, payment_method
          FROM ct_order
          WHERE order_no = ?
          LIMIT 1
        `, [ordered.body.data.id])
        const [logRows] = await connection.query(`
          SELECT COUNT(*) AS count
          FROM ct_order_status_log l
          INNER JOIN ct_order o ON o.order_id = l.order_id
          WHERE o.order_no = ?
        `, [ordered.body.data.id])
        const [notificationRows] = await connection.query(`
          SELECT COUNT(*) AS count
          FROM ct_notification
          WHERE related_order_no = ?
        `, [ordered.body.data.id])

        expect(listingRows[0]).toBeTruthy()
        expect(orderRows[0]).toBeTruthy()
        expect(orderRows[0].payment_method).toBe('wechat_pay')
        expect(logRows[0].count).toBeGreaterThanOrEqual(3)
        expect(notificationRows[0].count).toBeGreaterThanOrEqual(3)

        await expect(
          connection.query("UPDATE ct_listing SET listing_status = 9 WHERE title = 'mysql_flow_listing'")
        ).rejects.toThrow()
        await expect(
          connection.query('UPDATE ct_order SET payment_status = 9 WHERE order_no = ?', [ordered.body.data.id])
        ).rejects.toThrow()
      } finally {
        await connection.end()
      }
    } finally {
      const cleanupConnection = await mysql.createConnection({ uri: rootUrl })
      await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await cleanupConnection.end()
    }
  })
})
