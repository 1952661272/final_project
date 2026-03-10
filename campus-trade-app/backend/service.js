function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function formatDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function getToday() {
  return formatDate(new Date())
}

function nowLabel() {
  return '刚刚'
}

function parseDate(value) {
  if (!value) return new Date('1970-01-01')
  return new Date(`${value}T00:00:00`)
}

function isActiveOrderStatus(status) {
  return ['待确认', '已确认', '进行中'].includes(status)
}

function buildRelativeTime(dateText) {
  const created = parseDate(dateText)
  const diff = Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
  if (diff === 0) return '今天'
  if (diff === 1) return '1天前'
  if (diff < 7) return `${diff}天前`
  return dateText
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function listingIdFromParam(value) {
  const stringValue = String(value || '')
  return stringValue.startsWith('L') ? stringValue : `L${stringValue}`
}

function findUserByName(state, name) {
  const keyword = String(name || '').trim()
  if (!keyword) return null
  return state.users.find((user) => user.name === keyword || user.account === keyword || user.studentNo === keyword) || null
}

function getUserByName(state, name) {
  const user = findUserByName(state, name)
  if (!user) {
    const id = `U${String(state.users.filter((candidate) => candidate.role !== 'admin').length + 1).padStart(2, '0')}`
    const created = {
      id,
      name: String(name || '').trim(),
      account: String(name || '').trim(),
      password: '123456',
      status: '正常',
      campus: '北校区',
      credit: 4.6,
      verified: false,
      reg: getToday(),
      role: 'student',
      studentNo: `2026${String(state.users.length + 1).padStart(4, '0')}`
    }
    state.users.push(created)
    return created
  }
  return user
}

function getUserById(state, userId) {
  return state.users.find((user) => user.id === userId) || null
}

function getListingById(state, listingId) {
  return state.listings.find((listing) => listing.id === listingIdFromParam(listingId)) || null
}

function buildListingDto(state, listing) {
  const seller = getUserById(state, listing.sellerId)
  return {
    id: listing.numericId || Number(String(listing.id).replace(/^L/, '')),
    title: listing.title,
    price: listing.price,
    campus: listing.campus,
    condition: listing.condition,
    category: listing.category,
    time: buildRelativeTime(listing.createdAt),
    createdAt: listing.createdAt,
    seller: seller?.name || '未知用户',
    desc: listing.desc,
    tags: ensureArray(listing.tags),
    shipping: listing.shipping,
    method: listing.method,
    views: listing.views,
    likes: listing.likes,
    status: listing.status,
    images: ensureArray(listing.images)
  }
}

function buildUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    status: user.status,
    reg: user.reg,
    campus: user.campus,
    credit: user.credit,
    verified: !!user.verified,
    role: user.role
  }
}

function buildOrderDto(state, order) {
  const listing = getListingById(state, order.listingId)
  const seller = getUserById(state, order.sellerId)
  const buyer = getUserById(state, order.buyerId)
  return {
    id: order.id,
    item: listing?.title || '未知商品',
    price: order.price,
    status: order.status,
    time: order.updatedAt || order.createdAt,
    createdAt: order.createdAt,
    method: order.method,
    address: order.address,
    seller: seller?.name || '-',
    buyer: buyer?.name || '-'
  }
}

function buildConversationSummary(state, conversation, currentUserId) {
  const peerId = conversation.buyerId === currentUserId ? conversation.sellerId : conversation.buyerId
  const peer = getUserById(state, peerId)
  const listing = getListingById(state, conversation.listingId)
  const messages = ensureArray(conversation.messages)
  const lastMessage = messages[messages.length - 1]
  return {
    id: conversation.id,
    name: peer?.name || '未知用户',
    peerUser: peer ? buildUserDto(peer) : null,
    listingId: Number(String(conversation.listingId).replace(/^L/, '')),
    listingTitle: listing?.title || '未知商品',
    lastMessage: lastMessage ? buildMessageDto(state, conversation, lastMessage, currentUserId) : null,
    messageCount: messages.length
  }
}

function buildMessageDto(state, conversation, message, currentUserId) {
  return {
    id: message.id,
    from: message.senderId === currentUserId ? 'me' : 'other',
    text: message.text,
    time: message.sentAt || conversation.updatedAt || getToday(),
    read: !!message.read
  }
}

function applyListingFilters(state, listings, query = {}) {
  const keyword = String(query.keyword || '').trim().toLowerCase()
  const category = String(query.category || '').trim()
  const campus = String(query.campus || '').trim()
  const price = String(query.price || '').trim()
  const condition = String(query.condition || '').trim()
  const sort = String(query.sort || '最新').trim()
  const statusFilter = String(query.status || '').trim()
  const sellerName = String(query.sellerName || '').trim()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 100)))
  const statusValues = statusFilter ? statusFilter.split(',').map((value) => value.trim()).filter(Boolean) : []

  let result = listings.slice()

  if (statusValues.length > 0) {
    result = result.filter((listing) => statusValues.includes(listing.status))
  }
  if (keyword) {
    result = result.filter((listing) => {
      return listing.title.toLowerCase().includes(keyword) || String(listing.desc || '').toLowerCase().includes(keyword)
    })
  }
  if (category && category !== '全部') result = result.filter((listing) => listing.category === category)
  if (campus && campus !== '全部') result = result.filter((listing) => listing.campus === campus)
  if (sellerName) {
    result = result.filter((listing) => getUserById(state, listing.sellerId)?.name === sellerName)
  }
  if (price && price !== '全部') {
    result = result.filter((listing) => {
      if (price === '0-100') return listing.price <= 100
      if (price === '100-500') return listing.price > 100 && listing.price <= 500
      if (price === '500-2000') return listing.price > 500 && listing.price <= 2000
      if (price === '2000+') return listing.price > 2000
      return true
    })
  }
  if (condition && condition !== '全部') {
    result = result.filter((listing) => {
      if (condition === '9-10') return listing.condition >= 9
      if (condition === '8-9') return listing.condition >= 8 && listing.condition < 9
      if (condition === '7-8') return listing.condition >= 7 && listing.condition < 8
      if (condition === '7以下') return listing.condition < 7
      return true
    })
  }

  result.sort((a, b) => {
    if (sort === '价格升序') return a.price - b.price
    if (sort === '价格降序') return b.price - a.price
    return parseDate(b.createdAt) - parseDate(a.createdAt)
  })

  const total = result.length
  const sliced = result.slice((page - 1) * pageSize, page * pageSize)
  return {
    list: sliced.map((listing) => buildListingDto(state, listing)),
    page,
    pageSize,
    total
  }
}

function validateAdmin(state, account) {
  const admin = findUserByName(state, account)
  return admin && admin.role === 'admin' && admin.status === '正常' ? admin : null
}

function assertAllowedOrderTransition(fromStatus, toStatus) {
  const allowed = {
    待确认: ['已确认', '进行中', '已取消', '已拒绝'],
    已确认: ['进行中', '已完成', '已取消'],
    进行中: ['已完成', '已取消'],
    已完成: [],
    已取消: [],
    已拒绝: []
  }
  if (!(allowed[fromStatus] || []).includes(toStatus)) {
    const error = new Error(`非法订单状态迁移: ${fromStatus} -> ${toStatus}`)
    error.status = 400
    throw error
  }
}

export class DomainService {
  constructor(repository) {
    this.repository = repository
  }

  async health() {
    return { service: 'campus-trade-api', time: new Date().toISOString() }
  }

  async login(name) {
    return this.repository.write((state) => {
      const actualName = String(name || '').trim() || '张同学'
      const user = getUserByName(state, actualName)
      if (user.status === '禁用') {
        const error = new Error('该账号已被禁用，请联系管理员')
        error.status = 403
        throw error
      }
      return buildUserDto(user)
    })
  }

  async adminLogin(account, password) {
    const state = await this.repository.read()
    const admin = validateAdmin(state, account)
    if (!admin || String(password || '').trim() !== admin.password) {
      const error = new Error('管理员账号或密码错误')
      error.status = 401
      throw error
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
    if (!user) {
      const error = new Error('未登录')
      error.status = 401
      throw error
    }
    return buildUserDto(user)
  }

  async listUsers() {
    const state = await this.repository.read()
    return state.users
      .filter((user) => user.role !== 'admin')
      .map((user) => buildUserDto(user))
  }

  async verifyCurrentUser(name) {
    return this.repository.write((state) => {
      const user = findUserByName(state, name)
      if (!user) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      user.verified = true
      state.verifyRequests.push({
        id: `V${state.meta.nextVerifyId++}`,
        userId: user.id,
        studentNo: user.studentNo,
        realName: user.name,
        verifyStatus: '通过',
        createdAt: getToday()
      })
      return buildUserDto(user)
    })
  }

  async updateUserStatus(adminAccount, userId, status) {
    return this.repository.write((state) => {
      if (!validateAdmin(state, adminAccount)) {
        const error = new Error('管理员未登录')
        error.status = 401
        throw error
      }
      const user = getUserById(state, userId)
      if (!user || user.role === 'admin') {
        const error = new Error('user not found')
        error.status = 404
        throw error
      }
      user.status = status
      if (status === '禁用') {
        state.listings.forEach((listing) => {
          if (listing.sellerId === user.id && listing.status === '上架') {
            listing.status = '下架'
            listing.updatedAt = getToday()
          }
        })
      }
      return buildUserDto(user)
    })
  }

  async listListings(query) {
    const state = await this.repository.read()
    return applyListingFilters(state, state.listings, query)
  }

  async getListing(listingId) {
    const state = await this.repository.read()
    const listing = getListingById(state, listingId)
    if (!listing) {
      const error = new Error('listing not found')
      error.status = 404
      throw error
    }
    listing.views += 1
    return buildListingDto(state, listing)
  }

  async createListing(currentUserName, payload) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      const numericId = state.meta.nextListingId++
      const listing = {
        id: `L${numericId}`,
        numericId,
        sellerId: user.id,
        title: payload.title,
        price: Number(payload.price) || 0,
        campus: payload.campus || user.campus,
        condition: Number(payload.condition) || 9,
        category: payload.category || '数码',
        createdAt: getToday(),
        updatedAt: getToday(),
        desc: payload.desc || '暂无描述',
        tags: ensureArray(payload.tags).filter(Boolean),
        shipping: payload.shipping || '包邮',
        method: payload.method || '面交优先',
        views: 0,
        likes: 0,
        status: '待审核',
        images: ensureArray(payload.images),
        reviewRemark: null
      }
      state.listings.unshift(listing)
      return buildListingDto(state, listing)
    })
  }

  async updateListing(currentUserName, listingId, payload) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }
      if (!user || (listing.sellerId !== user.id && user.role !== 'admin')) {
        const error = new Error('无权限编辑该商品')
        error.status = 403
        throw error
      }

      const nextTags = ensureArray(payload.tags)
      Object.assign(listing, {
        title: payload.title ?? listing.title,
        price: payload.price !== undefined ? Number(payload.price) || 0 : listing.price,
        condition: payload.condition !== undefined ? Number(payload.condition) || listing.condition : listing.condition,
        desc: payload.desc ?? listing.desc,
        images: payload.images ? ensureArray(payload.images) : listing.images,
        tags: nextTags.length > 0 ? nextTags : listing.tags,
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
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }
      if (!user || (listing.sellerId !== user.id && user.role !== 'admin')) {
        const error = new Error('无权限修改该商品状态')
        error.status = 403
        throw error
      }
      listing.status = status
      listing.updatedAt = getToday()
      return buildListingDto(state, listing)
    })
  }

  async reviewListing(adminAccount, listingId, status, reason = null) {
    return this.repository.write((state) => {
      if (!validateAdmin(state, adminAccount)) {
        const error = new Error('管理员未登录')
        error.status = 401
        throw error
      }
      const listing = getListingById(state, listingId)
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }
      listing.status = status
      listing.reviewRemark = reason
      listing.updatedAt = getToday()
      return buildListingDto(state, listing)
    })
  }

  async listFavorites(currentUserName) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return []
    return state.favorites
      .filter((favorite) => favorite.userId === user.id)
      .map((favorite) => Number(String(favorite.listingId).replace(/^L/, '')))
  }

  async addFavorite(currentUserName, listingId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!user) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }
      const id = listingIdFromParam(listingId)
      if (!state.favorites.find((favorite) => favorite.userId === user.id && favorite.listingId === id)) {
        state.favorites.push({ userId: user.id, listingId: id })
      }
      return this.listFavoritesFromState(state, user.id)
    })
  }

  async removeFavorite(currentUserName, listingId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      const id = listingIdFromParam(listingId)
      state.favorites = state.favorites.filter((favorite) => !(favorite.userId === user.id && favorite.listingId === id))
      return this.listFavoritesFromState(state, user.id)
    })
  }

  listFavoritesFromState(state, userId) {
    return state.favorites
      .filter((favorite) => favorite.userId === userId)
      .map((favorite) => Number(String(favorite.listingId).replace(/^L/, '')))
  }

  async createOrder(currentUserName, listingId) {
    return this.repository.write((state) => {
      const buyer = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!buyer) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }
      if (listing.status !== '上架') {
        const error = new Error('商品当前不可下单')
        error.status = 400
        throw error
      }
      const activeOrder = state.orders.find((order) => order.listingId === listing.id && isActiveOrderStatus(order.status))
      if (activeOrder) {
        const error = new Error('该商品已存在进行中的订单')
        error.status = 409
        throw error
      }

      const orderId = `O${Date.now()}${state.meta.nextOrderSeq++}`
      const order = {
        id: orderId,
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        price: listing.price,
        status: '待确认',
        createdAt: getToday(),
        updatedAt: getToday(),
        method: listing.method || '面交',
        address: `${listing.campus}图书馆门口`
      }
      state.orders.unshift(order)
      state.orderLogs.unshift({
        id: `OL${state.meta.nextOrderLogId++}`,
        orderId: order.id,
        fromStatus: null,
        toStatus: '待确认',
        operatorId: buyer.id,
        note: '创建订单',
        createdAt: getToday()
      })
      return buildOrderDto(state, order)
    })
  }

  async listOrders(currentUserName, role, status) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return { list: [], total: 0 }
    let result = state.orders.filter((order) => role === 'seller' ? order.sellerId === user.id : order.buyerId === user.id)
    if (status) result = result.filter((order) => order.status === status)
    return {
      list: result.map((order) => buildOrderDto(state, order)),
      total: result.length
    }
  }

  async getOrder(currentUserName, orderId) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    const order = state.orders.find((candidate) => candidate.id === orderId)
    if (!order || !user || (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== 'admin')) {
      const error = new Error('order not found')
      error.status = 404
      throw error
    }
    return buildOrderDto(state, order)
  }

  async updateOrderStatus(currentUserName, orderId, status) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const order = state.orders.find((candidate) => candidate.id === orderId)
      if (!order) {
        const error = new Error('order not found')
        error.status = 404
        throw error
      }
      if (!user || (order.buyerId !== user.id && order.sellerId !== user.id && user.role !== 'admin')) {
        const error = new Error('无权限修改该订单')
        error.status = 403
        throw error
      }

      assertAllowedOrderTransition(order.status, status)
      const fromStatus = order.status
      order.status = status
      order.updatedAt = getToday()
      state.orderLogs.unshift({
        id: `OL${state.meta.nextOrderLogId++}`,
        orderId: order.id,
        fromStatus,
        toStatus: status,
        operatorId: user.id,
        note: '订单状态更新',
        createdAt: getToday()
      })

      if (status === '已完成') {
        const listing = getListingById(state, order.listingId)
        if (listing) {
          listing.status = '下架'
          listing.updatedAt = getToday()
        }
      }
      return buildOrderDto(state, order)
    })
  }

  async listConversations(currentUserName) {
    const state = await this.repository.read()
    const user = findUserByName(state, currentUserName)
    if (!user) return { list: [], total: 0 }
    const result = state.conversations
      .filter((conversation) => conversation.buyerId === user.id || conversation.sellerId === user.id)
      .sort((a, b) => parseDate(b.updatedAt) - parseDate(a.updatedAt))
    return {
      list: result.map((conversation) => buildConversationSummary(state, conversation, user.id)),
      total: result.length
    }
  }

  async createConversation(currentUserName, listingId) {
    return this.repository.write((state) => {
      const buyer = findUserByName(state, currentUserName)
      const listing = getListingById(state, listingId)
      if (!buyer) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      if (!listing) {
        const error = new Error('listing not found')
        error.status = 404
        throw error
      }

      let conversation = state.conversations.find((candidate) => {
        return candidate.listingId === listing.id && candidate.buyerId === buyer.id && candidate.sellerId === listing.sellerId
      })
      if (!conversation) {
        conversation = {
          id: `C${state.meta.nextConversationId++}`,
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          updatedAt: getToday(),
          messages: [
            {
              id: `M${state.meta.nextMessageId++}`,
              senderId: listing.sellerId,
              text: '你好，物品还在的。',
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
    const conversation = state.conversations.find((candidate) => candidate.id === conversationId)
    if (!user || !conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) {
      const error = new Error('conversation not found')
      error.status = 404
      throw error
    }
    return {
      list: conversation.messages.map((message) => buildMessageDto(state, conversation, message, user.id)),
      total: conversation.messages.length
    }
  }

  async sendMessage(currentUserName, conversationId, text) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      const conversation = state.conversations.find((candidate) => candidate.id === conversationId)
      if (!user || !conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) {
        const error = new Error('conversation not found')
        error.status = 404
        throw error
      }
      const message = {
        id: `M${state.meta.nextMessageId++}`,
        senderId: user.id,
        text: String(text || '').trim(),
        read: false,
        sentAt: getToday(),
        messageType: 'text'
      }
      conversation.messages.push(message)
      conversation.updatedAt = getToday()
      return buildMessageDto(state, conversation, message, user.id)
    })
  }

  async markMessageRead(currentUserName, messageId) {
    return this.repository.write((state) => {
      const user = findUserByName(state, currentUserName)
      if (!user) {
        const error = new Error('未登录')
        error.status = 401
        throw error
      }
      for (const conversation of state.conversations) {
        if (conversation.buyerId !== user.id && conversation.sellerId !== user.id) continue
        const message = conversation.messages.find((candidate) => candidate.id === messageId)
        if (!message) continue
        message.read = true
        return buildMessageDto(state, conversation, message, user.id)
      }
      const error = new Error('message not found')
      error.status = 404
      throw error
    })
  }
}
