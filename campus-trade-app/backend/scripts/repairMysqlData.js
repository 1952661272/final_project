import process from 'node:process'
import crypto from 'node:crypto'
import mysql from 'mysql2/promise'
import { loadLocalEnv } from '../env.js'

const USER_PREFIXES = ['dbseller_', 'dbbuyer_', 'finalseller_', 'finalbuyer_']
const QUESTION_MARK_PATTERN = '%???%'

function parseArgs(argv) {
  const argMap = new Map()
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    argMap.set(key, value ?? 'true')
  }
  return {
    mode: String(argMap.get('mode') || 'dry-run').trim(),
    mysqlUrl: String(argMap.get('mysql-url') || process.env.MYSQL_URL || '').trim()
  }
}

function buildInClause(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { clause: '(NULL)', params: [] }
  }
  return {
    clause: `(${items.map(() => '?').join(',')})`,
    params: [...items]
  }
}

function pickIds(rows, field) {
  return (Array.isArray(rows) ? rows : []).map((row) => row[field]).filter((value) => value !== null && value !== undefined)
}

async function ensureBackupTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ct_repair_backup (
      backup_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      run_id VARCHAR(64) NOT NULL,
      table_name VARCHAR(64) NOT NULL,
      row_pk VARCHAR(128) NULL,
      row_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_repair_backup_run (run_id),
      KEY idx_repair_backup_table (table_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)
}

async function backupRows(connection, runId, tableName, pkColumn, whereSql, params = []) {
  const [rows] = await connection.query(`SELECT * FROM ${tableName} WHERE ${whereSql}`, params)
  if (!rows.length) return 0

  for (const row of rows) {
    await connection.query(
      `
      INSERT INTO ct_repair_backup (run_id, table_name, row_pk, row_json)
      VALUES (?, ?, ?, ?)
      `,
      [runId, tableName, String(row[pkColumn] ?? ''), JSON.stringify(row)]
    )
  }
  return rows.length
}

async function deleteRows(connection, tableName, whereSql, params = []) {
  const [result] = await connection.query(`DELETE FROM ${tableName} WHERE ${whereSql}`, params)
  return Number(result?.affectedRows || 0)
}

async function collectTargets(connection) {
  const userPrefixWhere = USER_PREFIXES.map(() => 'username LIKE ?').join(' OR ')
  const userPrefixParams = USER_PREFIXES.map((prefix) => `${prefix}%`)
  const [dirtyUsers] = await connection.query(
    `
    SELECT user_id, user_code, username, student_no
    FROM ct_user
    WHERE ${userPrefixWhere}
    `,
    userPrefixParams
  )
  const dirtyUserIds = pickIds(dirtyUsers, 'user_id')

  const userInClause = buildInClause(dirtyUserIds)
  const [dirtyListings] = await connection.query(
    `
    SELECT DISTINCT l.listing_id, l.listing_code, l.title
    FROM ct_listing l
    LEFT JOIN ct_category cg ON cg.category_id = l.category_id
    LEFT JOIN ct_campus cp ON cp.campus_id = l.campus_id
    WHERE l.title LIKE ?
       OR cg.category_name LIKE ?
       OR cp.campus_name LIKE ?
       OR l.seller_id IN ${userInClause.clause}
    `,
    [QUESTION_MARK_PATTERN, QUESTION_MARK_PATTERN, QUESTION_MARK_PATTERN, ...userInClause.params]
  )
  const dirtyListingIds = pickIds(dirtyListings, 'listing_id')

  const listingInClause = buildInClause(dirtyListingIds)
  const [dirtyOrders] = await connection.query(
    `
    SELECT DISTINCT order_id, order_no
    FROM ct_order
    WHERE listing_id IN ${listingInClause.clause}
       OR buyer_id IN ${userInClause.clause}
       OR seller_id IN ${userInClause.clause}
    `,
    [...listingInClause.params, ...userInClause.params, ...userInClause.params]
  )
  const dirtyOrderIds = pickIds(dirtyOrders, 'order_id')
  const dirtyOrderNos = pickIds(dirtyOrders, 'order_no')

  const orderInClause = buildInClause(dirtyOrderIds)
  const orderNoInClause = buildInClause(dirtyOrderNos)

  const [dirtyConversations] = await connection.query(
    `
    SELECT DISTINCT conversation_id
    FROM ct_conversation
    WHERE listing_id IN ${listingInClause.clause}
       OR buyer_id IN ${userInClause.clause}
       OR seller_id IN ${userInClause.clause}
    `,
    [...listingInClause.params, ...userInClause.params, ...userInClause.params]
  )
  const dirtyConversationIds = pickIds(dirtyConversations, 'conversation_id')
  const conversationInClause = buildInClause(dirtyConversationIds)

  const [dirtyMessages] = await connection.query(
    `
    SELECT DISTINCT message_id
    FROM ct_message
    WHERE conversation_id IN ${conversationInClause.clause}
       OR sender_id IN ${userInClause.clause}
    `,
    [...conversationInClause.params, ...userInClause.params]
  )
  const dirtyMessageIds = pickIds(dirtyMessages, 'message_id')

  const [dirtyFavorites] = await connection.query(
    `
    SELECT DISTINCT favorite_id
    FROM ct_favorite
    WHERE user_id IN ${userInClause.clause}
       OR listing_id IN ${listingInClause.clause}
    `,
    [...userInClause.params, ...listingInClause.params]
  )
  const dirtyFavoriteIds = pickIds(dirtyFavorites, 'favorite_id')

  const [dirtyOrderLogs] = await connection.query(
    `
    SELECT DISTINCT log_id
    FROM ct_order_status_log
    WHERE order_id IN ${orderInClause.clause}
       OR operator_id IN ${userInClause.clause}
    `,
    [...orderInClause.params, ...userInClause.params]
  )
  const dirtyOrderLogIds = pickIds(dirtyOrderLogs, 'log_id')

  const [dirtyVerifies] = await connection.query(
    `
    SELECT DISTINCT verify_id
    FROM ct_user_verify
    WHERE user_id IN ${userInClause.clause}
       OR reviewer_id IN ${userInClause.clause}
    `,
    [...userInClause.params, ...userInClause.params]
  )
  const dirtyVerifyIds = pickIds(dirtyVerifies, 'verify_id')

  const [dirtyNotifications] = await connection.query(
    `
    SELECT DISTINCT notification_id
    FROM ct_notification
    WHERE user_id IN ${userInClause.clause}
       OR related_listing_id IN ${listingInClause.clause}
       OR related_order_no IN ${orderNoInClause.clause}
    `,
    [...userInClause.params, ...listingInClause.params, ...orderNoInClause.params]
  )
  const dirtyNotificationIds = pickIds(dirtyNotifications, 'notification_id')

  const [invalidStatRows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM ct_user WHERE role_type NOT IN (1, 2) OR user_status NOT IN (1, 2) OR verified_status NOT IN (0, 1) OR credit_score < 0 OR credit_score > 5) AS invalid_user_rows,
      (SELECT COUNT(*) FROM ct_listing WHERE price < 0 OR quality_score < 0 OR quality_score > 10 OR shipping_type NOT IN (1, 2, 3) OR trade_method NOT IN (1, 2, 3) OR listing_status NOT IN (0, 1, 2, 3, 4, 5)) AS invalid_listing_rows,
      (SELECT COUNT(*) FROM ct_order WHERE order_amount < 0 OR order_status NOT IN (0, 1, 2, 3, 4, 5) OR trade_method NOT IN (1, 2, 3) OR payment_status NOT IN (0, 1, 2)) AS invalid_order_rows
  `)

  return {
    dirtyUsers,
    dirtyListings,
    dirtyOrders,
    dirtyUserIds,
    dirtyListingIds,
    dirtyOrderIds,
    dirtyConversationIds,
    dirtyMessageIds,
    dirtyFavoriteIds,
    dirtyOrderLogIds,
    dirtyVerifyIds,
    dirtyNotificationIds,
    invalidStats: invalidStatRows[0] || {
      invalid_user_rows: 0,
      invalid_listing_rows: 0,
      invalid_order_rows: 0
    }
  }
}

async function normalizeRemainingData(connection) {
  await connection.query(`
    UPDATE ct_user
    SET role_type = CASE WHEN role_type IN (1, 2) THEN role_type ELSE 1 END,
        user_status = CASE WHEN user_status IN (1, 2) THEN user_status ELSE 1 END,
        verified_status = CASE WHEN verified_status IN (0, 1) THEN verified_status ELSE 0 END,
        credit_score = CASE
          WHEN credit_score < 0 THEN 0
          WHEN credit_score > 5 THEN 5
          ELSE credit_score
        END,
        user_code = CASE
          WHEN user_code IS NULL OR user_code = '' OR user_code REGEXP '^(U|A)?[0-9]+$' = 0
            THEN CASE WHEN role_type = 2 THEN CONCAT('A', LPAD(user_id, 2, '0')) ELSE CONCAT('U', LPAD(user_id, 2, '0')) END
          ELSE user_code
        END
  `)
  await connection.query(`
    UPDATE ct_listing
    SET price = CASE WHEN price < 0 THEN 0 ELSE price END,
        quality_score = CASE
          WHEN quality_score < 0 THEN 0
          WHEN quality_score > 10 THEN 10
          ELSE quality_score
        END,
        shipping_type = CASE WHEN shipping_type IN (1, 2, 3) THEN shipping_type ELSE 2 END,
        trade_method = CASE WHEN trade_method IN (1, 2, 3) THEN trade_method ELSE 1 END,
        listing_status = CASE WHEN listing_status IN (0, 1, 2, 3, 4, 5) THEN listing_status ELSE 1 END
  `)
  await connection.query(`
    UPDATE ct_order
    SET order_amount = CASE WHEN order_amount < 0 THEN 0 ELSE order_amount END,
        order_status = CASE WHEN order_status IN (0, 1, 2, 3, 4, 5) THEN order_status ELSE 0 END,
        trade_method = CASE WHEN trade_method IN (1, 2, 3) THEN trade_method ELSE 1 END,
        payment_status = CASE WHEN payment_status IN (0, 1, 2) THEN payment_status ELSE 0 END
  `)
}

function printSummary(summary) {
  console.table({
    dirty_users: summary.dirtyUserIds.length,
    dirty_listings: summary.dirtyListingIds.length,
    dirty_orders: summary.dirtyOrderIds.length,
    dirty_conversations: summary.dirtyConversationIds.length,
    dirty_messages: summary.dirtyMessageIds.length,
    dirty_favorites: summary.dirtyFavoriteIds.length,
    dirty_order_logs: summary.dirtyOrderLogIds.length,
    dirty_verify_requests: summary.dirtyVerifyIds.length,
    dirty_notifications: summary.dirtyNotificationIds.length,
    invalid_user_rows: Number(summary.invalidStats.invalid_user_rows || 0),
    invalid_listing_rows: Number(summary.invalidStats.invalid_listing_rows || 0),
    invalid_order_rows: Number(summary.invalidStats.invalid_order_rows || 0)
  })
}

async function run() {
  loadLocalEnv()
  const { mode, mysqlUrl } = parseArgs(process.argv.slice(2))
  if (!mysqlUrl) {
    throw new Error('MYSQL_URL is required. Use env MYSQL_URL or --mysql-url=<url>.')
  }
  if (!['dry-run', 'apply'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}. Use --mode=dry-run or --mode=apply.`)
  }

  const connection = await mysql.createConnection({ uri: mysqlUrl })
  try {
    const summary = await collectTargets(connection)
    console.log(`[repair] mode=${mode}`)
    printSummary(summary)

    if (mode === 'dry-run') return

    const runId = `repair_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    await connection.beginTransaction()
    try {
      await ensureBackupTable(connection)

      const userInClause = buildInClause(summary.dirtyUserIds)
      const listingInClause = buildInClause(summary.dirtyListingIds)
      const orderInClause = buildInClause(summary.dirtyOrderIds)
      const conversationInClause = buildInClause(summary.dirtyConversationIds)
      const messageInClause = buildInClause(summary.dirtyMessageIds)
      const favoriteInClause = buildInClause(summary.dirtyFavoriteIds)
      const orderLogInClause = buildInClause(summary.dirtyOrderLogIds)
      const verifyInClause = buildInClause(summary.dirtyVerifyIds)
      const notificationInClause = buildInClause(summary.dirtyNotificationIds)

      await backupRows(connection, runId, 'ct_order_status_log', 'log_id', `log_id IN ${orderLogInClause.clause}`, orderLogInClause.params)
      await backupRows(connection, runId, 'ct_message', 'message_id', `message_id IN ${messageInClause.clause}`, messageInClause.params)
      await backupRows(connection, runId, 'ct_notification', 'notification_id', `notification_id IN ${notificationInClause.clause}`, notificationInClause.params)
      await backupRows(connection, runId, 'ct_favorite', 'favorite_id', `favorite_id IN ${favoriteInClause.clause}`, favoriteInClause.params)
      await backupRows(connection, runId, 'ct_listing_review', 'review_id', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await backupRows(connection, runId, 'ct_listing_tag', 'tag_id', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await backupRows(connection, runId, 'ct_listing_image', 'image_id', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await backupRows(connection, runId, 'ct_conversation', 'conversation_id', `conversation_id IN ${conversationInClause.clause}`, conversationInClause.params)
      await backupRows(connection, runId, 'ct_order', 'order_id', `order_id IN ${orderInClause.clause}`, orderInClause.params)
      await backupRows(connection, runId, 'ct_user_verify', 'verify_id', `verify_id IN ${verifyInClause.clause}`, verifyInClause.params)
      await backupRows(connection, runId, 'ct_listing', 'listing_id', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await backupRows(connection, runId, 'ct_user', 'user_id', `user_id IN ${userInClause.clause}`, userInClause.params)

      await deleteRows(connection, 'ct_order_status_log', `log_id IN ${orderLogInClause.clause}`, orderLogInClause.params)
      await deleteRows(connection, 'ct_message', `message_id IN ${messageInClause.clause}`, messageInClause.params)
      await deleteRows(connection, 'ct_notification', `notification_id IN ${notificationInClause.clause}`, notificationInClause.params)
      await deleteRows(connection, 'ct_favorite', `favorite_id IN ${favoriteInClause.clause}`, favoriteInClause.params)
      await deleteRows(connection, 'ct_listing_review', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await deleteRows(connection, 'ct_listing_tag', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await deleteRows(connection, 'ct_listing_image', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await deleteRows(connection, 'ct_conversation', `conversation_id IN ${conversationInClause.clause}`, conversationInClause.params)
      await deleteRows(connection, 'ct_order', `order_id IN ${orderInClause.clause}`, orderInClause.params)
      await deleteRows(connection, 'ct_user_verify', `verify_id IN ${verifyInClause.clause}`, verifyInClause.params)
      await deleteRows(connection, 'ct_listing', `listing_id IN ${listingInClause.clause}`, listingInClause.params)
      await deleteRows(connection, 'ct_user', `user_id IN ${userInClause.clause}`, userInClause.params)

      await normalizeRemainingData(connection)
      await connection.commit()

      console.log(`[repair] apply completed, backup run id: ${runId}`)
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } finally {
    await connection.end()
  }
}

run().catch((error) => {
  console.error(`[repair] failed: ${error.message}`)
  process.exitCode = 1
})
