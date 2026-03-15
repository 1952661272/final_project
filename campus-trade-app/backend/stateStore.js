import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { hashPassword, verifyPassword } from './password.js'
import {
  LISTING_CODE_TO_STATUS,
  LISTING_STATUS,
  ORDER_CODE_TO_STATUS,
  PAYMENT_CODE_TO_STATUS,
  VERIFY_CODE_TO_STATUS,
  toListingStatusCode,
  toOrderStatusCode,
  toPaymentStatusCode,
  toVerifyStatusCode
} from './status.js'

const DEFAULT_CAMPUSES = [
  { code: 'north', name: '北校区' },
  { code: 'south', name: '南校区' },
  { code: 'east', name: '东校区' }
]

const DEFAULT_CATEGORIES = [
  { name: '数码', sortNo: 10 },
  { name: '教材', sortNo: 20 },
  { name: '生活用品', sortNo: 30 },
  { name: '交通工具', sortNo: 40 },
  { name: '租房', sortNo: 50 }
]

const MESSAGE_TYPE_TO_CODE = { text: 1, image: 2, system: 3 }
const MESSAGE_CODE_TO_TYPE = Object.fromEntries(Object.entries(MESSAGE_TYPE_TO_CODE).map(([k, v]) => [v, k]))

function normalizeDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function toSqlDateTime(value) {
  const date = normalizeDate(value)
  return date ? `${date} 00:00:00` : null
}

function escapeIdentifier(value) {
  return String(value || '').replace(/`/g, '``')
}

function toUserStatusCode(status) {
  return status === '禁用' ? 2 : 1
}

function toUserStatusLabel(code) {
  return Number(code) === 2 ? '禁用' : '正常'
}

function toVerifiedStatusCode(verified) {
  return verified ? 1 : 0
}

function toRoleType(role) {
  return role === 'admin' ? 2 : 1
}

function toRoleLabel(roleType) {
  return Number(roleType) === 2 ? 'admin' : 'student'
}

function toCampusCode(name) {
  return DEFAULT_CAMPUSES.find((campus) => campus.name === name)?.code || null
}

function shippingToCode(value) {
  if (String(value || '').includes('自提')) return 3
  return value === '包邮' ? 1 : 2
}

function shippingFromCode(value) {
  if (Number(value) === 1) return '包邮'
  if (Number(value) === 3) return '自提'
  return '不包邮'
}

function tradeMethodToCode(value) {
  const text = String(value || '')
  if (text.includes('面交') && text.includes('快递')) return 3
  if (text.includes('快递')) return 2
  return 1
}

function tradeMethodFromCode(value) {
  if (Number(value) === 2) return '快递'
  if (Number(value) === 3) return '面交+快递'
  return '面交优先'
}

function parseNumericSuffix(value, fallback = 1) {
  const matched = String(value || '').match(/(\d+)$/)
  return matched ? Number(matched[1]) : fallback
}

function nextFromCodes(items, getter, fallback = 1) {
  const max = (Array.isArray(items) ? items : []).reduce((current, item) => {
    return Math.max(current, parseNumericSuffix(getter(item), 0))
  }, 0)
  return Math.max(fallback, max + 1)
}

function buildAuthUser(row) {
  const code = row.user_code || (Number(row.role_type) === 2 ? `A${String(row.user_id).padStart(2, '0')}` : `U${String(row.user_id).padStart(2, '0')}`)
  return {
    userId: row.user_id,
    id: code,
    name: row.username,
    studentNo: row.student_no || '',
    status: toUserStatusLabel(row.user_status),
    campus: row.campus_name || '未设置校区',
    credit: Number(row.credit_score || 5),
    verified: Number(row.verified_status || 0) === 1,
    role: toRoleLabel(row.role_type),
    reg: normalizeDate(row.reg_at) || normalizeDate(new Date()),
    passwordHash: row.password_hash
  }
}

async function queryRows(executor, sql, params = []) {
  const [rows] = await executor.query(sql, params)
  return rows
}

export class JsonStateStore {
  constructor(filePath) {
    this.filePath = filePath
    this.persistOnInit = true
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true })
  }

  async load() {
    if (!existsSync(this.filePath)) return null
    const raw = await readFile(this.filePath, 'utf-8')
    return JSON.parse(raw)
  }

  async save(state) {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8')
  }
}

export class MysqlStateStore {
  constructor(mysqlUrl) {
    this.mysqlUrl = mysqlUrl
    this.mysql = null
    this.pool = null
    this.databaseName = ''
    this.campusCache = new Map()
    this.categoryCache = new Map()
    this.persistOnInit = true
  }

  async init() {
    if (!this.mysqlUrl) throw new Error('MYSQL_URL is required for mysql state store')

    let mysqlModule
    try {
      mysqlModule = await import('mysql2/promise')
    } catch {
      throw new Error('mysql2 is required. Run: npm install mysql2')
    }

    this.mysql = mysqlModule.default || mysqlModule
    await this.ensureDatabase()
    this.pool = this.mysql.createPool({ uri: this.mysqlUrl, multipleStatements: true })
    await this.ensureRuntimeTables()
    await this.seedCampuses()
    await this.seedCategories()
  }

  async load() {
    if (await this.hasBusinessState()) {
      this.persistOnInit = false
      return this.loadBusinessState()
    }
    this.persistOnInit = true
    const rows = await queryRows(this.pool, 'SELECT state_json FROM app_state WHERE id = 1 LIMIT 1')
    if (!rows.length) return null
    return JSON.parse(rows[0].state_json)
  }

  async save(state) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      await this.seedCampuses(connection)
      await this.seedCategories(connection)
      const userIdByCode = await this.syncUsers(connection, state.users)
      await this.clearBusinessTables(connection)
      await this.persistVerifyRequests(connection, state.verifyRequests, userIdByCode)
      await this.persistListings(connection, state.listings, userIdByCode)
      await this.persistFavorites(connection, state.favorites, userIdByCode)
      await this.persistOrders(connection, state.orders, state.orderLogs, userIdByCode)
      await this.persistConversations(connection, state.conversations, userIdByCode)
      await this.persistNotifications(connection, state.notifications, userIdByCode)
      await connection.query(
        'INSERT INTO app_state (id, state_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)',
        [JSON.stringify(state)]
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async ensureDatabase() {
    const url = new URL(this.mysqlUrl)
    this.databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'campus_trade'
    const rootUrl = new URL(this.mysqlUrl)
    rootUrl.pathname = '/'
    const connection = await this.mysql.createConnection({ uri: rootUrl.toString() })
    try {
      await connection.query(`
        CREATE DATABASE IF NOT EXISTS \`${escapeIdentifier(this.databaseName)}\`
        DEFAULT CHARACTER SET utf8mb4
        COLLATE utf8mb4_0900_ai_ci
      `)
    } finally {
      await connection.end()
    }
  }

  async ensureRuntimeTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_campus (
        campus_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        campus_code VARCHAR(32) NOT NULL,
        campus_name VARCHAR(64) NOT NULL,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_campus_code (campus_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_category (
        category_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        category_name VARCHAR(64) NOT NULL,
        sort_no INT NOT NULL DEFAULT 0,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_category_name (category_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_user (
        user_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_code VARCHAR(32) NULL,
        student_no VARCHAR(32) NULL,
        username VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(128) NULL,
        avatar_url VARCHAR(255) NULL,
        campus_id BIGINT UNSIGNED NULL,
        role_type TINYINT NOT NULL DEFAULT 1,
        user_status TINYINT NOT NULL DEFAULT 1,
        verified_status TINYINT NOT NULL DEFAULT 0,
        credit_score DECIMAL(3,2) NOT NULL DEFAULT 5.00,
        reg_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        CONSTRAINT fk_user_campus FOREIGN KEY (campus_id) REFERENCES ct_campus(campus_id),
        UNIQUE KEY uk_student_no (student_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_user', 'user_code', 'ALTER TABLE ct_user ADD COLUMN user_code VARCHAR(32) NULL AFTER user_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_user_verify (
        verify_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        verify_code VARCHAR(32) NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        real_name VARCHAR(64) NOT NULL,
        student_no VARCHAR(32) NOT NULL,
        verify_status TINYINT NOT NULL DEFAULT 0,
        reviewer_id BIGINT UNSIGNED NULL,
        reviewed_at DATETIME NULL,
        reject_reason VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_verify_user FOREIGN KEY (user_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_verify_reviewer FOREIGN KEY (reviewer_id) REFERENCES ct_user(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_user_verify', 'verify_code', 'ALTER TABLE ct_user_verify ADD COLUMN verify_code VARCHAR(32) NULL AFTER verify_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_listing (
        listing_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        listing_code VARCHAR(32) NULL,
        seller_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        campus_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(128) NOT NULL,
        description TEXT NULL,
        price DECIMAL(10,2) NOT NULL,
        quality_score DECIMAL(3,1) NOT NULL DEFAULT 9.0,
        shipping_type TINYINT NOT NULL DEFAULT 1,
        trade_method TINYINT NOT NULL DEFAULT 1,
        listing_status TINYINT NOT NULL DEFAULT 1,
        review_remark VARCHAR(255) NULL,
        view_count INT NOT NULL DEFAULT 0,
        favorite_count INT NOT NULL DEFAULT 0,
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        CONSTRAINT fk_listing_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_listing_category FOREIGN KEY (category_id) REFERENCES ct_category(category_id),
        CONSTRAINT fk_listing_campus FOREIGN KEY (campus_id) REFERENCES ct_campus(campus_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_listing', 'listing_code', 'ALTER TABLE ct_listing ADD COLUMN listing_code VARCHAR(32) NULL AFTER listing_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_listing_image (
        image_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        listing_id BIGINT UNSIGNED NOT NULL,
        image_url LONGTEXT NOT NULL,
        is_cover TINYINT NOT NULL DEFAULT 0,
        sort_no INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_listing_image_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumnType('ct_listing_image', 'image_url', 'longtext', 'ALTER TABLE ct_listing_image MODIFY COLUMN image_url LONGTEXT NOT NULL')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_listing_tag (
        tag_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        listing_id BIGINT UNSIGNED NOT NULL,
        tag_name VARCHAR(64) NOT NULL,
        sort_no INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_listing_tag_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
        UNIQUE KEY uk_listing_tag_name (listing_id, tag_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_listing_review (
        review_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        review_code VARCHAR(32) NULL,
        listing_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        review_result TINYINT NOT NULL,
        review_reason VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_listing_review_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
        CONSTRAINT fk_listing_review_user FOREIGN KEY (reviewer_id) REFERENCES ct_user(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_listing_review', 'review_code', 'ALTER TABLE ct_listing_review ADD COLUMN review_code VARCHAR(32) NULL AFTER review_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_favorite (
        favorite_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        listing_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_favorite_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
        UNIQUE KEY uk_favorite_user_listing (user_id, listing_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_order (
        order_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        order_no VARCHAR(40) NOT NULL,
        listing_id BIGINT UNSIGNED NOT NULL,
        buyer_id BIGINT UNSIGNED NOT NULL,
        seller_id BIGINT UNSIGNED NOT NULL,
        order_amount DECIMAL(10,2) NOT NULL,
        order_status TINYINT NOT NULL DEFAULT 0,
        trade_method TINYINT NOT NULL DEFAULT 1,
        trade_address VARCHAR(255) NULL,
        payment_status TINYINT NOT NULL DEFAULT 0,
        payment_method VARCHAR(64) NULL,
        payment_time DATETIME NULL,
        reject_reason VARCHAR(255) NULL,
        cancel_reason VARCHAR(255) NULL,
        finished_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_order_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
        CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
        UNIQUE KEY uk_order_no (order_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_order', 'payment_status', 'ALTER TABLE ct_order ADD COLUMN payment_status TINYINT NOT NULL DEFAULT 0 AFTER trade_address')
    await this.ensureColumn('ct_order', 'payment_method', 'ALTER TABLE ct_order ADD COLUMN payment_method VARCHAR(64) NULL AFTER payment_status')
    await this.ensureColumn('ct_order', 'payment_time', 'ALTER TABLE ct_order ADD COLUMN payment_time DATETIME NULL AFTER payment_method')
    await this.ensureColumn('ct_order', 'reject_reason', 'ALTER TABLE ct_order ADD COLUMN reject_reason VARCHAR(255) NULL AFTER payment_time')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_order_status_log (
        log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        log_code VARCHAR(32) NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        from_status TINYINT NULL,
        to_status TINYINT NOT NULL,
        operator_id BIGINT UNSIGNED NOT NULL,
        note VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_order_log_order FOREIGN KEY (order_id) REFERENCES ct_order(order_id),
        CONSTRAINT fk_order_log_operator FOREIGN KEY (operator_id) REFERENCES ct_user(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_order_status_log', 'log_code', 'ALTER TABLE ct_order_status_log ADD COLUMN log_code VARCHAR(32) NULL AFTER log_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_conversation (
        conversation_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        conversation_code VARCHAR(32) NULL,
        listing_id BIGINT UNSIGNED NOT NULL,
        buyer_id BIGINT UNSIGNED NOT NULL,
        seller_id BIGINT UNSIGNED NOT NULL,
        buyer_pinned TINYINT NOT NULL DEFAULT 0,
        seller_pinned TINYINT NOT NULL DEFAULT 0,
        last_message_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_conversation_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id),
        CONSTRAINT fk_conversation_buyer FOREIGN KEY (buyer_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_conversation_seller FOREIGN KEY (seller_id) REFERENCES ct_user(user_id),
        UNIQUE KEY uk_conversation_pair (listing_id, buyer_id, seller_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_conversation', 'conversation_code', 'ALTER TABLE ct_conversation ADD COLUMN conversation_code VARCHAR(32) NULL AFTER conversation_id')
    await this.ensureColumn('ct_conversation', 'buyer_pinned', 'ALTER TABLE ct_conversation ADD COLUMN buyer_pinned TINYINT NOT NULL DEFAULT 0 AFTER seller_id')
    await this.ensureColumn('ct_conversation', 'seller_pinned', 'ALTER TABLE ct_conversation ADD COLUMN seller_pinned TINYINT NOT NULL DEFAULT 0 AFTER buyer_pinned')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_message (
        message_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        message_code VARCHAR(32) NULL,
        conversation_id BIGINT UNSIGNED NOT NULL,
        sender_id BIGINT UNSIGNED NOT NULL,
        message_type TINYINT NOT NULL DEFAULT 1,
        message_body TEXT NOT NULL,
        read_status TINYINT NOT NULL DEFAULT 0,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES ct_conversation(conversation_id),
        CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES ct_user(user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
    await this.ensureColumn('ct_message', 'message_code', 'ALTER TABLE ct_message ADD COLUMN message_code VARCHAR(32) NULL AFTER message_id')

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ct_notification (
        notification_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        notification_code VARCHAR(32) NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        notification_type VARCHAR(32) NOT NULL DEFAULT 'system',
        title VARCHAR(128) NOT NULL,
        content TEXT NOT NULL,
        related_listing_id BIGINT UNSIGNED NULL,
        related_order_no VARCHAR(40) NULL,
        read_status TINYINT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES ct_user(user_id),
        CONSTRAINT fk_notification_listing FOREIGN KEY (related_listing_id) REFERENCES ct_listing(listing_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TINYINT PRIMARY KEY,
        state_json LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
  }

  async ensureColumn(tableName, columnName, alterStatement) {
    const rows = await queryRows(
      this.pool,
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
      `,
      [this.databaseName, tableName, columnName]
    )

    if (!rows.length) {
      await this.pool.query(alterStatement)
    }
  }

  async ensureColumnType(tableName, columnName, expectedType, alterStatement) {
    const rows = await queryRows(
      this.pool,
      `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
      `,
      [this.databaseName, tableName, columnName]
    )

    if (!rows.length) return

    const currentType = String(rows[0].data_type || '').toLowerCase()
    if (currentType !== String(expectedType || '').toLowerCase()) {
      await this.pool.query(alterStatement)
    }
  }

  async seedCampuses(executor = this.pool) {
    for (const campus of DEFAULT_CAMPUSES) {
      await executor.query(
        `
        INSERT INTO ct_campus (campus_code, campus_name, is_active)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
          campus_name = VALUES(campus_name),
          is_active = 1
        `,
        [campus.code, campus.name]
      )
    }

    const rows = await queryRows(executor, 'SELECT campus_id, campus_code, campus_name FROM ct_campus')
    this.campusCache = new Map()
    rows.forEach((row) => {
      this.campusCache.set(row.campus_code, row.campus_id)
      this.campusCache.set(row.campus_name, row.campus_id)
    })
  }

  async seedCategories(executor = this.pool) {
    for (const category of DEFAULT_CATEGORIES) {
      await executor.query(
        `
        INSERT INTO ct_category (category_name, sort_no, is_active)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
          sort_no = VALUES(sort_no),
          is_active = 1
        `,
        [category.name, category.sortNo]
      )
    }

    const rows = await queryRows(executor, 'SELECT category_id, category_name FROM ct_category')
    this.categoryCache = new Map()
    rows.forEach((row) => {
      this.categoryCache.set(row.category_name, row.category_id)
    })
  }

  async resolveCampusId(campusName, executor = this.pool) {
    if (!campusName) return null
    if (this.campusCache.size === 0) await this.seedCampuses(executor)
    const code = toCampusCode(campusName)
    return this.campusCache.get(campusName) || (code ? this.campusCache.get(code) : null) || null
  }

  async resolveCategoryId(categoryName, executor = this.pool) {
    if (!categoryName) return null
    if (this.categoryCache.size === 0) await this.seedCategories(executor)
    return this.categoryCache.get(categoryName) || null
  }

  async hasBusinessState() {
    const userRows = await queryRows(this.pool, 'SELECT COUNT(*) AS total FROM `ct_user`')
    return Number(userRows[0]?.total || 0) > 0
  }

  async findAuthUserByStudentNo(studentNo) {
    const keyword = String(studentNo || '').trim()
    if (!keyword) return null
    const rows = await queryRows(
      this.pool,
      `
      SELECT
        u.user_id, u.user_code, u.student_no, u.username, u.password_hash,
        u.role_type, u.user_status, u.verified_status, u.credit_score, u.reg_at,
        c.campus_name
      FROM ct_user u
      LEFT JOIN ct_campus c ON c.campus_id = u.campus_id
      WHERE u.student_no = ?
      LIMIT 1
      `,
      [keyword]
    )
    if (!rows.length) return null
    return buildAuthUser(rows[0])
  }

  async registerAuthUser({ username, studentNo, password }) {
    const actualStudentNo = String(studentNo || '').trim()
    const actualName = String(username || '').trim()
    const actualPassword = String(password || '').trim()
    const existing = await this.findAuthUserByStudentNo(actualStudentNo)
    if (existing) {
      const error = new Error('学号已注册')
      error.status = 409
      throw error
    }

    await this.pool.query(
      `
      INSERT INTO ct_user (
        user_code, student_no, username, password_hash, campus_id,
        role_type, user_status, verified_status, credit_score, reg_at
      )
      VALUES (?, ?, ?, ?, ?, 1, 1, 0, 5.00, CURRENT_TIMESTAMP)
      `,
      [null, actualStudentNo, actualName, hashPassword(actualPassword), null]
    )
    return this.findAuthUserByStudentNo(actualStudentNo)
  }

  async authenticateAuthUser(account, password) {
    const actualAccount = String(account || '').trim()
    const actualPassword = String(password || '').trim()
    const authUser = await this.findAuthUserByStudentNo(actualAccount)
    if (!authUser || !verifyPassword(actualPassword, authUser.passwordHash)) {
      const error = new Error('学号或密码错误')
      error.status = 401
      throw error
    }
    await this.pool.query('UPDATE ct_user SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?', [authUser.userId])
    return { ...authUser, passwordHash: undefined }
  }

  async seedAuthUsers(users) {
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      await this.seedCampuses(connection)
      await this.syncUsers(connection, users)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async syncUsers(connection, users) {
    const existingRows = await queryRows(connection, 'SELECT user_id, user_code, student_no, password_hash FROM ct_user')
    const existingByCode = new Map()
    const existingByStudentNo = new Map()
    existingRows.forEach((row) => {
      if (row.user_code) existingByCode.set(row.user_code, row)
      if (row.student_no) existingByStudentNo.set(row.student_no, row)
    })

    for (const user of Array.isArray(users) ? users : []) {
      const userCode = user.id || null
      const studentNo = user.studentNo || null
      const existing = (userCode && existingByCode.get(userCode)) || (studentNo && existingByStudentNo.get(studentNo)) || null
      const campusId = await this.resolveCampusId(user.campus, connection)
      const passwordHash = existing?.password_hash || hashPassword(user.password || '123456')

      if (existing) {
        await connection.query(
          `
          UPDATE ct_user
          SET user_code = ?, student_no = ?, username = ?, password_hash = ?, campus_id = ?,
              role_type = ?, user_status = ?, verified_status = ?, credit_score = ?, reg_at = COALESCE(?, reg_at)
          WHERE user_id = ?
          `,
          [
            userCode,
            studentNo,
            user.name,
            passwordHash,
            campusId,
            toRoleType(user.role),
            toUserStatusCode(user.status),
            toVerifiedStatusCode(user.verified),
            Number(user.credit) || 5,
            toSqlDateTime(user.reg),
            existing.user_id
          ]
        )
      } else {
        await connection.query(
          `
          INSERT INTO ct_user (
            user_code, student_no, username, password_hash, campus_id,
            role_type, user_status, verified_status, credit_score, reg_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            userCode,
            studentNo,
            user.name,
            passwordHash,
            campusId,
            toRoleType(user.role),
            toUserStatusCode(user.status),
            toVerifiedStatusCode(user.verified),
            Number(user.credit) || 5,
            toSqlDateTime(user.reg) || '2024-01-01 00:00:00'
          ]
        )
      }
    }

    const syncedRows = await queryRows(connection, 'SELECT user_id, user_code FROM ct_user')
    return new Map(syncedRows.filter((row) => row.user_code).map((row) => [row.user_code, row.user_id]))
  }

  async updateAuthUserStatus(studentNo, status) {
    const actualStudentNo = String(studentNo || '').trim()
    if (!actualStudentNo) return
    await this.pool.query('UPDATE ct_user SET user_status = ? WHERE student_no = ?', [toUserStatusCode(status), actualStudentNo])
  }

  async updateAuthUserVerification(studentNo, verified) {
    const actualStudentNo = String(studentNo || '').trim()
    if (!actualStudentNo) return
    await this.pool.query('UPDATE ct_user SET verified_status = ? WHERE student_no = ?', [toVerifiedStatusCode(verified), actualStudentNo])
  }

  async clearBusinessTables(connection) {
    for (const table of [
      'ct_notification',
      'ct_message',
      'ct_conversation',
      'ct_order_status_log',
      'ct_order',
      'ct_favorite',
      'ct_listing_review',
      'ct_listing_tag',
      'ct_listing_image',
      'ct_listing',
      'ct_user_verify'
    ]) {
      await connection.query(`DELETE FROM \`${escapeIdentifier(table)}\``)
    }
  }

  async persistVerifyRequests(connection, verifyRequests, userIdByCode) {
    for (const request of Array.isArray(verifyRequests) ? verifyRequests : []) {
      await connection.query(
        `
        INSERT INTO ct_user_verify (
          verify_code, user_id, real_name, student_no, verify_status,
          reviewer_id, reviewed_at, reject_reason, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          request.id || null,
          userIdByCode.get(request.userId),
          request.realName,
          request.studentNo,
          toVerifyStatusCode(request.verifyStatus),
          request.reviewerId ? userIdByCode.get(request.reviewerId) : null,
          toSqlDateTime(request.reviewedAt),
          request.rejectReason || null,
          toSqlDateTime(request.createdAt) || '2026-01-01 00:00:00'
        ]
      )
    }
  }

  async persistListings(connection, listings, userIdByCode) {
    for (const listing of Array.isArray(listings) ? listings : []) {
      const listingId = Number(listing.numericId || parseNumericSuffix(listing.id, 0))
      const categoryId = (await this.resolveCategoryId(listing.category, connection)) || (await this.resolveCategoryId('数码', connection))
      const campusId = (await this.resolveCampusId(listing.campus, connection)) || (await this.resolveCampusId('北校区', connection))
      await connection.query(
        `
        INSERT INTO ct_listing (
          listing_id, listing_code, seller_id, category_id, campus_id,
          title, description, price, quality_score, shipping_type, trade_method,
          listing_status, review_remark, view_count, favorite_count,
          published_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          listingId,
          listing.id || `L${listingId}`,
          userIdByCode.get(listing.sellerId),
          categoryId,
          campusId,
          listing.title,
          listing.desc || '',
          Number(listing.price) || 0,
          Number(listing.condition) || 9,
          shippingToCode(listing.shipping),
          tradeMethodToCode(listing.method),
          toListingStatusCode(listing.status),
          listing.reviewRemark || null,
          Number(listing.views) || 0,
          Number(listing.likes) || 0,
          toListingStatusCode(listing.status) === toListingStatusCode(LISTING_STATUS.PUBLISHED)
            ? (toSqlDateTime(listing.updatedAt) || toSqlDateTime(listing.createdAt))
            : null,
          toSqlDateTime(listing.createdAt) || '2026-01-01 00:00:00',
          toSqlDateTime(listing.updatedAt) || toSqlDateTime(listing.createdAt) || '2026-01-01 00:00:00'
        ]
      )

      for (const [index, imageUrl] of (Array.isArray(listing.images) ? listing.images : []).entries()) {
        await connection.query('INSERT INTO ct_listing_image (listing_id, image_url, is_cover, sort_no) VALUES (?, ?, ?, ?)', [listingId, imageUrl, index === 0 ? 1 : 0, index])
      }

      for (const [index, tag] of (Array.isArray(listing.tags) ? listing.tags : []).entries()) {
        await connection.query('INSERT INTO ct_listing_tag (listing_id, tag_name, sort_no) VALUES (?, ?, ?)', [listingId, tag, index])
      }
    }
  }

  async persistFavorites(connection, favorites, userIdByCode) {
    for (const favorite of Array.isArray(favorites) ? favorites : []) {
      const listingId = parseNumericSuffix(favorite.listingId, 0)
      const userId = userIdByCode.get(favorite.userId)
      if (!listingId || !userId) continue
      await connection.query('INSERT INTO ct_favorite (user_id, listing_id) VALUES (?, ?)', [userId, listingId])
    }
  }

  async persistOrders(connection, orders, orderLogs, userIdByCode) {
    for (const order of Array.isArray(orders) ? orders : []) {
      await connection.query(
        `
        INSERT INTO ct_order (
          order_no, listing_id, buyer_id, seller_id, order_amount,
          order_status, trade_method, trade_address, payment_status,
          payment_method, payment_time, reject_reason, cancel_reason,
          finished_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          order.id,
          parseNumericSuffix(order.listingId, 0),
          userIdByCode.get(order.buyerId),
          userIdByCode.get(order.sellerId),
          Number(order.price) || 0,
          toOrderStatusCode(order.status),
          tradeMethodToCode(order.method),
          order.address || null,
          toPaymentStatusCode(order.paymentStatus || '未支付', order.status),
          order.paymentMethod || null,
          toSqlDateTime(order.paymentTime),
          order.rejectReason || null,
          order.cancelReason || null,
          order.status === '已完成' ? (toSqlDateTime(order.updatedAt) || toSqlDateTime(order.createdAt)) : null,
          toSqlDateTime(order.createdAt) || '2026-01-01 00:00:00',
          toSqlDateTime(order.updatedAt) || toSqlDateTime(order.createdAt) || '2026-01-01 00:00:00'
        ]
      )
    }

    const insertedOrders = await queryRows(connection, 'SELECT order_id, order_no FROM ct_order')
    const orderIdByCode = new Map(insertedOrders.map((row) => [row.order_no, row.order_id]))

    for (const log of Array.isArray(orderLogs) ? orderLogs : []) {
      const orderId = orderIdByCode.get(log.orderId)
      if (!orderId) continue
      await connection.query(
        `
        INSERT INTO ct_order_status_log (log_code, order_id, from_status, to_status, operator_id, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          log.id || null,
          orderId,
          log.fromStatus ? toOrderStatusCode(log.fromStatus) : null,
          toOrderStatusCode(log.toStatus),
          userIdByCode.get(log.operatorId),
          log.note || null,
          toSqlDateTime(log.createdAt) || '2026-01-01 00:00:00'
        ]
      )
    }
  }

  async persistConversations(connection, conversations, userIdByCode) {
    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      await connection.query(
        `
        INSERT INTO ct_conversation (
          conversation_code, listing_id, buyer_id, seller_id,
          buyer_pinned, seller_pinned, last_message_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          conversation.id,
          parseNumericSuffix(conversation.listingId, 0),
          userIdByCode.get(conversation.buyerId),
          userIdByCode.get(conversation.sellerId),
          Number(conversation.buyerPinned) || 0,
          Number(conversation.sellerPinned) || 0,
          toSqlDateTime(conversation.updatedAt),
          toSqlDateTime(conversation.createdAt || conversation.updatedAt) || '2026-01-01 00:00:00',
          toSqlDateTime(conversation.updatedAt) || '2026-01-01 00:00:00'
        ]
      )
    }

    const insertedConversations = await queryRows(connection, 'SELECT conversation_id, conversation_code FROM ct_conversation')
    const conversationIdByCode = new Map(insertedConversations.map((row) => [row.conversation_code || String(row.conversation_id), row.conversation_id]))

    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const conversationId = conversationIdByCode.get(conversation.id)
      if (!conversationId) continue
      for (const message of Array.isArray(conversation.messages) ? conversation.messages : []) {
        await connection.query(
          `
          INSERT INTO ct_message (
            message_code, conversation_id, sender_id, message_type, message_body, read_status, sent_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            message.id || null,
            conversationId,
            userIdByCode.get(message.senderId),
            MESSAGE_TYPE_TO_CODE[message.messageType || 'text'] ?? 1,
            message.text || '',
            message.read ? 1 : 0,
            toSqlDateTime(message.sentAt || conversation.updatedAt) || '2026-01-01 00:00:00'
          ]
        )
      }
    }
  }

  async persistNotifications(connection, notifications, userIdByCode) {
    for (const notification of Array.isArray(notifications) ? notifications : []) {
      const userId = userIdByCode.get(notification.userId)
      if (!userId) continue
      await connection.query(
        `
        INSERT INTO ct_notification (
          notification_code, user_id, notification_type, title, content,
          related_listing_id, related_order_no, read_status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          notification.id || null,
          userId,
          notification.type || 'system',
          notification.title,
          notification.content,
          notification.relatedListingId ? Number(notification.relatedListingId) : null,
          notification.relatedOrderId || null,
          notification.read ? 1 : 0,
          toSqlDateTime(notification.createdAt) || '2026-01-01 00:00:00'
        ]
      )
    }
  }

  async loadBusinessState() {
    await this.seedCampuses()
    await this.seedCategories()

    const userRows = await queryRows(
      this.pool,
      `
      SELECT
        u.user_id, u.user_code, u.student_no, u.username, u.password_hash,
        u.role_type, u.user_status, u.verified_status, u.credit_score, u.reg_at,
        c.campus_name
      FROM ct_user u
      LEFT JOIN ct_campus c ON c.campus_id = u.campus_id
      ORDER BY u.user_id
      `
    )
    const users = userRows.map((row) => ({
      id: row.user_code || (Number(row.role_type) === 2 ? `A${String(row.user_id).padStart(2, '0')}` : `U${String(row.user_id).padStart(2, '0')}`),
      name: row.username,
      account: Number(row.role_type) === 2 ? 'admin' : (row.student_no || row.username),
      password: Number(row.role_type) === 2 ? '123456' : '',
      status: toUserStatusLabel(row.user_status),
      campus: row.campus_name || '未设置校区',
      credit: Number(row.credit_score || 5),
      verified: Number(row.verified_status || 0) === 1,
      reg: normalizeDate(row.reg_at) || '2026-01-01',
      role: toRoleLabel(row.role_type),
      studentNo: row.student_no || ''
    }))
    const userCodeByDbId = new Map(userRows.map((row) => [
      row.user_id,
      row.user_code || (Number(row.role_type) === 2 ? `A${String(row.user_id).padStart(2, '0')}` : `U${String(row.user_id).padStart(2, '0')}`)
    ]))

    const listingRows = await queryRows(
      this.pool,
      `
      SELECT
        l.listing_id, l.listing_code, l.seller_id, l.title, l.description, l.price,
        l.quality_score, l.shipping_type, l.trade_method, l.listing_status,
        l.review_remark, l.view_count, l.favorite_count, l.created_at, l.updated_at,
        c.category_name, cp.campus_name
      FROM ct_listing l
      LEFT JOIN ct_category c ON c.category_id = l.category_id
      LEFT JOIN ct_campus cp ON cp.campus_id = l.campus_id
      ORDER BY l.listing_id
      `
    )
    const listingImages = await queryRows(this.pool, 'SELECT listing_id, image_url, sort_no FROM ct_listing_image ORDER BY listing_id, sort_no')
    const listingTags = await queryRows(this.pool, 'SELECT listing_id, tag_name, sort_no FROM ct_listing_tag ORDER BY listing_id, sort_no')
    const imagesByListingId = new Map()
    listingImages.forEach((row) => {
      if (!imagesByListingId.has(row.listing_id)) imagesByListingId.set(row.listing_id, [])
      imagesByListingId.get(row.listing_id).push(row.image_url)
    })
    const tagsByListingId = new Map()
    listingTags.forEach((row) => {
      if (!tagsByListingId.has(row.listing_id)) tagsByListingId.set(row.listing_id, [])
      tagsByListingId.get(row.listing_id).push(row.tag_name)
    })
    const listings = listingRows.map((row) => ({
      id: row.listing_code || `L${row.listing_id}`,
      numericId: Number(row.listing_id),
      sellerId: userCodeByDbId.get(row.seller_id),
      title: row.title,
      price: Number(row.price) || 0,
      campus: row.campus_name || '北校区',
      condition: Number(row.quality_score) || 9,
      category: row.category_name || '数码',
      createdAt: normalizeDate(row.created_at) || '2026-01-01',
      updatedAt: normalizeDate(row.updated_at) || normalizeDate(row.created_at) || '2026-01-01',
      desc: row.description || '',
      tags: tagsByListingId.get(row.listing_id) || [],
      shipping: shippingFromCode(row.shipping_type),
      method: tradeMethodFromCode(row.trade_method),
      views: Number(row.view_count) || 0,
      likes: Number(row.favorite_count) || 0,
      status: LISTING_CODE_TO_STATUS[Number(row.listing_status)] || '待审核',
      images: imagesByListingId.get(row.listing_id) || [],
      reviewRemark: row.review_remark || null
    }))

    const favoriteRows = await queryRows(this.pool, 'SELECT user_id, listing_id FROM ct_favorite ORDER BY favorite_id')
    const favorites = favoriteRows.map((row) => ({ userId: userCodeByDbId.get(row.user_id), listingId: `L${row.listing_id}` }))

    const orderRows = await queryRows(
      this.pool,
      `
      SELECT
        order_id, order_no, listing_id, buyer_id, seller_id, order_amount,
        order_status, trade_method, trade_address, payment_status, payment_method,
        payment_time, reject_reason, cancel_reason, finished_at, created_at, updated_at
      FROM ct_order
      ORDER BY order_id
      `
    )
    const orders = orderRows.map((row) => ({
      id: row.order_no,
      listingId: `L${row.listing_id}`,
      buyerId: userCodeByDbId.get(row.buyer_id),
      sellerId: userCodeByDbId.get(row.seller_id),
      price: Number(row.order_amount) || 0,
      status: ORDER_CODE_TO_STATUS[Number(row.order_status)] || '待确认',
      createdAt: normalizeDate(row.created_at) || '2026-01-01',
      updatedAt: normalizeDate(row.updated_at) || normalizeDate(row.created_at) || '2026-01-01',
      method: tradeMethodFromCode(row.trade_method),
      address: row.trade_address || '',
      paymentStatus: PAYMENT_CODE_TO_STATUS[Number(row.payment_status)] || '未支付',
      paymentMethod: row.payment_method || '',
      paymentTime: normalizeDate(row.payment_time),
      rejectReason: row.reject_reason || null,
      cancelReason: row.cancel_reason || null
    }))

    const orderLogRows = await queryRows(
      this.pool,
      `
      SELECT l.log_id, l.log_code, o.order_no, l.from_status, l.to_status, l.operator_id, l.note, l.created_at
      FROM ct_order_status_log l
      INNER JOIN ct_order o ON o.order_id = l.order_id
      ORDER BY l.log_id
      `
    )
    const orderLogs = orderLogRows.map((row) => ({
      id: row.log_code || `OL${row.log_id}`,
      orderId: row.order_no,
      fromStatus: row.from_status === null || row.from_status === undefined ? null : (ORDER_CODE_TO_STATUS[Number(row.from_status)] || null),
      toStatus: ORDER_CODE_TO_STATUS[Number(row.to_status)] || '待确认',
      operatorId: userCodeByDbId.get(row.operator_id),
      note: row.note || '',
      createdAt: normalizeDate(row.created_at) || '2026-01-01'
    }))

    const conversationRows = await queryRows(
      this.pool,
      `
      SELECT
        conversation_id, conversation_code, listing_id, buyer_id, seller_id,
        buyer_pinned, seller_pinned, created_at, updated_at, last_message_at
      FROM ct_conversation
      ORDER BY conversation_id
      `
    )
    const messageRows = await queryRows(
      this.pool,
      `
      SELECT
        message_id, message_code, conversation_id, sender_id, message_type,
        message_body, read_status, sent_at
      FROM ct_message
      ORDER BY conversation_id, message_id
      `
    )
    const messagesByConversationId = new Map()
    messageRows.forEach((row) => {
      if (!messagesByConversationId.has(row.conversation_id)) messagesByConversationId.set(row.conversation_id, [])
      messagesByConversationId.get(row.conversation_id).push({
        id: row.message_code || `M${row.message_id}`,
        senderId: userCodeByDbId.get(row.sender_id),
        text: row.message_body,
        read: Number(row.read_status || 0) === 1,
        sentAt: normalizeDate(row.sent_at) || '2026-01-01',
        messageType: MESSAGE_CODE_TO_TYPE[Number(row.message_type)] || 'text'
      })
    })
    const conversations = conversationRows.map((row) => ({
      id: row.conversation_code || `C${row.conversation_id}`,
      listingId: `L${row.listing_id}`,
      buyerId: userCodeByDbId.get(row.buyer_id),
      sellerId: userCodeByDbId.get(row.seller_id),
      buyerPinned: Number(row.buyer_pinned || 0),
      sellerPinned: Number(row.seller_pinned || 0),
      createdAt: normalizeDate(row.created_at) || '2026-01-01',
      updatedAt: normalizeDate(row.last_message_at || row.updated_at || row.created_at) || '2026-01-01',
      messages: messagesByConversationId.get(row.conversation_id) || []
    }))

    const notificationRows = await queryRows(
      this.pool,
      `
      SELECT
        notification_id, notification_code, user_id, notification_type,
        title, content, related_listing_id, related_order_no, read_status, created_at
      FROM ct_notification
      ORDER BY notification_id DESC
      `
    )
    const notifications = notificationRows.map((row) => ({
      id: row.notification_code || `N${row.notification_id}`,
      userId: userCodeByDbId.get(row.user_id),
      type: row.notification_type || 'system',
      title: row.title,
      content: row.content,
      createdAt: normalizeDate(row.created_at) || '2026-01-01',
      read: Number(row.read_status || 0) === 1,
      relatedListingId: row.related_listing_id ? Number(row.related_listing_id) : null,
      relatedOrderId: row.related_order_no || null
    }))

    const verifyRows = await queryRows(
      this.pool,
      `
      SELECT
        verify_id, verify_code, user_id, real_name, student_no,
        verify_status, reviewer_id, reviewed_at, reject_reason, created_at
      FROM ct_user_verify
      ORDER BY verify_id
      `
    )
    const verifyRequests = verifyRows.map((row) => ({
      id: row.verify_code || `V${row.verify_id}`,
      userId: userCodeByDbId.get(row.user_id),
      studentNo: row.student_no,
      realName: row.real_name,
      verifyStatus: VERIFY_CODE_TO_STATUS[Number(row.verify_status)] || '待审核',
      reviewerId: row.reviewer_id ? userCodeByDbId.get(row.reviewer_id) : null,
      reviewedAt: normalizeDate(row.reviewed_at),
      rejectReason: row.reject_reason || null,
      createdAt: normalizeDate(row.created_at) || '2026-01-01'
    }))

    return {
      __schemaVersion: 3,
      users,
      listings,
      favorites,
      orders,
      orderLogs,
      conversations,
      notifications,
      verifyRequests,
      meta: {
        nextListingId: Math.max(listings.reduce((max, item) => Math.max(max, Number(item.numericId || 0)), 0) + 1, 1),
        nextConversationId: nextFromCodes(conversations, (item) => item.id, 1),
        nextMessageId: nextFromCodes(messageRows, (item) => item.message_code || `M${item.message_id}`, 1),
        nextVerifyId: nextFromCodes(verifyRequests, (item) => item.id, 1),
        nextOrderLogId: nextFromCodes(orderLogs, (item) => item.id, 1),
        nextOrderSeq: Math.max(orderRows.length + 100, 100),
        nextNotificationId: nextFromCodes(notifications, (item) => item.id, 1)
      }
    }
  }
}
