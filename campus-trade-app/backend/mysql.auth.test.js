import request from 'supertest'
import mysql from 'mysql2/promise'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createRepository } from './repository.js'

const testMysqlUrl = process.env.TEST_MYSQL_URL || ''

function buildDatabaseUrls(rawUrl) {
  const url = new URL(rawUrl)
  const databaseName = `campus_trade_auth_test_${Date.now()}`
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

describe('mysql auth integration', () => {
  it.skipIf(!testMysqlUrl)('bootstraps auth tables, migrates demo users, and supports register/login', async () => {
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
      const register = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: '数据库新同学', studentNo: '20268888', password: 'secret123' })

      expect(register.status).toBe(200)
      expect(register.body.data.studentNo).toBe('20268888')

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ account: '20268888', password: 'secret123' })

      expect(login.status).toBe(200)
      expect(login.body.data.name).toBe('数据库新同学')

      const connection = await mysql.createConnection({ uri: databaseUrl })
      try {
        const [tables] = await connection.query('SHOW TABLES')
        const [demoUsers] = await connection.query(`
          SELECT COUNT(*) AS count
          FROM ct_user
          WHERE role_type = 1
        `)
        const [createdUserRows] = await connection.query(`
          SELECT student_no, username, password_hash
          FROM ct_user
          WHERE student_no = '20268888'
          LIMIT 1
        `)

        expect(tables.map((row) => Object.values(row)[0])).toEqual(expect.arrayContaining(['app_state', 'ct_campus', 'ct_user']))
        expect(demoUsers[0].count).toBeGreaterThan(0)
        expect(createdUserRows[0].username).toBe('数据库新同学')
        expect(createdUserRows[0].password_hash).not.toBe('secret123')
        expect(createdUserRows[0].password_hash).toContain('scrypt$')
      } finally {
        await connection.end()
      }
    } finally {
      const cleanupConnection = await mysql.createConnection({ uri: rootUrl })
      await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await cleanupConnection.end()
    }
  })

  it.skipIf(!testMysqlUrl)('resets password with scrypt hash and blocks deleted users from logging in', async () => {
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

      const register = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'mysql_reset_user', studentNo: '20268881', password: 'secret123' })

      expect(register.status).toBe(200)

      const reset = await request(app)
        .post(`/api/v1/admin/users/${register.body.data.id}/password/reset`)
        .set('x-admin-account', encodeURIComponent('admin'))

      expect(reset.status).toBe(200)
      expect(reset.body.data.password).toBe('123456')

      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ account: '20268881', password: 'secret123' })

      expect(oldLogin.status).toBe(401)

      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ account: '20268881', password: '123456' })

      expect(newLogin.status).toBe(200)

      const deleted = await request(app)
        .delete(`/api/v1/admin/users/${register.body.data.id}`)
        .set('x-admin-account', encodeURIComponent('admin'))

      expect(deleted.status).toBe(200)

      const deletedLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ account: '20268881', password: '123456' })

      expect(deletedLogin.status).toBe(401)

      const connection = await mysql.createConnection({ uri: databaseUrl })
      try {
        const [rows] = await connection.query(`
          SELECT password_hash, deleted_at
          FROM ct_user
          WHERE student_no = '20268881'
          LIMIT 1
        `)

        expect(rows[0]).toBeTruthy()
        expect(rows[0].password_hash).toContain('scrypt$')
        expect(rows[0].deleted_at).toBeTruthy()
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
