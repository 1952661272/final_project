import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

export class JsonStateStore {
  constructor (filePath) {
    this.filePath = filePath
  }

  async init () {
    await mkdir(dirname(this.filePath), { recursive: true })
  }

  async load () {
    if (!existsSync(this.filePath)) return null
    const raw = await readFile(this.filePath, 'utf-8')
    return JSON.parse(raw)
  }

  async save (state) {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8')
  }
}

export class MysqlStateStore {
  constructor (mysqlUrl) {
    this.mysqlUrl = mysqlUrl
    this.pool = null
  }

  async init () {
    if (!this.mysqlUrl) {
      throw new Error('MYSQL_URL is required for mysql state store')
    }

    let mysql
    try {
      mysql = await import('mysql2/promise')
    } catch (error) {
      throw new Error('mysql2 is required. Run: npm install mysql2')
    }

    this.pool = mysql.createPool(this.mysqlUrl)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TINYINT PRIMARY KEY,
        state_json LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  }

  async load () {
    const [rows] = await this.pool.query('SELECT state_json FROM app_state WHERE id = 1 LIMIT 1')
    if (!rows.length) return null
    return JSON.parse(rows[0].state_json)
  }

  async save (state) {
    const stateJson = JSON.stringify(state)
    await this.pool.query(
      `
      INSERT INTO app_state (id, state_json)
      VALUES (1, ?)
      ON DUPLICATE KEY UPDATE
        state_json = VALUES(state_json)
      `,
      [stateJson]
    )
  }
}

