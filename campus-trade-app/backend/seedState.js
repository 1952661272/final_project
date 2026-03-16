import {
  chats as seedChats,
  items as seedItems,
  orders as seedOrders,
  sellerOrders as seedSellerOrders,
  users as seedUsers
} from '../src/data/mock.js'

const DEFAULT_ADMIN = {
  id: 'A01',
  name: '平台管理员',
  account: 'admin',
  password: '123456',
  status: '正常',
  campus: '北校区',
  credit: 5,
  verified: true,
  reg: '2024-01-01',
  role: 'admin',
  studentNo: null,
  deletedAt: null
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function uniqueBy(items, keyBuilder) {
  const seen = new Set()
  return items.filter((item) => {
    const key = keyBuilder(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeUser(seedUser) {
  const studentNo = seedUser.id?.replace(/^U/, '2023') || null
  return {
    id: seedUser.id,
    name: seedUser.name,
    account: studentNo || seedUser.name,
    password: '123456',
    status: seedUser.status,
    campus: seedUser.campus,
    credit: seedUser.credit,
    verified: !!seedUser.verified,
    reg: seedUser.reg,
    role: 'student',
    studentNo,
    deletedAt: null
  }
}

function inferRelativeTag(item) {
  const tags = Array.isArray(item.tags) ? [...item.tags] : []
  if (tags.length > 0) return uniqueBy(tags, (value) => value)
  const derived = []
  if (item.shipping === '包邮') derived.push('包邮')
  if (String(item.method || '').includes('面交')) derived.push('可面交')
  return uniqueBy(derived, (value) => value)
}

function createConversationSeeds(users, listings) {
  const userMap = new Map(users.map((user) => [user.name, user]))
  const currentViewer = userMap.get('张同学') || users.find((user) => user.role === 'student')

  return seedChats.map((chat, index) => {
    const seller = userMap.get(chat.name) || users.find((user) => user.role === 'student')
    const listing = listings.find((item) => item.sellerId === seller?.id) || listings[0]
    const buyerId = seller?.id === currentViewer?.id
      ? (users.find((user) => user.id !== seller.id && user.role === 'student')?.id || seller.id)
      : currentViewer?.id

    return {
      id: `C${index + 1}`,
      listingId: listing?.id || 'L1',
      buyerId,
      sellerId: seller?.id || currentViewer?.id,
      updatedAt: listing?.createdAt || '2026-02-03',
      messages: (chat.messages || []).map((message, messageIndex) => ({
        id: `M${index + 1}${messageIndex + 1}`,
        senderId: message.from === 'me' ? buyerId : (seller?.id || buyerId),
        text: message.text,
        read: message.from === 'me',
        sentAt: listing?.createdAt || '2026-02-03',
        messageType: 'text'
      }))
    }
  })
}

function createNotification(id, userId, type, title, content, createdAt, extra = {}) {
  return {
    id,
    userId,
    type,
    title,
    content,
    createdAt,
    read: false,
    ...extra
  }
}

function createListingFromSeed(seedItem, users) {
  const seller = users.find((user) => user.name === seedItem.seller) || users[0]
  return {
    id: `L${seedItem.id}`,
    numericId: Number(seedItem.id),
    sellerId: seller.id,
    title: seedItem.title,
    price: Number(seedItem.price) || 0,
    campus: seedItem.campus,
    condition: Number(seedItem.condition) || 0,
    category: seedItem.category,
    createdAt: seedItem.createdAt,
    updatedAt: seedItem.createdAt,
    desc: seedItem.desc || '',
    tags: inferRelativeTag(seedItem),
    shipping: seedItem.shipping || '包邮',
    method: seedItem.method || '面交优先',
    views: Number(seedItem.views) || 0,
    likes: Number(seedItem.likes) || 0,
    status: seedItem.status || '待审核',
    images: Array.isArray(seedItem.images) ? [...seedItem.images] : [],
    reviewRemark: null
  }
}

function createOrderFromSeed(seedOrder, users, listings, index, prefix) {
  const listing = listings.find((item) => item.title === seedOrder.item) || listings[0]
  const seller = users.find((user) => user.name === seedOrder.seller) || users[0]
  const buyer = users.find((user) => user.name === seedOrder.buyer) || users.find((user) => user.id !== seller.id && user.role === 'student') || users[0]
  return {
    id: seedOrder.id || `${prefix}${index + 1}`,
    listingId: listing?.id || 'L1',
    buyerId: buyer.id,
    sellerId: seller.id,
    price: Number(seedOrder.price) || 0,
    status: seedOrder.status || '待确认',
    createdAt: seedOrder.createdAt || '2026-02-03',
    updatedAt: seedOrder.createdAt || '2026-02-03',
    method: seedOrder.method || '面交',
    address: seedOrder.address || `${listing?.campus || '北校区'}图书馆门口`
  }
}

export function createSeedState() {
  const users = [DEFAULT_ADMIN, ...seedUsers.map(normalizeUser)]
  const listings = seedItems.map((item) => createListingFromSeed(item, users))
  const favorites = [
    { userId: 'U01', listingId: 'L1' }
  ]

  const buyerOrders = seedOrders.map((order, index) => createOrderFromSeed(order, users, listings, index, 'OB'))
  const sellerOrders = seedSellerOrders.map((order, index) => createOrderFromSeed(order, users, listings, index, 'OS'))
  const orders = uniqueBy([...buyerOrders, ...sellerOrders], (order) => order.id)
  const orderLogs = orders.map((order, index) => ({
    id: `OL${index + 1}`,
    orderId: order.id,
    fromStatus: null,
    toStatus: order.status,
    operatorId: order.buyerId,
    note: '初始化订单',
    createdAt: order.createdAt
  }))
  const conversations = createConversationSeeds(users, listings)
  const notifications = [
    createNotification('N1', 'U01', 'system', '商品审核通过', '你的“九成新无线键盘”已审核通过并上架。', '2026-02-03', { relatedListingId: 1 }),
    createNotification('N2', 'U03', 'system', '新订单提醒', '有买家对“二手 iPad 10 64G”发起了购买。', '2026-02-01', { relatedListingId: 3, relatedOrderId: 'B2026018' })
  ]

  return {
    __schemaVersion: 3,
    users: deepClone(users),
    listings: deepClone(listings),
    favorites: deepClone(favorites),
    orders: deepClone(orders),
    orderLogs: deepClone(orderLogs),
    conversations: deepClone(conversations),
    notifications: deepClone(notifications),
    verifyRequests: [],
    meta: {
      nextListingId: listings.length + 1,
      nextConversationId: conversations.length + 1,
      nextMessageId: conversations.reduce((count, conversation) => count + conversation.messages.length, 0) + 1,
      nextVerifyId: 1,
      nextOrderLogId: orderLogs.length + 1,
      nextOrderSeq: 100,
      nextNotificationId: notifications.length + 1
    }
  }
}

function createUserFromLegacyName(state, name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return null
  const existing = state.users.find((user) => user.name === trimmed)
  if (existing) return existing
  const numeric = state.users.filter((user) => /^U\d+$/.test(user.id)).length + 1
  const user = {
    id: `U${String(numeric).padStart(2, '0')}`,
    name: trimmed,
    account: `2026${String(numeric).padStart(4, '0')}`,
    password: '123456',
    status: '正常',
    campus: '北校区',
    credit: 4.6,
    verified: false,
    reg: '2026-03-10',
    role: 'student',
    studentNo: `2026${String(numeric).padStart(4, '0')}`,
    deletedAt: null
  }
  state.users.push(user)
  return user
}

export function migrateLegacyState(raw) {
  if (!raw || typeof raw !== 'object') return createSeedState()

  if (raw.__schemaVersion === 3) {
    raw.users = Array.isArray(raw.users) ? raw.users.map((user) => ({
      ...user,
      deletedAt: user.deletedAt || null
    })) : []
    raw.notifications = Array.isArray(raw.notifications) ? raw.notifications : []
    raw.meta = raw.meta || {}
    raw.meta.nextNotificationId = Number(raw.meta.nextNotificationId) || (raw.notifications.length + 1)
    raw.conversations = Array.isArray(raw.conversations) ? raw.conversations.map((conversation) => ({
      ...conversation,
      messages: Array.isArray(conversation.messages) ? conversation.messages.map((message) => ({
        messageType: message.messageType || 'text',
        ...message
      })) : []
    })) : []
    return raw
  }

  const state = createSeedState()
  const activeUser = createUserFromLegacyName(state, raw?.user?.name)

  if (Array.isArray(raw.users) && raw.users.length > 0) {
    state.users = uniqueBy(
      [
        DEFAULT_ADMIN,
        ...raw.users.map((user) => ({
          id: user.id,
          name: user.name,
          account: user.studentNo || user.id?.replace(/^U/, '2023') || user.name,
          password: '123456',
          status: user.status || '正常',
          campus: user.campus || '北校区',
          credit: Number(user.credit) || 4.6,
          verified: !!user.verified,
          reg: user.reg || '2026-03-10',
          role: user.id === DEFAULT_ADMIN.id ? 'admin' : 'student',
          studentNo: user.id?.replace(/^U/, '2023') || null,
          deletedAt: user.deletedAt || null
        }))
      ],
      (user) => user.id
    )
  }

  if (Array.isArray(raw.items) && raw.items.length > 0) {
    state.listings = raw.items.map((item) => createListingFromSeed(item, state.users))
    state.meta.nextListingId = state.listings.length + 1
  }

  if (Array.isArray(raw.favorites) && activeUser) {
    state.favorites = raw.favorites.map((listingId) => ({
      userId: activeUser.id,
      listingId: `L${listingId}`
    }))
  }

  if (Array.isArray(raw.orders) && raw.orders.length > 0) {
    state.orders = raw.orders.map((order) => ({
      paymentStatus: order.paymentStatus || '',
      paymentMethod: order.paymentMethod || '',
      paymentTime: order.paymentTime || null,
      ...order
    }))
  }

  if (Array.isArray(raw.conversations) && raw.conversations.length > 0) {
    state.conversations = raw.conversations.map((conversation) => ({
      ...conversation,
      messages: Array.isArray(conversation.messages) ? conversation.messages.map((message) => ({
        messageType: message.messageType || 'text',
        ...message
      })) : []
    }))
  }

  state.notifications = Array.isArray(raw.notifications) ? raw.notifications : []
  state.meta.nextNotificationId = Number(raw?.meta?.nextNotificationId) || (state.notifications.length + 1)
  state.__schemaVersion = 3

  return state
}
