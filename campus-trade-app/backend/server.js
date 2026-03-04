import express from 'express'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  items as seedItems,
  chats as seedChats,
  orders as seedOrders,
  sellerOrders as seedSellerOrders,
  users as seedUsers
} from '../src/data/mock.js'
import { JsonStateStore, MysqlStateStore } from './stateStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = resolve(__dirname, 'data/state.json')
const PORT = Number(process.env.API_PORT || 3001)
const STATE_DRIVER = process.env.STATE_DRIVER || (process.env.MYSQL_URL ? 'mysql' : 'json')

function deepClone (value) {
  return JSON.parse(JSON.stringify(value))
}

function formatDate (date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function getToday () {
  return formatDate(new Date())
}

function nowLabel () {
  return '刚刚'
}

function seedState () {
  return {
    user: {
      loggedIn: false,
      name: ''
    },
    favorites: [],
    items: deepClone(seedItems),
    chats: deepClone(seedChats),
    orders: deepClone(seedOrders),
    sellerOrders: deepClone(seedSellerOrders),
    users: deepClone(seedUsers),
    selectedChat: 0
  }
}

function normalizeState (raw) {
  const fallback = seedState()
  const state = {
    ...fallback,
    ...(raw || {}),
    user: {
      ...fallback.user,
      ...(raw?.user || {})
    }
  }

  state.favorites = Array.isArray(state.favorites) ? state.favorites : []
  state.items = Array.isArray(state.items) ? state.items : []
  state.orders = Array.isArray(state.orders) ? state.orders : []
  state.sellerOrders = Array.isArray(state.sellerOrders) ? state.sellerOrders : []
  state.users = Array.isArray(state.users) ? state.users : []

  state.chats = (Array.isArray(state.chats) ? state.chats : []).map((chat, index) => {
    const id = chat.id || `C${Date.now()}${index}`
    const messages = (Array.isArray(chat.messages) ? chat.messages : []).map((msg, msgIndex) => ({
      id: msg.id || `M${Date.now()}${index}${msgIndex}`,
      from: msg.from || 'other',
      text: msg.text || '',
      time: msg.time || nowLabel(),
      read: typeof msg.read === 'boolean' ? msg.read : msg.from !== 'other'
    }))
    return {
      id,
      name: chat.name || `会话${index + 1}`,
      messages
    }
  })

  if (state.selectedChat < 0 || state.selectedChat >= state.chats.length) {
    state.selectedChat = 0
  }

  state.users.forEach((user) => {
    if (typeof user.verified === 'undefined') user.verified = false
  })

  return state
}

function pickStateStore () {
  if (STATE_DRIVER === 'mysql') {
    return new MysqlStateStore(process.env.MYSQL_URL)
  }
  return new JsonStateStore(DATA_FILE)
}

const stateStore = pickStateStore()
let state = seedState()

async function persistState () {
  await stateStore.save(state)
}

async function loadState () {
  await stateStore.init()
  const loaded = await stateStore.load()
  state = normalizeState(loaded)
  await persistState()
}

function ensureUserRecord (name) {
  let user = state.users.find((u) => u.name === name)
  if (!user) {
    user = {
      id: `U${Date.now()}`,
      name,
      status: '正常',
      reg: getToday(),
      campus: '北校区',
      credit: 4.6,
      verified: false
    }
    state.users.unshift(user)
  }
  if (typeof user.verified === 'undefined') user.verified = false
  return user
}

function currentUserName (req) {
  const fromHeader = String(req.headers['x-user-name'] || '').trim()
  if (fromHeader) return fromHeader
  if (state.user.loggedIn && state.user.name) return state.user.name
  return ''
}

function getCurrentUser (req) {
  const name = currentUserName(req)
  if (!name) return null
  return state.users.find((u) => u.name === name) || null
}

function setItemStatus (itemId, status) {
  const item = state.items.find((it) => Number(it.id) === Number(itemId))
  if (!item) return null
  item.status = status
  item.time = nowLabel()
  return item
}

function findListingByTitle (title) {
  return state.items.find((it) => it.title === title) || null
}

function statusToSortValue (sort) {
  if (!sort) return '最新'
  const value = String(sort)
  if (['latest', 'newest', '最新'].includes(value)) return '最新'
  if (['price_asc', 'asc', '价格升序'].includes(value)) return '价格升序'
  if (['price_desc', 'desc', '价格降序'].includes(value)) return '价格降序'
  return value
}

function applyListingFilters (items, query) {
  const keyword = String(query.keyword || '').trim().toLowerCase()
  const category = String(query.category || '').trim()
  const campus = String(query.campus || '').trim()
  const price = String(query.price || '').trim()
  const condition = String(query.condition || '').trim()
  const status = String(query.status || '').trim()
  const priceMin = query.priceMin !== undefined ? Number(query.priceMin) : null
  const priceMax = query.priceMax !== undefined ? Number(query.priceMax) : null
  const sort = statusToSortValue(query.sort)

  let list = items.slice()

  if (status) {
    list = list.filter((it) => it.status === status)
  }
  if (keyword) {
    list = list.filter((it) => {
      return String(it.title || '').toLowerCase().includes(keyword) || String(it.desc || '').toLowerCase().includes(keyword)
    })
  }
  if (category && category !== '全部') {
    list = list.filter((it) => it.category === category)
  }
  if (campus && campus !== '全部') {
    list = list.filter((it) => it.campus === campus)
  }

  if (!Number.isNaN(priceMin) && priceMin !== null) {
    list = list.filter((it) => Number(it.price) >= priceMin)
  }
  if (!Number.isNaN(priceMax) && priceMax !== null) {
    list = list.filter((it) => Number(it.price) <= priceMax)
  }

  if (price && price !== '全部') {
    list = list.filter((it) => {
      const amount = Number(it.price)
      if (price === '0-100') return amount <= 100
      if (price === '100-500') return amount > 100 && amount <= 500
      if (price === '500-2000') return amount > 500 && amount <= 2000
      if (price === '2000+') return amount > 2000
      return true
    })
  }

  if (condition && condition !== '全部') {
    list = list.filter((it) => {
      const value = Number(it.condition)
      if (condition === '9-10') return value >= 9
      if (condition === '8-9') return value >= 8 && value < 9
      if (condition === '7-8') return value >= 7 && value < 8
      if (condition === '7以下') return value < 7
      return true
    })
  }

  if (sort === '价格升序') list.sort((a, b) => Number(a.price) - Number(b.price))
  else if (sort === '价格降序') list.sort((a, b) => Number(b.price) - Number(a.price))
  else {
    list.sort((a, b) => {
      const bt = new Date(`${b.createdAt || '1970-01-01'}T00:00:00`).getTime()
      const at = new Date(`${a.createdAt || '1970-01-01'}T00:00:00`).getTime()
      return bt - at
    })
  }

  return list
}

function ensureConversation (sellerName) {
  let index = state.chats.findIndex((chat) => chat.name === sellerName)
  if (index === -1) {
    state.chats.unshift({
      id: `C${Date.now()}`,
      name: sellerName,
      messages: [{ id: `M${Date.now()}0`, from: 'other', text: '你好，物品还在的。', time: nowLabel(), read: false }]
    })
    index = 0
  }
  state.selectedChat = index
  return state.chats[index]
}

function createOrderByItem (item, buyerName) {
  const today = getToday()
  const order = {
    id: `B${Date.now()}`,
    item: item.title,
    price: item.price,
    status: '待确认',
    time: nowLabel(),
    createdAt: today,
    method: item.method || '面交',
    address: `${item.campus}图书馆门口`,
    seller: item.seller,
    buyer: buyerName || state.user.name || '体验用户'
  }

  state.orders.unshift(order)
  state.sellerOrders.unshift({
    id: `S${Date.now() + 1}`,
    buyer: order.buyer,
    item: item.title,
    price: item.price,
    status: '待确认',
    seller: item.seller,
    method: item.method || '面交',
    address: `${item.campus}图书馆门口`,
    time: nowLabel(),
    createdAt: today
  })

  return order
}

function applyAction (type, payload = {}) {
  switch (type) {
    case 'login': {
      const actualName = String(payload.name || '张同学').trim() || '张同学'
      const user = ensureUserRecord(actualName)
      if (user.status === '禁用') {
        const err = new Error('该账号已被禁用，请联系管理员')
        err.status = 403
        throw err
      }
      state.user.loggedIn = true
      state.user.name = actualName
      return
    }
    case 'logout': {
      state.user.loggedIn = false
      state.user.name = ''
      return
    }
    case 'toggleFavorite': {
      const id = Number(payload.id)
      if (state.favorites.includes(id)) state.favorites = state.favorites.filter((fav) => fav !== id)
      else state.favorites = [...state.favorites, id]
      return
    }
    case 'setSelectedChat': {
      const idx = Number(payload.index)
      if (!Number.isNaN(idx) && idx >= 0 && idx < state.chats.length) {
        state.selectedChat = idx
      }
      return
    }
    case 'startChat': {
      const sellerName = String(payload.sellerName || '').trim()
      if (!sellerName) return
      ensureConversation(sellerName)
      return
    }
    case 'sendMessage': {
      const text = String(payload.text || '').trim()
      const index = Number(payload.chatIndex)
      const chat = state.chats[index]
      if (!chat || !text) return
      chat.messages.push({ id: `M${Date.now()}`, from: 'me', text, time: nowLabel(), read: true })
      state.selectedChat = index
      return
    }
    case 'createOrder': {
      const item = payload.item || null
      if (!item) return
      createOrderByItem(item, state.user.name)
      return
    }
    case 'updateOrderStatus': {
      const order = state.orders.find((o) => o.id === payload.orderId)
      if (!order) return
      order.status = payload.status
      if (payload.status === '已完成') {
        const listing = findListingByTitle(order.item)
        if (listing) listing.status = '下架'
      }
      return
    }
    case 'updateSellerOrderStatus': {
      const order = state.sellerOrders.find((o) => o.id === payload.orderId)
      if (!order) return
      order.status = payload.status
      if (payload.status === '已完成') {
        const listing = findListingByTitle(order.item)
        if (listing) listing.status = '下架'
      }
      return
    }
    case 'updateItem': {
      const item = state.items.find((it) => Number(it.id) === Number(payload.itemId))
      if (!item) return
      Object.assign(item, payload.data || {})
      item.time = nowLabel()
      return
    }
    case 'toggleItemStatus': {
      const item = state.items.find((it) => Number(it.id) === Number(payload.itemId))
      if (!item) return
      if (item.status === '上架') item.status = '下架'
      else if (item.status === '下架') item.status = '上架'
      item.time = nowLabel()
      return
    }
    case 'setItemStatus': {
      setItemStatus(payload.itemId, payload.status)
      return
    }
    case 'reviewItem': {
      if (!['上架', '驳回'].includes(payload.status)) return
      setItemStatus(payload.itemId, payload.status)
      return
    }
    case 'updateUserStatus': {
      const user = state.users.find((u) => u.id === payload.userId)
      if (!user) return
      user.status = payload.status
      if (payload.status === '禁用') {
        state.items.forEach((item) => {
          if (item.seller === user.name) {
            item.status = '下架'
            item.time = nowLabel()
          }
        })
        if (state.user.name === user.name) {
          state.user.loggedIn = false
          state.user.name = ''
        }
      }
      return
    }
    case 'verifyCurrentUser': {
      const name = state.user.name || String(payload.name || '').trim()
      if (!name) return
      const user = state.users.find((u) => u.name === name)
      if (user) user.verified = true
      return
    }
    case 'publishItem': {
      const data = payload.data || {}
      const today = getToday()
      const nextId = Math.max(0, ...state.items.map((it) => Number(it.id) || 0)) + 1
      state.items.unshift({
        id: nextId,
        title: data.title,
        price: Number(data.price) || 0,
        campus: data.campus,
        condition: Number(data.condition) || 9,
        category: data.category,
        time: nowLabel(),
        createdAt: today,
        seller: state.user.name || '体验用户',
        desc: data.desc || '暂无描述',
        tags: data.tags || ['新发布'],
        shipping: data.shipping || '包邮',
        method: data.method || '面交优先',
        views: 0,
        likes: 0,
        status: '待审核',
        images: data.images || []
      })
      return
    }
    default:
      return
  }
}

const app = express()
app.use(express.json({ limit: '12mb' }))

function ok (res, data = {}) {
  res.json({ ok: true, data })
}

function fail (res, status, message) {
  res.status(status).json({ ok: false, message })
}

app.get('/api/health', (req, res) => {
  ok(res, { service: 'campus-trade-api', driver: STATE_DRIVER, time: new Date().toISOString() })
})

app.get('/api/v1/state', (req, res) => {
  ok(res, state)
})

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    applyAction('login', { name: req.body?.name })
    await persistState()
    ok(res, state)
  } catch (error) {
    fail(res, error.status || 500, error.message || '登录失败')
  }
})

app.post('/api/v1/auth/admin-login', async (req, res) => {
  const account = String(req.body?.account || '').trim()
  const password = String(req.body?.password || '').trim()
  if (account === 'admin' && password === '123456') {
    ok(res, { account, role: 'admin' })
    return
  }
  fail(res, 401, '管理员账号或密码错误')
})

app.post('/api/v1/auth/logout', async (req, res) => {
  applyAction('logout')
  await persistState()
  ok(res, { loggedOut: true })
})

app.get('/api/v1/users/me', (req, res) => {
  const user = getCurrentUser(req)
  if (!user) {
    fail(res, 401, '未登录')
    return
  }
  ok(res, user)
})

app.post('/api/v1/users/verify', async (req, res) => {
  const user = getCurrentUser(req)
  if (!user) {
    fail(res, 401, '未登录')
    return
  }
  user.verified = true
  await persistState()
  ok(res, user)
})

app.patch('/api/v1/admin/users/:userId/status', async (req, res) => {
  const userId = req.params.userId
  const status = String(req.body?.status || '').trim()
  if (!['正常', '禁用'].includes(status)) {
    fail(res, 400, 'status must be 正常 or 禁用')
    return
  }
  applyAction('updateUserStatus', { userId, status })
  await persistState()
  const user = state.users.find((u) => u.id === userId)
  ok(res, user || null)
})

app.get('/api/v1/listings', (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize || 20)))

  const filtered = applyListingFilters(state.items, req.query)
  const total = filtered.length
  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  ok(res, { list, page, pageSize, total })
})

app.post('/api/v1/listings', async (req, res) => {
  const currentUser = getCurrentUser(req)
  if (!currentUser) {
    fail(res, 401, '未登录')
    return
  }

  const payload = req.body || {}
  if (!payload.title || payload.price === undefined) {
    fail(res, 400, 'title and price are required')
    return
  }

  applyAction('publishItem', { data: payload })
  const created = state.items[0]
  if (created) {
    created.seller = currentUser.name
  }
  await persistState()
  ok(res, created || null)
})

app.get('/api/v1/listings/:listingId', (req, res) => {
  const listing = state.items.find((it) => Number(it.id) === Number(req.params.listingId))
  if (!listing) {
    fail(res, 404, 'listing not found')
    return
  }
  ok(res, listing)
})

app.patch('/api/v1/listings/:listingId', async (req, res) => {
  const listingId = Number(req.params.listingId)
  const listing = state.items.find((it) => Number(it.id) === listingId)
  if (!listing) {
    fail(res, 404, 'listing not found')
    return
  }

  applyAction('updateItem', { itemId: listingId, data: req.body || {} })
  await persistState()
  ok(res, state.items.find((it) => Number(it.id) === listingId) || null)
})

app.patch('/api/v1/listings/:listingId/status', async (req, res) => {
  const status = String(req.body?.status || '').trim()
  if (!status) {
    fail(res, 400, 'status is required')
    return
  }
  const itemId = Number(req.params.listingId)
  applyAction('setItemStatus', { itemId, status })
  await persistState()
  const listing = state.items.find((it) => Number(it.id) === itemId)
  if (!listing) {
    fail(res, 404, 'listing not found')
    return
  }
  ok(res, listing)
})

app.post('/api/v1/listings/:listingId/favorite', async (req, res) => {
  const listingId = Number(req.params.listingId)
  if (!state.items.find((it) => Number(it.id) === listingId)) {
    fail(res, 404, 'listing not found')
    return
  }
  if (!state.favorites.includes(listingId)) {
    state.favorites.push(listingId)
  }
  await persistState()
  ok(res, { favorites: state.favorites })
})

app.delete('/api/v1/listings/:listingId/favorite', async (req, res) => {
  const listingId = Number(req.params.listingId)
  state.favorites = state.favorites.filter((id) => id !== listingId)
  await persistState()
  ok(res, { favorites: state.favorites })
})

app.post('/api/v1/admin/listings/:listingId/review', async (req, res) => {
  const itemId = Number(req.params.listingId)
  const status = String(req.body?.status || '').trim()
  if (!['上架', '驳回'].includes(status)) {
    fail(res, 400, 'status must be 上架 or 驳回')
    return
  }
  applyAction('reviewItem', { itemId, status })
  await persistState()
  const listing = state.items.find((it) => Number(it.id) === itemId)
  if (!listing) {
    fail(res, 404, 'listing not found')
    return
  }
  ok(res, listing)
})

app.post('/api/v1/orders', async (req, res) => {
  const currentUser = getCurrentUser(req)
  if (!currentUser) {
    fail(res, 401, '未登录')
    return
  }

  const listingId = Number(req.body?.listingId)
  const listing = state.items.find((it) => Number(it.id) === listingId)
  if (!listing) {
    fail(res, 404, 'listing not found')
    return
  }

  const order = createOrderByItem(listing, currentUser.name)
  await persistState()
  ok(res, order)
})

app.get('/api/v1/orders', (req, res) => {
  const role = String(req.query.role || 'buyer').trim()
  const status = String(req.query.status || '').trim()
  const user = getCurrentUser(req)

  let list
  if (role === 'seller') {
    if (user) list = state.sellerOrders.filter((it) => it.seller === user.name)
    else list = state.sellerOrders.slice()
  } else {
    if (user) {
      list = state.orders.filter((it) => !it.buyer || it.buyer === user.name)
    } else {
      list = state.orders.slice()
    }
  }

  if (status) list = list.filter((it) => it.status === status)
  ok(res, { list, total: list.length })
})

app.get('/api/v1/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId
  const order = state.orders.find((it) => it.id === orderId) || state.sellerOrders.find((it) => it.id === orderId)
  if (!order) {
    fail(res, 404, 'order not found')
    return
  }
  ok(res, order)
})

app.patch('/api/v1/orders/:orderId/status', async (req, res) => {
  const orderId = req.params.orderId
  const status = String(req.body?.status || '').trim()
  if (!status) {
    fail(res, 400, 'status is required')
    return
  }

  const buyerOrder = state.orders.find((it) => it.id === orderId)
  if (buyerOrder) {
    applyAction('updateOrderStatus', { orderId, status })
  } else {
    const sellerOrder = state.sellerOrders.find((it) => it.id === orderId)
    if (!sellerOrder) {
      fail(res, 404, 'order not found')
      return
    }
    applyAction('updateSellerOrderStatus', { orderId, status })
  }

  await persistState()
  const updated = state.orders.find((it) => it.id === orderId) || state.sellerOrders.find((it) => it.id === orderId)
  ok(res, updated || null)
})

app.get('/api/v1/conversations', (req, res) => {
  const list = state.chats.map((chat, index) => ({
    id: chat.id,
    name: chat.name,
    lastMessage: chat.messages[chat.messages.length - 1] || null,
    messageCount: chat.messages.length,
    selected: state.selectedChat === index
  }))
  ok(res, { list, total: list.length })
})

app.post('/api/v1/conversations', async (req, res) => {
  const sellerName = String(req.body?.sellerName || '').trim()
  if (!sellerName) {
    fail(res, 400, 'sellerName is required')
    return
  }

  const conversation = ensureConversation(sellerName)
  await persistState()
  ok(res, conversation)
})

app.get('/api/v1/conversations/:conversationId/messages', (req, res) => {
  const conversation = state.chats.find((chat) => chat.id === req.params.conversationId)
  if (!conversation) {
    fail(res, 404, 'conversation not found')
    return
  }
  ok(res, { list: conversation.messages, total: conversation.messages.length })
})

app.post('/api/v1/conversations/:conversationId/messages', async (req, res) => {
  const conversation = state.chats.find((chat) => chat.id === req.params.conversationId)
  if (!conversation) {
    fail(res, 404, 'conversation not found')
    return
  }
  const text = String(req.body?.text || '').trim()
  if (!text) {
    fail(res, 400, 'text is required')
    return
  }

  const message = {
    id: `M${Date.now()}`,
    from: String(req.body?.from || 'me'),
    text,
    time: nowLabel(),
    read: false
  }
  conversation.messages.push(message)
  await persistState()
  ok(res, message)
})

app.patch('/api/v1/messages/:messageId/read', async (req, res) => {
  const messageId = req.params.messageId
  let found = null
  for (const chat of state.chats) {
    const msg = chat.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.read = true
      found = msg
      break
    }
  }

  if (!found) {
    fail(res, 404, 'message not found')
    return
  }

  await persistState()
  ok(res, found)
})

// Backward-compatible action endpoint for current frontend store
app.post('/api/v1/state/action', async (req, res) => {
  const type = req.body?.type
  const payload = req.body?.payload || {}
  if (!type) {
    fail(res, 400, 'type is required')
    return
  }

  try {
    applyAction(type, payload)
    await persistState()
    ok(res, state)
  } catch (error) {
    fail(res, error.status || 500, error.message || 'action failed')
  }
})

await loadState()

app.listen(PORT, () => {
  console.log(`[api] campus-trade backend listening on http://127.0.0.1:${PORT}`)
  console.log(`[api] state driver: ${STATE_DRIVER}`)
})
