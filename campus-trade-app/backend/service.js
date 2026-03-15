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

function parseDate(value) {
  if (!value) return new Date('1970-01-01T00:00:00')
  if (value instanceof Date) return value
  const normalized = String(value).includes('T') ? String(value) : `${value}T00:00:00`
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

function createError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
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

function findUserByName(state, name) {
  const keyword = String(name || '').trim()
  if (!keyword) return null
  return state.users.find((user) => (
    user.name === keyword ||
    user.account === keyword ||
    user.studentNo === keyword
  )) || null
}

function validateAdmin(state, account) {
  const admin = findUserByName(state, account)
  return admin && admin.role === 'admin' && admin.status === '正常' ? admin : null
}

function getUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null
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
    status: user.status || '正常',
    reg: user.reg || getToday(),
    campus: user.campus || '未设置校区',
    credit: Number(user.credit) || 5,
    verified: !!user.verified,
    role: user.role || 'student'
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
  const seller = getUserById(state, listing.sellerId)
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
  const seller = getUserById(state, order.sellerId)
  const buyer = getUserById(state, order.buyerId)
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
  const operator = getUserById(state, log.operatorId)
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
  const peer = getUserById(state, peerId)
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

export class DomainService {
  constructor(repository) {
    this.repository = repository
  }

  async health() {
    return { service: 'campus-trade-api', time: new Date().toISOString() }
  }

  async register(username, studentNo, password) {
    const actualName = String(username || '').trim()
    const actualStudentNo = String(studentNo || '').trim()
    const actualPassword = String(password || '').trim()
    if (!actualName || !actualStudentNo || !actualPassword) {
      throw createError(400, '姓名、学号和密码不能为空')
    }
    if (actualPassword.length < 6) {
      throw createError(400, '密码长度不能少于 6 位')
    }

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
    return state.users.filter((user) => user.role !== 'admin').map(buildUserDto)
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
      .filter((user) => !studentNo || String(user.studentNo || '').includes(studentNo))
      .filter((user) => !status || user.status === status)
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
        userName: getUserById(state, notification.userId)?.name || '-'
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
      const user = getUserById(state, userId)
      if (!user || user.role === 'admin') throw createError(404, 'user not found')

      user.status = status
      if (status === '禁用') {
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

      const listingNumericId = nextListingId(state)

      const listing = {
        id: `L${listingNumericId}`,
        numericId: listingNumericId,
        sellerId: seller.id,
        title: String(payload.title || '').trim(),
        price: Number(payload.price) || 0,
        campus: String(payload.campus || seller.campus || '北校区').trim() || '北校区',
        condition: Number(payload.condition) || 9,
        category: String(payload.category || '数码').trim() || '数码',
        createdAt: getToday(),
        updatedAt: getToday(),
        desc: String(payload.desc || '').trim(),
        tags: ensureArray(payload.tags),
        shipping: String(payload.shipping || '包邮').trim() || '包邮',
        method: String(payload.method || '面交优先').trim() || '面交优先',
        views: 0,
        likes: 0,
        status: LISTING_STATUS.PENDING,
        images: ensureArray(payload.images),
        reviewRemark: null
      }

      if (!listing.title) throw createError(400, '商品标题不能为空')
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

      const nextTags = ensureArray(payload.tags)
      Object.assign(listing, {
        title: payload.title ?? listing.title,
        price: payload.price !== undefined ? Number(payload.price) || 0 : listing.price,
        condition: payload.condition !== undefined ? Number(payload.condition) || listing.condition : listing.condition,
        desc: payload.desc ?? listing.desc,
        images: payload.images ? ensureArray(payload.images) : listing.images,
        tags: nextTags.length ? nextTags : listing.tags,
        shipping: payload.shipping ?? listing.shipping,
        method: payload.method ?? listing.method,
        updatedAt: getToday()
      })
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
      listing.status = normalizeListingStatus(status || listing.status)
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

      const nextStatus = normalizeListingStatus(status)
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
