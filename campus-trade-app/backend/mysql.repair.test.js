import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { describe, expect, it } from 'vitest'
import { createRepository } from './repository.js'

const execFileAsync = promisify(execFile)
const testMysqlUrl = process.env.TEST_MYSQL_URL || ''

function buildDatabaseUrls(rawUrl) {
  const url = new URL(rawUrl)
  const databaseName = `campus_trade_repair_test_${Date.now()}`
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

describe('mysql repair script', () => {
  it.skipIf(!testMysqlUrl)('supports dry-run and apply for dirty records cleanup', async () => {
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

      const connection = await mysql.createConnection({ uri: databaseUrl })
      try {
        await connection.query(
          `
          INSERT INTO ct_user (user_code, student_no, username, password_hash, role_type, user_status, verified_status, credit_score, reg_at)
          VALUES ('U9998', '202699981', 'dbseller_9998', 'scrypt$dummy', 1, 1, 0, 5.00, CURRENT_TIMESTAMP)
          `
        )
        const [userRows] = await connection.query(
          `SELECT user_id FROM ct_user WHERE username = 'dbseller_9998' LIMIT 1`
        )
        const dirtyUserId = userRows[0].user_id

        await connection.query(
          `
          INSERT INTO ct_listing (
            listing_code, seller_id, category_id, campus_id, title, description, price, quality_score,
            shipping_type, trade_method, listing_status, view_count, favorite_count, created_at, updated_at
          )
          VALUES (
            'L9998', ?, 1, 1, 'broken???listing', 'dirty', 123, 8.8,
            1, 1, 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          `,
          [dirtyUserId]
        )
      } finally {
        await connection.end()
      }

      const nodePath = process.execPath
      const scriptPath = fileURLToPath(new URL('./scripts/repairMysqlData.js', import.meta.url))

      const dryRun = await execFileAsync(nodePath, [scriptPath], {
        cwd: process.cwd(),
        env: { ...process.env, MYSQL_URL: databaseUrl, FORCE_COLOR: '0' }
      })
      expect(String(dryRun.stdout)).toContain('mode=dry-run')
      expect(String(dryRun.stdout)).toContain('dirty_users')

      const apply = await execFileAsync(nodePath, [scriptPath, '--mode=apply'], {
        cwd: process.cwd(),
        env: { ...process.env, MYSQL_URL: databaseUrl, FORCE_COLOR: '0' }
      })
      expect(String(apply.stdout)).toContain('mode=apply')
      expect(String(apply.stdout)).toContain('backup run id')

      const verifyConnection = await mysql.createConnection({ uri: databaseUrl })
      try {
        const [remainingDirtyUsers] = await verifyConnection.query(
          `SELECT COUNT(*) AS count FROM ct_user WHERE username LIKE 'dbseller_%'`
        )
        const [remainingDirtyListings] = await verifyConnection.query(
          `SELECT COUNT(*) AS count FROM ct_listing WHERE title LIKE '%???%'`
        )
        const [backupRows] = await verifyConnection.query(
          `SELECT COUNT(*) AS count FROM ct_repair_backup`
        )

        expect(remainingDirtyUsers[0].count).toBe(0)
        expect(remainingDirtyListings[0].count).toBe(0)
        expect(backupRows[0].count).toBeGreaterThan(0)
      } finally {
        await verifyConnection.end()
      }
    } finally {
      const cleanupConnection = await mysql.createConnection({ uri: rootUrl })
      await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await cleanupConnection.end()
    }
  })
})
