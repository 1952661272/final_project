import {
  LISTING_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  normalizeListingStatus,
  normalizeOrderStatus,
  normalizePaymentStatus
} from './status.js'

function formatDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function getToday() {
  return formatDate(new Date())
}

function getNow() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 19)
}

function parseDate(value) {
  if (!value) return new Date('1970-01-01T00:00:00')
  if (value instanceof Date) return value
  const raw = String(value)
  const normalized = raw.includes('T')
    ? raw
    : raw.includes(' ')
      ? raw.replace(' ', 'T')
      : `${raw}T00:00:00`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? new Date('1970-01-01T00:00:00') : parsed
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function listingIdFromParam(value) {
  const text = String(value || '').trim()
  return text.startsWith('L') ? text : `L${text}`
}

function numericId(code, prefix = '') {
  return Number(String(code || '').replace(prefix, ''))
}

function buildRelativeTime(dateText) {
  const created = parseDate(dateText)
  const diff = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
  if (diff === 0) return '今天'
  if (diff === 1) return '1天前'
  if (diff < 7) return `${diff}天前`
  return String(dateText || '')
}

function getLastDays(count) {
  const result = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date()
    day.setDate(day.getDate() - index)
    result.push(formatDate(day))
  }
  return result
}

function diffDaysFrom(dateText) {
  if (!dateText) return Number.POSITIVE_INFINITY
  return (Date.now() - parseDate(dateText).getTime()) / (1000 * 60 * 60 * 24)
}

function nextNotificationId(state) {
  state.meta = state.meta || {}
  state.meta.nextNotificationId = Number(state.meta.nextNotificationId) || 1
  return `N${state.meta.nextNotificationId++}`
}

function nextListingId(state) {
  state.meta = state.meta || {}
  state.meta.nextListingId = Number(state.meta.nextListingId) || 1
  return state.meta.nextListingId++
}

function nextConversationId(state) {
  state.meta = state.meta || {}
  state.meta.nextConversationId = Number(state.meta.nextConversationId) || 1
  return `C${state.meta.nextConversationId++}`
}

function nextMessageId(state) {
  state.meta = state.meta || {}
  state.meta.nextMessageId = Number(state.meta.nextMessageId) || 1
  return `M${state.meta.nextMessageId++}`
}

function nextOrderLogId(state) {
  state.meta = state.meta || {}
  state.meta.nextOrderLogId = Number(state.meta.nextOrderLogId) || 1
  return `OL${state.meta.nextOrderLogId++}`
}

function nextOrderId(state) {
  state.meta = state.meta || {}
  state.meta.nextOrderSeq = Number(state.meta.nextOrderSeq) || 100
  return `O${Date.now()}${state.meta.nextOrderSeq++}`
}

const CATEGORY_WHITELIST = new Set([
  '\u6570\u7801',
  '\u6559\u6750',
  '\u751f\u6d3b\u7528\u54c1',
  '\u4ea4\u901a\u5de5\u5177',
  '\u79df\u623f'
])

const CAMPUS_WHITELIST = new Set([
  '\u5317\u6821\u533a',
  '\u5357\u6821\u533a',
  '\u4e1c\u6821\u533a'
])

const SHIPPING_WHITELIST = new Set([
  '\u5305\u90ae',
  '\u4e0d\u5305\u90ae',
  '\u81ea\u63d0'
])

const METHOD_WHITELIST = new Set([
  '\u9762\u4ea4\u4f18\u5148',
  '\u9762\u4ea4',
  '\u5feb\u9012',
  '\u9762\u4ea4+\u5feb\u9012',
  '\u9762\u4ea4/\u5feb\u9012',
  '\u4ec5\u9762\u4ea4',
  '\u9762\u4ea4/\u81ea\u53d6'
])

const PLACEHOLDER_PATTERN = /(\?{3,}|？{3,})/

const USER_STATUS_ALIAS = new Map([
  ['\u6b63\u5e38', '\u6b63\u5e38'],
  ['\u7981\u7528', '\u7981\u7528'],
  ['NORMAL', '\u6b63\u5e38'],
  ['DISABLED', '\u7981\u7528']
])

const LISTING_STATUS_ALIAS = new Map([
  [LISTING_STATUS.DRAFT, LISTING_STATUS.DRAFT],
  [LISTING_STATUS.PENDING, LISTING_STATUS.PENDING],
  [LISTING_STATUS.PUBLISHED, LISTING_STATUS.PUBLISHED],
  [LISTING_STATUS.SOLD, LISTING_STATUS.SOLD],
  [LISTING_STATUS.OFFLINE, LISTING_STATUS.OFFLINE],
  [LISTING_STATUS.REJECTED, LISTING_STATUS.REJECTED],
  [LISTING_STATUS.TRADING, LISTING_STATUS.TRADING],
  ['DRAFT', LISTING_STATUS.DRAFT],
  ['PENDING', LISTING_STATUS.PENDING],
  ['PUBLISHED', LISTING_STATUS.PUBLISHED],
  ['SOLD', LISTING_STATUS.SOLD],
  ['OFFLINE', LISTING_STATUS.OFFLINE],
  ['REJECTED', LISTING_STATUS.REJECTED],
  ['TRADING', LISTING_STATUS.TRADING]
])

function createError(status, message, details = null) {
  const error = new Error(message)
  error.status = status
  if (details) error.details = details
  return error
}

function assertNoPlaceholder(value, field) {
  const text = String(value || '').trim()
  if (!text) return
  if (PLACEHOLDER_PATTERN.test(text)) {
    throw createError(400, `${field} 包含非法占位符`, [{ field, code: 'invalid_placeholder', message: `${field} contains placeholder` }])
  }
}

function normalizeCampus(value, field = 'campus') {
  const text = String(value || '').trim()
  if (!text || !CAMPUS_WHITELIST.has(text)) {
    throw createError(400, '校区不合法', [{ field, code: 'invalid_enum', message: 'campus is not in whitelist' }])
  }
  return text
}

function normalizeCategory(value, field = 'category') {
  const text = String(value || '').trim()
  if (!text || !CATEGORY_WHITELIST.has(text)) {
    throw createError(400, '分类不合法', [{ field, code: 'invalid_enum', message: 'category is not in whitelist' }])
  }
  return text
}

function normalizeShipping(value, field = 'shipping') {
  const text = String(value || '').trim()
  if (!text || !SHIPPING_WHITELIST.has(text)) {
    throw createError(400, '物流方式不合法', [{ field, code: 'invalid_enum', message: 'shipping is not in whitelist' }])
  }
  return text
}

function normalizeMethod(value, field = 'method') {
  const text = String(value || '').trim()
  if (!text || !METHOD_WHITELIST.has(text)) {
    throw createError(400, '交易方式不合法', [{ field, code: 'invalid_enum', message: 'method is not in whitelist' }])
  }
  return text
}

function normalizeListingStatusStrict(value, { allowTrading = false } = {}) {
  const text = String(value || '').trim()
  const normalized = LISTING_STATUS_ALIAS.get(text)
  if (!normalized) {
    throw createError(400, '商品状态不合法', [{ field: 'status', code: 'invalid_enum', message: 'status is invalid' }])
  }
  if (!allowTrading && normalized === LISTING_STATUS.TRADING) {
    throw createError(400, '商品状态不合法', [{ field: 'status', code: 'invalid_enum', message: 'status TRADING is readonly' }])
  }
  return normalized
}

function normalizeUserStatusStrict(value) {
  const text = String(value || '').trim().toUpperCase()
  const normalized = USER_STATUS_ALIAS.get(text) || USER_STATUS_ALIAS.get(String(value || '').trim())
  if (!normalized) {
    throw createError(400, '用户状态不合法', [{ field: 'status', code: 'invalid_enum', message: 'status is invalid' }])
  }
  return normalized
}

function normalizeTags(value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw createError(400, '标签格式不合法', [{ field: 'tags', code: 'invalid_type', message: 'tags must be array' }])
  }
  const normalized = value
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
  if (normalized.some((tag) => PLACEHOLDER_PATTERN.test(tag))) {
    throw createError(400, '标签包含非法占位符', [{ field: 'tags', code: 'invalid_placeholder', message: 'tags contains placeholder' }])
  }
  return [...new Set(normalized)]
}

function normalizeImages(value, { required = false } = {}) {
  if (value === undefined) {
    if (required) throw createError(400, '至少上传一张图片', [{ field: 'images', code: 'required', message: 'images is required' }])
    return undefined
  }
  if (!Array.isArray(value)) {
    throw createError(400, '图片格式不合法', [{ field: 'images', code: 'invalid_type', message: 'images must be array' }])
  }
  const normalized = value.map((item) => String(item || '').trim()).filter(Boolean)
  if (required && normalized.length === 0) {
    throw createError(400, '至少上传一张图片', [{ field: 'images', code: 'required', message: 'images is required' }])
  }
  return normalized
}

function normalizePrice(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw createError(400, '价格不能为空', [{ field: 'price', code: 'required', message: 'price is required' }])
    return undefined
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw createError(400, '价格必须大于 0', [{ field: 'price', code: 'invalid_range', message: 'price must be > 0' }])
  }
  return number
}

function normalizeCondition(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw createError(400, '成色不能为空', [{ field: 'condition', code: 'required', message: 'condition is required' }])
    return undefined
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 10) {
    throw createError(400, '成色必须在 0-10 之间', [{ field: 'condition', code: 'invalid_range', message: 'condition must be 0..10' }])
  }
  return number
}

function isActiveOrderStatus(status) {
  const normalized = normalizeOrderStatus(status)
  return [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.IN_PROGRESS
  ].includes(normalized)
}

function isTradedOrderStatus(order) {
  const normalizedStatus = normalizeOrderStatus(order.status)
  const normalizedPayment = normalizePaymentStatus(order.paymentStatus, order.status)
  return normalizedPayment === PAYMENT_STATUS.PAID || normalizedStatus === ORDER_STATUS.COMPLETED
}

function isSoftDeleted(user) {
  return !!user?.deletedAt
}

function findUserByName(state, name, { includeDeleted = false } = {}) {
  const keyword = String(name || '').trim()
  if (!keyword) return null
  return state.users.find((user) => (
    (includeDeleted || !isSoftDeleted(user)) &&
    (
      user.name === keyword ||
      user.account === keyword ||
      user.studentNo === keyword
    )
  )) || null
}

function validateAdmin(state, account) {
  const admin = findUserByName(state, account)
  return admin && admin.role === 'admin' && admin.status === '正常' ? admin : null
}

function getUserById(state, userId, { includeDeleted = false } = {}) {
  return state.users.find((user) => user.id === userId && (includeDeleted || !isSoftDeleted(user))) || null
}

function getListingById(state, listingId) {
  return state.listings.find((listing) => listing.id === listingIdFromParam(listingId)) || null
}

function getActiveOrderForListing(state, listingId) {
  const targetId = listingIdFromParam(listingId)
  return state.orders.find((order) => order.listingId === targetId && isActiveOrderStatus(order.status)) || null
}

function getListingDisplayStatus(state, listing) {
  if (!listing) return LISTING_STATUS.OFFLINE
  const normalizedStatus = normalizeListingStatus(listing.status)
  if (normalizedStatus !== LISTING_STATUS.PUBLISHED) return normalizedStatus
  return getActiveOrderForListing(state, listing.id) ? LISTING_STATUS.TRADING : LISTING_STATUS.PUBLISHED
}

function createNotification(state, userId, payload) {
  if (!userId) return null
  const notification = {
    id: nextNotificationId(state),
    userId,
    type: payload.type || 'system',
    title: payload.title,
    content: payload.content,
    createdAt: payload.createdAt || getToday(),
    read: false,
    relatedListingId: payload.relatedListingId ? numericId(payload.relatedListingId, 'L') : null,
    relatedOrderId: payload.relatedOrderId || null
  }
  state.notifications = ensureArray(state.notifications)
  state.notifications.unshift(notification)
  return notification
}

function createNotificationsForUsers(state, userIds, payload) {
  const uniqueUserIds = [...new Set(ensureArray(userIds).filter(Boolean))]
  uniqueUserIds.forEach((userId) => createNotification(state, userId, payload))
}

function buildUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    studentNo: user.studentNo || '',
    account: user.account || user.studentNo || user.name || '',
    status: user.status || '正常',
    reg: user.reg || getToday(),
    campus: user.campus || '未设置校区',
    credit: Number(user.credit) || 5,
    verified: !!user.verified,
    role: user.role || 'student',
    deletedAt: user.deletedAt || null
  }
}

function buildNotificationDto(notification) {
  return {
    id: notification.id,
    type: notification.type || 'system',
    title: notification.title,
    content: notification.content,
    createdAt: notification.createdAt,
    read: !!notification.read,
    relatedListingId: notification.relatedListingId || null,
    relatedOrderId: notification.relatedOrderId || null
  }
}

function buildListingDto(state, listing) {
  const seller = getUserById(state, listing.sellerId, { includeDeleted: true })
  return {
    id: listing.numericId || numericId(listing.id, 'L'),
    title: listing.title,
    price: Number(listing.price) || 0,
    campus: listing.campus,
    condition: Number(listing.condition) || 0,
    category: listing.category,
    time: buildRelativeTime(listing.createdAt),
    createdAt: listing.createdAt,
    seller: seller?.name || '未知用户',
    desc: listing.desc || '',
    tags: ensureArray(listing.tags),
    shipping: listing.shipping || '包邮',
    method: listing.method || '面交优先',
    views: Number(listing.views) || 0,
    likes: Number(listing.likes) || 0,
    status: getListingDisplayStatus(state, listing),
    images: ensureArray(listing.images),
    reviewRemark: listing.reviewRemark || null
  }
}

function buildOrderDto(state, order) {
  const listing = getListingById(state, order.listingId)
  const seller = getUserById(state, order.sellerId, { includeDeleted: true })
  const buyer = getUserById(state, order.buyerId, { includeDeleted: true })
  return {
    id: order.id,
    listingId: numericId(order.listingId, 'L'),
    item: listing?.title || '未知商品',
    price: Number(order.price) || 0,
    status: normalizeOrderStatus(order.status),
    time: order.updatedAt || order.createdAt,
    createdAt: order.createdAt,
    method: order.method || '面交',
    address: order.address || '',
    paymentStatus: normalizePaymentStatus(order.paymentStatus, order.status),
    paymentMethod: order.paymentMethod || '',
    paymentTime: order.paymentTime || null,
    rejectReason: order.rejectReason || null,
    cancelReason: order.cancelReason || null,
    listingStatus: listing ? getListingDisplayStatus(state, listing) : LISTING_STATUS.OFFLINE,
    seller: seller?.name || '-',
    buyer: buyer?.name || '-'
  }
}

function buildOrderLogDto(state, log) {
  const operator = getUserById(state, log.operatorId, { includeDeleted: true })
  return {
    id: log.id,
    orderId: log.orderId,
    fromStatus: log.fromStatus || null,
    toStatus: log.toStatus,
    operator: operator?.name || '-',
    note: log.note || '',
    createdAt: log.createdAt
  }
}

function buildMessageDto(conversation, message, currentUserId) {
  return {
    id: message.id,
    from: message.senderId === currentUserId ? 'me' : 'other',
    text: message.text,
    time: message.sentAt || conversation.updatedAt || getToday(),
    read: !!message.read,
    messageType: message.messageType || 'text'
  }
}

function buildConversationSummary(state, conversation, currentUserId) {
  const listing = getListingById(state, conversation.listingId)
  const peerId = conversation.buyerId === currentUserId ? conversation.sellerId : conversation.buyerId
  const peer = getUserById(state, peerId, { includeDeleted: true })
  const messages = ensureArray(conversation.messages)
  const lastMessage = messages[messages.length - 1] || null
  const unreadCount = messages.filter((message) => message.senderId !== currentUserId && !message.read).length

  return {
    id: conversation.id,
    type: 'chat',
    pinned: conversation.buyerId === currentUserId ? !!conversation.buyerPinned : !!conversation.sellerPinned,
    name: peer?.name || '未知用户',
    peerUser: peer ? buildUserDto(peer) : null,
    listingId: numericId(conversation.listingId, 'L'),
    listingTitle: listing?.title || '未知商品',
    listingPrice: Number(listing?.price) || 0,
    listingStatus: listing ? getListingDisplayStatus(state, listing) : LISTING_STATUS.OFFLINE,
    lastMessage: lastMessage ? buildMessageDto(conversation, lastMessage, currentUserId) : null,
    messageCount: messages.length,
    unreadCount,
    updatedAt: conversation.updatedAt || lastMessage?.sentAt || getToday()
  }
}

function listFavoritesFromState(state, userId) {
  return ensureArray(state.favorites)
    .filter((favorite) => favorite.userId === userId)
    .map((favorite) => numericId(favorite.listingId, 'L'))
}

function appendOrderLog(state, order, fromStatus, toStatus, operatorId, note) {
  state.orderLogs = ensureArray(state.orderLogs)
  state.orderLogs.unshift({
    id: nextOrderLogId(state),
    orderId: order.id,
    fromStatus,
    toStatus,
    operatorId,
    note,
    createdAt: getToday()
  })
}

function applyListingFilters(state, listings, query = {}) {
  const keyword = String(query.keyword || '').trim().toLowerCase()
  const category = String(query.category || '').trim()
  const campus = String(query.campus || '').trim()
  const price = String(query.price || '').trim()
  const condition = String(query.condition || '').trim()
  const sort = String(query.sort || '最新').trim()
  const sellerName = String(query.sellerName || '').trim()
  const statusValues = String(query.status || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.max(1, Math.min(200, Number(query.pageSize || 100)))

  let result = listings.slice()

  if (statusValues.length) {
    result = result.filter((listing) => statusValues.includes(getListingDisplayStatus(state, listing)))
  }
  if (keyword) {
    result = result.filter((listing) => (
      String(listing.title || '').toLowerCase().includes(keyword) ||
      String(listing.desc || '').toLowerCase().includes(keyword)
    ))
  }
  if (category && category !== '全部') {
    result = result.filter((listing) => listing.category === category)
  }
  if (campus && campus !== '全部') {
    result = result.filter((listing) => listing.campus === campus)
  }
  if (sellerName) {
    result = result.filter((listing) => getUserById(state, listing.sellerId)?.name === sellerName)
  }
  if (price && price !== '全部') {
    result = result.filter((listing) => {
      if (price === '0-100') return Number(listing.price) <= 100
      if (price === '100-500') return Number(listing.price) > 100 && Number(listing.price) <= 500
      if (price === '500-2000') return Number(listing.price) > 500 && Number(listing.price) <= 2000
      if (price === '2000+') return Number(listing.price) > 2000
      return true
    })
  }
  if (condition && condition !== '全部') {
    result = result.filter((listing) => {
      const score = Number(listing.condition) || 0
      if (condition === '9-10') return score >= 9
      if (condition === '8-9') return score >= 8 && score < 9
      if (condition === '7-8') return score >= 7 && score < 8
      if (condition === '7以下') return score < 7
      return true
    })
  }

  result.sort((left, right) => {
    if (sort === '价格升序') return Number(left.price) - Number(right.price)
    if (sort === '价格降序') return Number(right.price) - Number(left.price)
    return parseDate(right.createdAt) - parseDate(left.createdAt)
  })

  const total = result.length
  const list = result
    .slice((page - 1) * pageSize, page * pageSize)
    .map((listing) => buildListingDto(state, listing))

  return { list, total, page, pageSize }
}

function assertOrderVisibleToUser(user, order) {
  if (!user || (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== 'admin')) {
    throw createError(404, 'order not found')
  }
}

function assertConversationVisibleToUser(user, conversation) {
  if (!user || !conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) {
    throw createError(404, 'conversation not found')
  }
}

function assertAllowedOrderTransition(fromStatus, toStatus) {
  const normalizedFrom = normalizeOrderStatus(fromStatus)
  const normalizedTo = normalizeOrderStatus(toStatus)
  const allowed = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REJECTED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.COMPLETED]: [],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.REJECTED]: []
  }
  if (!allowed[normalizedFrom]?.includes(normalizedTo)) {
    throw createError(400, `不允许的订单状态流转: ${normalizedFrom} -> ${normalizedTo}`)
  }
}

function validateRegisterPayload(username, studentNo, password) {
  const actualName = String(username || '').trim()
  const actualStudentNo = String(studentNo || '').trim()
  const actualPassword = String(password || '').trim()

  if (!actualName || !actualStudentNo || !actualPassword) {
    throw createError(400, '姓名、学号和密码不能为空', [
      { field: 'username', code: 'required', message: 'username is required' },
      { field: 'studentNo', code: 'required', message: 'studentNo is required' },
      { field: 'password', code: 'required', message: 'password is required' }
    ])
  }

  if (actualName.length < 2) {
    throw createError(400, '用户名长度至少为 2 位', [{ field: 'username', code: 'min_length', message: 'username must have at least 2 chars' }])
  }
  assertNoPlaceholder(actualName, 'username')

  if (!/^\d{6,20}$/.test(actualStudentNo)) {
    throw createError(400, '学号格式不合法', [{ field: 'studentNo', code: 'invalid_format', message: 'studentNo must be 6-20 digits' }])
  }

  if (actualPassword.length < 6) {
    throw createError(400, '密码长度不能少于 6 位', [{ field: 'password', code: 'min_length', message: 'password must have at least 6 chars' }])
  }

  return {
    actualName,
    actualStudentNo,
    actualPassword
  }
}

function normalizeListingPayload(payload = {}, { partial = false, fallbackCampus = '\u5317\u6821\u533a' } = {}) {
  const normalized = {}

  const titleInput = payload.title
  if (!partial || titleInput !== undefined) {
    const title = String(titleInput || '').trim()
    if (!title) throw createError(400, '商品标题不能为空', [{ field: 'title', code: 'required', message: 'title is required' }])
    assertNoPlaceholder(title, 'title')
    normalized.title = title
  }

  const descInput = payload.desc
  if (!partial || descInput !== undefined) {
    const desc = String(descInput || '').trim()
    assertNoPlaceholder(desc, 'desc')
    normalized.desc = desc
  }

  const priceInput = payload.price
  if (!partial || priceInput !== undefined) {
    normalized.price = normalizePrice(priceInput, { required: !partial })
  }

  const conditionInput = payload.condition
  if (!partial || conditionInput !== undefined) {
    normalized.condition = normalizeCondition(conditionInput, { required: !partial })
  }

  const categoryInput = payload.category !== undefined ? payload.category : (!partial ? '\u6570\u7801' : undefined)
  if (categoryInput !== undefined) {
    normalized.category = normalizeCategory(categoryInput)
  }

  const campusInput = payload.campus !== undefined ? payload.campus : (!partial ? fallbackCampus : undefined)
  if (campusInput !== undefined) {
    normalized.campus = normalizeCampus(campusInput)
  }

  const shippingInput = payload.shipping !== undefined ? payload.shipping : (!partial ? '\u5305\u90ae' : undefined)
  if (shippingInput !== undefined) {
    normalized.shipping = normalizeShipping(shippingInput)
  }

  const methodInput = payload.method !== undefined ? payload.method : (!partial ? '\u9762\u4ea4\u4f18\u5148' : undefined)
  if (methodInput !== undefined) {
    normalized.method = normalizeMethod(methodInput)
  }

  const tags = normalizeTags(payload.tags)
  if (tags !== undefined) {
    normalized.tags = tags
  } else if (!partial) {
    normalized.tags = []
  }

  const images = normalizeImages(payload.images, { required: !partial })
  if (images !== undefined) {
    normalized.images = images
  }

  return normalized
}

export class DomainService {
  constructor(repository) {
    this.repository = repository
  }

  async health() {
    return { service: 'campus-trade-api', time: new Date().toISOString() }
  }

  async register(username, studentNo, password) {
    const { actualName, actualStudentNo, actualPassword } = validateRegisterPayload(username, studentNo, password)

    const authUser = await this.repository.registerAuthUser({
      username: actualName,
      studentNo: actualStudentNo,
      password: actualPassword
    })
    const stateUser = await this.repository.syncStateUserFromAuthUser(authUser)
    return buildUserDto(stateUser)
  }

  async login(account, password) {
    const actualAccount = String(account || '').trim()
    const actualPassword = String(password || '').trim()
    if (!actualAccount || !actualPassword) {
      throw createError(400, '学号和密码不能为空')
    }

    const authUser = await this.repository.authenticateAuthUser(actualAccount, actualPassword)
    if (authUser.status === '禁用') {
      throw createError(403, '该账号已被禁用，请联系管理员')
    }
    const stateUser = await this.repository.syncStateUserFromAuthUser(authUser)
    return buildUserDto(stateUser)
  }

  async adminLogin(account, password) {
    const state = await this.repository.read()
    const admin = validateAdmin(state, account)
    if (!admin || String(password || '').trim() !== String(admin.password || '')) {
      throw createError(401, '管理员账号或密码错误')
    }
    return {
      account: admin.account,
      role: 'admin',
      user: buildUserDto(admin)
    }
  }

  async getCurrentUser(name) {
    const state = await this.repository.read()
    const user = findUserByName(state, name)
    if (!user) throw createError(401, '未登录')
    return buildUserDto(user)
  }

  async listUsers() {
    const state = await this.repository.read()
    return state.users
      .filter((user) => user.role !== 'admin' && !isSoftDeleted(user))
      .map(buildUserDto)
  }

  async listAdminUsers(adminAccount, filters = {}) {
    const state = await this.repository.read()
    if (!validateAdmin(state, adminAccount)) {
      throw createError(401, '管理员未登录')
    }

    const studentNo = String(filters.studentNo || '').trim()
    const status = String(filters.status || '').trim()
    const verified = String(filters.verified || '').trim()

    const list = state.users
      .filter((user) => user.role !== 'admin')
      .filter((user) => {
        if (status === '已删除') return isSoftDeleted(user)
        if (isSoftDeleted(user)) return false
        return true
      })
      .filter((user) => !studentNo || String(user.studentNo || '').includes(studentNo))
      .filter((user) => !status || status === '已删除' || user.status === status)
      .filter((user) => {
        if (!verified) return true
        if (verified === 'verified') return !!user.verified
        if (verified === 'unverified') return !user.verified
        return true
      })
      .map((user) => {
        const listings = state.listings.filter((listing) => listing.sellerId === user.id)
        return {
          ...buildUserDto(user),
          totalPublished: listings.length,
          onSale: listings.filter((listing) => getListingDisplayStatus(state, listing) === LISTING_STATUS.PUBLISHED).length
        }
      })
      .sort((left, right) => parseDate(right.reg) - parseDate(left.reg))

    return { list, total: list.length }
  }

  async listAdminNotifications(adminAccount) {
    const state = await this.repository.read()
    if (!validateAdmin(state, adminAccount)) {
      throw createError(401, '管理员未登录')
    }

    const list = ensureArray(state.notifications)
      .map((notification) => ({
        ...buildNotificationDto(notification),
        userName: getUserById(state, notification.userId, { includeDeleted: true })?.name || '-'
      }))
      .sort((left, right) => parseDate(right.createdAt) - parseDate(left.createdAt))

    return { list, total: list.length }
  }

  async verifyCurrentUser(name) {
    const user = await this.repository.write((state) => {
      const currentUser = findUserByName(state, name)
      if (!currentUser) throw createError(401, '未登录')
      currentUser.verified = true
      currentUser.updatedAt = getToday()
      state.verifyRequests = ensureArray(state.verifyRequests)
      state.meta = state.meta || {}
      state.meta.nextVerifyId = Number(state.meta.nextVerifyId) || 1
      state.verifyRequests.unshift({
        id: `V${state.meta.nextVerifyId++}`,
        userId: currentUser.id,
        studentNo: currentUser.studentNo,
        realName: currentUser.name,
        verifyStatus: '通过',
        reviewerId: 'A01',
        reviewedAt: getToday(),
        rejectReason: null,
        createdAt: getToday()
      })
      return currentUser
    })
    await this.repository.updateAuthUserVerification(user)
    return buildUserDto(user)
  }

  async updateUserStatus(adminAccount, userId, status) {
    const updatedUser = await this.repository.write((state) => {
      if (!validateAdmin(state, adminAccount)) {
        throw createError(401, '管理员未登录')
      }
      const user = getUserById(state, userId, { includeDeleted: true })
      if (!user) throw createError(404, 'user not found')
      if (user.role === 'admin') throw createError(400, '不能修改管理员状态')
      if (isSoftDeleted(user)) throw createError(409, '用户已删除，无法再调整状态')

      const nextStatus = normalizeUserStatusStrict(status)
      user.status = nextStatus
      if (nextStatus === '禁用') {
        state.listings.forEach((listing) => {
          if (listing.sellerId === user.id && normalizeListingStatus(listing.status) === LISTING_STATUS.PUBLISHED) {
            listing.status = LISTING_STATUS.OFFLINE
            listing.updatedAt = getToday()
          }
        })
      }
      return user
    })
    await this.repository.updateAuthUserStatus(updatedUser)
    return buildUserDto(updatedUser)
  }

  async resetUserPassword(adminAccount, userId) {
    const resetPassword = '123456'
    const updatedUser = await this.repository.write((state) => {
      const admin = validateAdmin(state, adminAccount)
      if (!admin) throw createError(401, '管理员未登录')

      const user = getUserById(state, userId, { includeDeleted: true })
      if (!user) throw createError(404, 'user not found')
      if (user.role === 'admin') throw createError(400, '不能重置管理员密码')
      if (isSoftDeleted(user)) throw createError(409, '用户已删除，无法重置密码')

      user.password = resetPassword
      return user
    })

    await this.repository.updateAuthUserPassword(updatedUser.studentNo, resetPassword)
    return {
      userId: updatedUser.id,
      name: updatedUser.name,
      account: updatedUser.account || updatedUser.studentNo || '',
      password: resetPassword,
      message: '密码已重置为 123456，请提醒用户尽快登录后修改'
    }
  }

  async deleteUser(adminAccount, userId) {
    return this.repository.write((state) => {
      const admin = validateAdmin(state, adminAccount)
      if (!admin) throw createError(401, '管理员未登录')

      const user = getUserById(state, userId, { includeDeleted: true })
      if (!user) throw createError(404, 'user not found')
      if (user.role === 'admin') throw createError(400, '不能删除管理员用户')
      if (isSoftDeleted(user)) throw createError(409, '用户已删除，请勿重复操作')

      const deletedAt = getNow()
      const activeOrders = ensureArray(state.orders).filter((order) => (
        (order.buyerId === user.id || order.sellerId === user.id) &&
        isActiveOrderStatus(order.status)
      ))

      activeOrders.forEach((order) => {
        const previousStatus = normalizeOrderStatus(order.status)
        const listing = getListingById(state, order.listingId)
        const listingTitle = listing?.title || '该商品'

        order.status = ORDER_STATUS.CANCELLED
        order.cancelReason = '管理员删除用户'
        order.updatedAt = deletedAt

        if (normalizePaymentStatus(order.paymentStatus, previousStatus) !== PAYMENT_STATUS.PAID) {
          order.paymentStatus = PAYMENT_STATUS.UNPAID
        }

        appendOrderLog(state, order, previousStatus, ORDER_STATUS.CANCELLED, admin.id, '管理员删除用户')

        if (listing && listing.sellerId !== user.id) {
          listing.status = LISTING_STATUS.PUBLISHED
          listing.updatedAt = deletedAt
        }

        createNotificationsForUsers(state, [order.buyerId, order.sellerId], {
          type: 'system',
          title: '订单已取消',
          content: `订单 ${order.id} 已因管理员删除用户而自动取消，关联商品“${listingTitle}”已终止当前交易。`,
          createdAt: deletedAt,
          relatedListingId: order.listingId,
          relatedOrderId: order.id
        })
      })

      state.listings.forEach((listing) => {
        if (listing.sellerId !== user.id) return
        const status = normalizeListingStatus(listing.status)
        if ([LISTING_STATUS.PUBLISHED, LISTING_STATUS.PENDING].includes(status)) {
          listing.status = LISTING_STATUS.OFFLINE
          listing.updatedAt = deletedAt
        }
      })

      user.status = '禁用'
      user.deletedAt = deletedAt

      return buildUserDto(user)
    })
  }

  async getAdminDashboard(adminAccount, filters = {}) {
    const state = await this.repository.read()
    if (!validateAdmin(state, adminAccount)) {
      throw createError(401, '管理员未登录')
    }

    const dateFrom = String(filters.dateFrom || '').trim()
    const dateTo = String(filters.dateTo || '').trim()
    const inRange = (dateText) => {
      if (!dateText) return true
      if (dateFrom && dateText < dateFrom) return false
      if (dateTo && dateText > dateTo) return false
      return true
    }

    const studentUsers = state.users.filter((user) => user.role !== 'admin')
    const scopedListings = state.listings.filter((listing) => inRange(listing.createdAt))
    const scopedOrders = state.orders.filter((order) => inRange(order.paymentTime || order.updatedAt || order.createdAt))
    const recentListings = scopedListings.filter((listing) => {
      const diff = diffDaysFrom(listing.createdAt)
      return diff >= 0 && diff < 7
    })
    const tradedOrders = scopedOrders.filter((order) => isTradedOrderStatus(order))

    const itemsByDate = {}
    scopedListings.forEach((listing) => {
      if (!listing.createdAt) return
      itemsByDate[listing.createdAt] = (itemsByDate[listing.createdAt] || 0) + 1
    })

    const ordersByDate = {}
    tradedOrders.forEach((order) => {
      const key = order.paymentTime || order.updatedAt || order.createdAt
      if (!key) return
      ordersByDate[key] = (ordersByDate[key] || 0) + 1
    })

    return {
      totalUsers: studentUsers.length,
      newItems: recentListings.length,
      completedOrders: tradedOrders.length,
      pendingReview: scopedListings.filter((listing) => normalizeListingStatus(listing.status) === LISTING_STATUS.PENDING).length,
      todayItems: scopedListings.filter((listing) => listing.createdAt === getToday()).length,
      totalGMV: tradedOrders.reduce((sum, order) => sum + (Number(order.price) || 0), 0),
      orderStatusGroups: {
        pending: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.PENDING).length,
        confirmed: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.CONFIRMED).length,
        inProgress: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.IN_PROGRESS).length,
        completed: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.COMPLETED).length,
        cancelled: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.CANCELLED).length,
        rejected: scopedOrders.filter((order) => normalizeOrderStatus(order.status) === ORDER_STATUS.REJECTED).length
      },
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      trendSeries: getLastDays(7).map((day) => ({
        label: day.slice(5).replace('-', '/'),
        items: itemsByDate[day] || 0,
        orders: ordersByDate[day] || 0
      }))
    }
  }

  async listFavorites(currentUserName) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return []
    return listFavoritesFromState(state, user.id)
  }

  async listListings(query = {}) {
    const state = await this.repository.read()
    return applyListingFilters(state, state.listings, query)
  }

  async getListing(listingId) {
    const state = await this.repository.read()
    const listing = getListingById(state, listingId)
    if (!listing) throw createError(404, 'listing not found')
    return buildListingDto(state, listing)
  }

  async createListing(currentUserName, payload = {}) {
    return this.repository.write((state) => {
      const seller = findUserByName(state, currentUserName)
      if (!seller) throw createError(401, '未登录')

      const normalizedPayload = normalizeListingPayload(payload, {
        partial: false,
        fallbackCampus: String(seller.campus || '\u5317\u6821\u533a').trim() || '\u5317\u6821\u533a'
      })

      const listingNumericId = nextListingId(state)

      const listing = {
        id: `L${listingNumericId}`,
        numericId: listingNumericId,
        sellerId: seller.id,
        title: normalizedPayload.title,
        price: normalizedPayload.price,
        campus: normalizedPayload.campus,
        condition: normalizedPayload.condition,
        category: normalizedPayload.category,
        createdAt: getToday(),
        updatedAt: getToday(),
        desc: normalizedPayload.desc,
        tags: normalizedPayload.tags,
        shipping: normalizedPayload.shipping,
        method: normalizedPayload.method,
        views: 0,
        likes: 0,
        status: LISTING_STATUS.PENDING,
        images: normalizedPayload.images,
        reviewRemark: null
      }

      state.listings.unshift(listing)
      createNotification(state, seller.id, {
        type: 'system',
        title: '商品已提交审核',
        content: `你的“${listing.title}”已提交审核，请等待管理员处理。`,
        createdAt: getToday(),
        relatedListingId: listing.id
      })
      return buildListingDto(state, listing)
    })
  }

  async updateListing(currentUserName, listingId, payload = {}) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!listing) throw createError(404, 'listing not found')
      if (!user || (listing.sellerId !== user.id && user.role !== 'admin')) {
        throw createError(403, '无权限编辑该商品')
      }

      const normalizedPayload = normalizeListingPayload(payload, { partial: true })
      Object.assign(listing, normalizedPayload, { updatedAt: getToday() })
      return buildListingDto(state, listing)
    })
  }

  async updateListingStatus(currentUserName, listingId, status) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!listing) throw createError(404, 'listing not found')
      if (!user || (listing.sellerId !== user.id && user.role !== 'admin')) {
        throw createError(403, '无权限修改该商品状态')
      }
      if (status !== undefined && status !== null && String(status).trim() !== '') {
        const nextStatus = normalizeListingStatusStrict(status)
        if (![LISTING_STATUS.PENDING, LISTING_STATUS.PUBLISHED, LISTING_STATUS.OFFLINE].includes(nextStatus)) {
          throw createError(400, '当前接口仅支持 待审核 / 上架 / 下架', [{ field: 'status', code: 'invalid_enum', message: 'status must be PENDING, PUBLISHED or OFFLINE' }])
        }
        listing.status = nextStatus
      }
      listing.updatedAt = getToday()
      return buildListingDto(state, listing)
    })
  }

  async reviewListing(adminAccount, listingId, status, reason = null) {
    return this.repository.write((state) => {
      const admin = validateAdmin(state, adminAccount)
      if (!admin) throw createError(401, '管理员未登录')

      const listing = getListingById(state, listingId)
      if (!listing) throw createError(404, 'listing not found')

      const nextStatus = normalizeListingStatusStrict(status)
      if (![LISTING_STATUS.PUBLISHED, LISTING_STATUS.REJECTED].includes(nextStatus)) {
        throw createError(400, '审核状态仅支持 上架 / 驳回', [{ field: 'status', code: 'invalid_enum', message: 'review status must be PUBLISHED or REJECTED' }])
      }
      listing.status = nextStatus
      listing.reviewRemark = reason || null
      listing.updatedAt = getToday()

      createNotification(state, listing.sellerId, {
        type: 'system',
        title: nextStatus === LISTING_STATUS.PUBLISHED ? '商品审核通过' : '商品审核未通过',
        content: nextStatus === LISTING_STATUS.PUBLISHED
          ? `你的“${listing.title}”已审核通过并上架。`
          : `你的“${listing.title}”审核未通过${reason ? `，原因：${reason}` : '。'}`,
        createdAt: getToday(),
        relatedListingId: listing.id
      })

      return buildListingDto(state, listing)
    })
  }

  async markListingViolation(adminAccount, listingId, reason) {
    return this.repository.write((state) => {
      const admin = validateAdmin(state, adminAccount)
      if (!admin) throw createError(401, '管理员未登录')

      const listing = getListingById(state, listingId)
      if (!listing) throw createError(404, 'listing not found')

      const violationReason = String(reason || '').trim()
      if (!violationReason) throw createError(400, '违规原因不能为空')

      listing.status = LISTING_STATUS.OFFLINE
      listing.reviewRemark = violationReason
      listing.updatedAt = getToday()

      createNotification(state, listing.sellerId, {
        type: 'system',
        title: '商品因违规被下架',
        content: `你的“${listing.title}”已被管理员强制下架，原因：${violationReason}`,
        createdAt: getToday(),
        relatedListingId: listing.id
      })

      return buildListingDto(state, listing)
    })
  }

  async addFavorite(currentUserName, listingId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!user) throw createError(401, '未登录')
      if (!listing) throw createError(404, 'listing not found')

      const targetId = listingIdFromParam(listingId)
      state.favorites = ensureArray(state.favorites)
      if (!state.favorites.find((item) => item.userId === user.id && item.listingId === targetId)) {
        state.favorites.push({ userId: user.id, listingId: targetId })
      }
      return listFavoritesFromState(state, user.id)
    })
  }

  async removeFavorite(currentUserName, listingId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) throw createError(401, '未登录')
      const targetId = listingIdFromParam(listingId)
      state.favorites = ensureArray(state.favorites).filter((item) => !(item.userId === user.id && item.listingId === targetId))
      return listFavoritesFromState(state, user.id)
    })
  }

  async createOrder(currentUserName, listingId) {
    return this.repository.write((state) => {
      const buyer = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!buyer) throw createError(401, '未登录')
      if (!listing) throw createError(404, 'listing not found')
      if (buyer.id === listing.sellerId) throw createError(400, '不能购买自己发布的商品')
      if (normalizeListingStatus(listing.status) !== LISTING_STATUS.PUBLISHED) throw createError(400, '商品当前不可下单')
      if (getActiveOrderForListing(state, listing.id)) {
        throw createError(409, '该商品已存在进行中的订单')
      }

      const order = {
        id: nextOrderId(state),
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        price: Number(listing.price) || 0,
        status: ORDER_STATUS.PENDING,
        createdAt: getToday(),
        updatedAt: getToday(),
        method: listing.method || '面交',
        address: `${listing.campus}图书馆门口`,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        paymentMethod: '',
        paymentTime: null,
        rejectReason: null,
        cancelReason: null
      }
      state.orders = ensureArray(state.orders)
      state.orders.unshift(order)
      appendOrderLog(state, order, null, ORDER_STATUS.PENDING, buyer.id, '创建订单')

      createNotification(state, buyer.id, {
        type: 'system',
        title: '订单已创建',
        content: `你已对“${listing.title}”发起购买，请继续与卖家沟通。`,
        createdAt: getToday(),
        relatedListingId: listing.id,
        relatedOrderId: order.id
      })
      createNotification(state, listing.sellerId, {
        type: 'system',
        title: '收到新的购买请求',
        content: `“${listing.title}”收到了新的购买请求，请尽快确认订单。`,
        createdAt: getToday(),
        relatedListingId: listing.id,
        relatedOrderId: order.id
      })

      return buildOrderDto(state, order)
    })
  }

  async listOrders(currentUserName, role, status) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return { list: [], total: 0 }

    let result = ensureArray(state.orders).filter((order) => (
      String(role || 'buyer') === 'seller' ? order.sellerId === user.id : order.buyerId === user.id
    ))

    if (status) {
      result = result.filter((order) => normalizeOrderStatus(order.status) === normalizeOrderStatus(status))
    }

    result.sort((left, right) => parseDate(right.updatedAt || right.createdAt) - parseDate(left.updatedAt || left.createdAt))
    return {
      list: result.map((order) => buildOrderDto(state, order)),
      total: result.length
    }
  }

  async getOrder(currentUserName, orderId) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    const order = ensureArray(state.orders).find((item) => item.id === orderId)
    if (!order) throw createError(404, 'order not found')
    assertOrderVisibleToUser(user, order)
    return buildOrderDto(state, order)
  }

  async getOrderLogs(currentUserName, orderId) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    const order = ensureArray(state.orders).find((item) => item.id === orderId)
    if (!order) throw createError(404, 'order not found')
    assertOrderVisibleToUser(user, order)

    const list = ensureArray(state.orderLogs)
      .filter((log) => log.orderId === orderId)
      .sort((left, right) => parseDate(right.createdAt) - parseDate(left.createdAt))
      .map((log) => buildOrderLogDto(state, log))

    return { list, total: list.length }
  }

  async payOrder(currentUserName, orderId, paymentMethod) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const order = ensureArray(state.orders).find((item) => item.id === orderId)
      if (!order) throw createError(404, 'order not found')
      assertOrderVisibleToUser(user, order)
      if (user.role !== 'admin' && user.id !== order.buyerId) {
        throw createError(403, '只有买家可以付款')
      }
      if (normalizeOrderStatus(order.status) !== ORDER_STATUS.CONFIRMED) {
        throw createError(400, '当前订单状态不允许付款')
      }
      if (normalizePaymentStatus(order.paymentStatus, order.status) !== PAYMENT_STATUS.PENDING) {
        throw createError(400, '当前订单无需付款')
      }

      const channel = String(paymentMethod || '').trim()
      if (!channel) throw createError(400, '请选择付款方式')

      order.paymentStatus = PAYMENT_STATUS.PAID
      order.paymentMethod = channel
      order.paymentTime = getToday()
      const fromStatus = order.status
      order.status = ORDER_STATUS.IN_PROGRESS
      order.updatedAt = getToday()
      appendOrderLog(state, order, fromStatus, ORDER_STATUS.IN_PROGRESS, user.id, `买家已付款（${channel}）`)

      createNotification(state, order.sellerId, {
        type: 'system',
        title: '付款成功',
        content: `订单 ${order.id} 已完成付款，请准备交付商品。`,
        createdAt: getToday(),
        relatedListingId: order.listingId,
        relatedOrderId: order.id
      })
      createNotification(state, order.buyerId, {
        type: 'system',
        title: '付款成功',
        content: `订单 ${order.id} 已完成付款，请等待卖家交付商品。`,
        createdAt: getToday(),
        relatedListingId: order.listingId,
        relatedOrderId: order.id
      })

      const listing = getListingById(state, order.listingId)
      if (listing) listing.updatedAt = getToday()
      return buildOrderDto(state, order)
    })
  }

  async updateOrderStatus(currentUserName, orderId, status, reason = '') {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const order = ensureArray(state.orders).find((item) => item.id === orderId)
      if (!order) throw createError(404, 'order not found')
      assertOrderVisibleToUser(user, order)

      const nextStatus = normalizeOrderStatus(status)
      const currentStatus = normalizeOrderStatus(order.status)
      assertAllowedOrderTransition(currentStatus, nextStatus)

      const normalizedReason = String(reason || '').trim()
      const listing = getListingById(state, order.listingId)
      const listingTitle = listing?.title || '该商品'

      if (nextStatus === ORDER_STATUS.CONFIRMED && user.role !== 'admin' && user.id !== order.sellerId) {
        throw createError(403, '只有卖家可以确认订单')
      }
      if (nextStatus === ORDER_STATUS.REJECTED && user.role !== 'admin' && user.id !== order.sellerId) {
        throw createError(403, '只有卖家可以拒绝订单')
      }
      if (
        nextStatus === ORDER_STATUS.COMPLETED &&
        user.role !== 'admin' &&
        user.id !== order.sellerId &&
        user.id !== order.buyerId
      ) {
        throw createError(403, '只有买卖双方可以完成订单')
      }
      if (nextStatus === ORDER_STATUS.COMPLETED && normalizePaymentStatus(order.paymentStatus, order.status) !== PAYMENT_STATUS.PAID) {
        throw createError(400, '订单未付款，无法完成')
      }
      if (nextStatus === ORDER_STATUS.CANCELLED && user.role !== 'admin' && user.id !== order.buyerId && user.id !== order.sellerId) {
        throw createError(403, '无权限取消订单')
      }

      order.status = nextStatus
      order.updatedAt = getToday()

      if (nextStatus === ORDER_STATUS.CONFIRMED) {
        order.paymentStatus = PAYMENT_STATUS.PENDING
      }
      if (nextStatus === ORDER_STATUS.REJECTED) {
        order.rejectReason = normalizedReason || order.rejectReason || null
        order.paymentStatus = PAYMENT_STATUS.UNPAID
      }
      if (nextStatus === ORDER_STATUS.CANCELLED) {
        order.cancelReason = normalizedReason || order.cancelReason || null
        if (normalizePaymentStatus(order.paymentStatus, order.status) !== PAYMENT_STATUS.PAID) {
          order.paymentStatus = PAYMENT_STATUS.UNPAID
        }
      }

      appendOrderLog(
        state,
        order,
        currentStatus,
        nextStatus,
        user.id,
        normalizedReason ? `状态变更，原因：${normalizedReason}` : '状态变更'
      )

      if (nextStatus === ORDER_STATUS.CONFIRMED) {
        createNotification(state, order.buyerId, {
          type: 'system',
          title: '卖家已确认订单',
          content: `“${listingTitle}”的订单已确认，请尽快完成付款。`,
          createdAt: getToday(),
          relatedListingId: order.listingId,
          relatedOrderId: order.id
        })
      }

      if (nextStatus === ORDER_STATUS.REJECTED) {
        if (listing) {
          listing.status = LISTING_STATUS.PUBLISHED
          listing.updatedAt = getToday()
        }
        createNotification(state, order.buyerId, {
          type: 'system',
          title: '订单已拒绝',
          content: `“${listingTitle}”的订单已被卖家拒绝${normalizedReason ? `，原因：${normalizedReason}` : '。'}`,
          createdAt: getToday(),
          relatedListingId: order.listingId,
          relatedOrderId: order.id
        })
      }

      if (nextStatus === ORDER_STATUS.CANCELLED) {
        if (listing) {
          listing.status = LISTING_STATUS.PUBLISHED
          listing.updatedAt = getToday()
        }
        createNotificationsForUsers(state, [order.buyerId, order.sellerId], {
          type: 'system',
          title: '订单已取消',
          content: `“${listingTitle}”的订单已取消${normalizedReason ? `，原因：${normalizedReason}` : '。'}`,
          createdAt: getToday(),
          relatedListingId: order.listingId,
          relatedOrderId: order.id
        })
      }

      if (nextStatus === ORDER_STATUS.COMPLETED) {
        if (listing) {
          listing.status = LISTING_STATUS.OFFLINE
          listing.updatedAt = getToday()
        }
        createNotificationsForUsers(state, [order.buyerId, order.sellerId], {
          type: 'system',
          title: '订单已完成',
          content: `“${listingTitle}”的订单已完成，交易结束。`,
          createdAt: getToday(),
          relatedListingId: order.listingId,
          relatedOrderId: order.id
        })
      }

      return buildOrderDto(state, order)
    })
  }

  async listConversations(currentUserName) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return { list: [], total: 0 }

    const list = ensureArray(state.conversations)
      .filter((conversation) => conversation.buyerId === user.id || conversation.sellerId === user.id)
      .sort((left, right) => {
        const leftPinned = left.buyerId === user.id ? Number(left.buyerPinned || 0) : Number(left.sellerPinned || 0)
        const rightPinned = right.buyerId === user.id ? Number(right.buyerPinned || 0) : Number(right.sellerPinned || 0)
        if (rightPinned !== leftPinned) return rightPinned - leftPinned
        return parseDate(right.updatedAt) - parseDate(left.updatedAt)
      })
      .map((conversation) => buildConversationSummary(state, conversation, user.id))

    return { list, total: list.length }
  }

  async updateConversationPin(currentUserName, conversationId, pinned) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const conversation = ensureArray(state.conversations).find((item) => item.id === conversationId)
      assertConversationVisibleToUser(user, conversation)

      if (conversation.buyerId === user.id) conversation.buyerPinned = pinned ? 1 : 0
      if (conversation.sellerId === user.id) conversation.sellerPinned = pinned ? 1 : 0
      return buildConversationSummary(state, conversation, user.id)
    })
  }

  async createConversation(currentUserName, listingId) {
    return this.repository.write((state) => {
      const buyer = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!buyer) throw createError(401, '未登录')
      if (!listing) throw createError(404, 'listing not found')

      let conversation = ensureArray(state.conversations).find((item) => (
        item.listingId === listing.id &&
        item.buyerId === buyer.id &&
        item.sellerId === listing.sellerId
      ))

      if (!conversation) {
        conversation = {
          id: nextConversationId(state),
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          buyerPinned: 0,
          sellerPinned: 0,
          updatedAt: getToday(),
          messages: [
            {
              id: nextMessageId(state),
              senderId: listing.sellerId,
              text: '你好，商品还在，可以继续沟通。',
              read: false,
              sentAt: getToday(),
              messageType: 'text'
            }
          ]
        }
        state.conversations.unshift(conversation)
      }

      return buildConversationSummary(state, conversation, buyer.id)
    })
  }

  async getConversationMessages(currentUserName, conversationId) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    const conversation = ensureArray(state.conversations).find((item) => item.id === conversationId)
    assertConversationVisibleToUser(user, conversation)

    return {
      list: ensureArray(conversation.messages).map((message) => buildMessageDto(conversation, message, user.id)),
      total: ensureArray(conversation.messages).length
    }
  }

  async markConversationRead(currentUserName, conversationId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const conversation = ensureArray(state.conversations).find((item) => item.id === conversationId)
      assertConversationVisibleToUser(user, conversation)

      ensureArray(conversation.messages).forEach((message) => {
        if (message.senderId !== user.id) message.read = true
      })
      return buildConversationSummary(state, conversation, user.id)
    })
  }

  async sendMessage(currentUserName, conversationId, text) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const conversation = ensureArray(state.conversations).find((item) => item.id === conversationId)
      assertConversationVisibleToUser(user, conversation)

      const messageText = String(text || '').trim()
      if (!messageText) throw createError(400, '消息内容不能为空')

      const message = {
        id: nextMessageId(state),
        senderId: user.id,
        text: messageText,
        read: false,
        sentAt: getToday(),
        messageType: 'text'
      }
      conversation.messages.push(message)
      conversation.updatedAt = getToday()
      return buildMessageDto(conversation, message, user.id)
    })
  }

  async markMessageRead(currentUserName, messageId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) throw createError(401, '未登录')

      for (const conversation of ensureArray(state.conversations)) {
        if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) continue
        const message = ensureArray(conversation.messages).find((item) => item.id === messageId)
        if (!message) continue
        message.read = true
        return buildMessageDto(conversation, message, user.id)
      }

      throw createError(404, 'message not found')
    })
  }

  async listNotifications(currentUserName) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return { list: [], total: 0 }

    const list = ensureArray(state.notifications)
      .filter((notification) => notification.userId === user.id)
      .sort((left, right) => parseDate(right.createdAt) - parseDate(left.createdAt))
      .map(buildNotificationDto)

    return { list, total: list.length }
  }

  async markNotificationRead(currentUserName, notificationId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) throw createError(401, '未登录')

      const notification = ensureArray(state.notifications).find((item) => item.id === notificationId && item.userId === user.id)
      if (!notification) throw createError(404, 'notification not found')

      notification.read = true
      return buildNotificationDto(notification)
    })
  }
}
