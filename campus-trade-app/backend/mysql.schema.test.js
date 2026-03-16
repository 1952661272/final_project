import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { describe, expect, it } from 'vitest'

const mysqlUrl = process.env.TEST_MYSQL_URL || ''

describe('mysql schema smoke', () => {
  it.skipIf(!mysqlUrl)('executes schema_mysql.sql on a dedicated MySQL test instance', async () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/database/schema_mysql.sql'), 'utf-8')
    const connection = await mysql.createConnection({
      uri: mysqlUrl,
      multipleStatements: true
    })

    try {
      await connection.query(sql)
      const [tables] = await connection.query('SHOW TABLES FROM campus_trade')
      expect(Array.isArray(tables)).toBe(true)
      expect(tables.length).toBeGreaterThan(0)
    } finally {
      await connection.end()
    }
  })
})
