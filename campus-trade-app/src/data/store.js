import { reactive } from 'vue'
import {
  items as seedItems,
  chats as seedChats,
  orders as seedOrders,
  sellerOrders as seedSellerOrders,
  users as seedUsers
} from './mock'
import { api } from 'src/services/api'

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

const state = reactive({
  ready: false,
  loading: false,
  bootstrapped: false,
  backendConnected: false,
  user: {
    loggedIn: false,
    name: localStorage.getItem('user_name') || ''
  },
  favorites: [],
  items: deepClone(seedItems),
  chats: deepClone(seedChats),
  orders: deepClone(seedOrders),
  sellerOrders: deepClone(seedSellerOrders),
  users: deepClone(seedUsers),
  selectedChat: 0
})

function replaceArray (target, source) {
  target.splice(0, target.length, ...(Array.isArray(source) ? source : []))
}

function applyServerState (payload) {
  if (!payload || typeof payload !== 'object') return
  if (payload.user) {
    state.user.loggedIn = !!payload.user.loggedIn
    state.user.name = payload.user.name || ''
  }
  if (Array.isArray(payload.favorites)) {
    state.favorites = [...payload.favorites]
  }
  if (Array.isArray(payload.items)) replaceArray(state.items, payload.items)
  if (Array.isArray(payload.chats)) replaceArray(state.chats, payload.chats)
  if (Array.isArray(payload.orders)) replaceArray(state.orders, payload.orders)
  if (Array.isArray(payload.sellerOrders)) replaceArray(state.sellerOrders, payload.sellerOrders)
  if (Array.isArray(payload.users)) replaceArray(state.users, payload.users)
  if (typeof payload.selectedChat === 'number') {
    state.selectedChat = payload.selectedChat
  }
}

async function syncAction (type, payload = {}) {
  try {
    const response = await api.post('/v1/state/action', { type, payload })
    if (response?.data) applyServerState(response.data)
    state.backendConnected = true
    return response?.data || null
  } catch (error) {
    state.backendConnected = false
    return null
  }
}

async function bootstrap (force = false) {
  if (state.loading) return
  if (state.bootstrapped && !force) {
    state.ready = true
    return
  }

  state.loading = true
  try {
    const response = await api.get('/v1/state')
    applyServerState(response.data)
    state.backendConnected = true

    const needsRelogin = localStorage.getItem('user_auth') === '1' && !state.user.loggedIn
    if (needsRelogin) {
      const name = localStorage.getItem('user_name') || '张同学'
      await syncAction('login', { name })
      state.user.loggedIn = true
      state.user.name = name
    }
  } catch (error) {
    state.backendConnected = false
  } finally {
    state.bootstrapped = true
    state.ready = true
    state.loading = false
  }
}

function login (name = '张同学') {
  const actualName = (name || '张同学').trim() || '张同学'
  state.user.loggedIn = true
  state.user.name = actualName
  const existing = state.users.find((user) => user.name === actualName)
  if (!existing) {
    state.users.unshift({
      id: `U${Date.now()}`,
      name: actualName,
      status: '正常',
      reg: getToday(),
      campus: '北校区',
      credit: 4.6,
      verified: false
    })
  } else if (typeof existing.verified === 'undefined') {
    existing.verified = false
  }

  localStorage.setItem('user_auth', '1')
  localStorage.setItem('user_name', actualName)
  void syncAction('login', { name: actualName })
}

function logout () {
  state.user.loggedIn = false
  state.user.name = ''
  localStorage.removeItem('user_auth')
  localStorage.removeItem('user_name')
  void syncAction('logout')
}

function toggleFavorite (id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((fav) => fav !== id)
  } else {
    state.favorites = [...state.favorites, id]
  }
  void syncAction('toggleFavorite', { id })
}

function isFavorite (id) {
  return state.favorites.includes(id)
}

function setSelectedChat (index) {
  state.selectedChat = index
  void syncAction('setSelectedChat', { index })
}

function startChat (sellerName) {
  let index = state.chats.findIndex((chat) => chat.name === sellerName)
  if (index === -1) {
    state.chats.unshift({
      name: sellerName,
      messages: [{ from: 'other', text: '你好，物品还在的。', time: '刚刚' }]
    })
    index = 0
  }
  state.selectedChat = index
  void syncAction('startChat', { sellerName })
}

function sendMessage (text) {
  const chat = state.chats[state.selectedChat]
  if (!chat || !text.trim()) return
  chat.messages.push({ from: 'me', text: text.trim(), time: '刚刚' })
  void syncAction('sendMessage', { text: text.trim(), chatIndex: state.selectedChat })
}

function createOrder (item) {
  const today = getToday()
  const order = {
    id: `B${Date.now()}`,
    item: item.title,
    price: item.price,
    status: '待确认',
    time: '刚刚',
    createdAt: today,
    method: item.method || '面交',
    address: `${item.campus}图书馆门口`,
    seller: item.seller
  }
  state.orders.unshift(order)
  state.sellerOrders.unshift({
    id: `S${Date.now() + 1}`,
    buyer: state.user.name || '体验用户',
    item: item.title,
    price: item.price,
    status: '待确认',
    seller: item.seller,
    method: item.method || '面交',
    address: `${item.campus}图书馆门口`,
    time: '刚刚',
    createdAt: today
  })

  void syncAction('createOrder', { item })
  return order
}

function updateOrderStatus (orderId, status) {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order) return
  order.status = status
  if (status === '已完成') {
    const item = state.items.find((it) => it.title === order.item)
    if (item) item.status = '下架'
  }
  void syncAction('updateOrderStatus', { orderId, status })
}

function updateSellerOrderStatus (orderId, status) {
  const order = state.sellerOrders.find((o) => o.id === orderId)
  if (!order) return
  order.status = status
  if (status === '已完成') {
    const item = state.items.find((it) => it.title === order.item)
    if (item) item.status = '下架'
  }
  void syncAction('updateSellerOrderStatus', { orderId, status })
}

function updateItem (itemId, payload) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  Object.assign(item, payload)
  item.time = '刚刚'
  void syncAction('updateItem', { itemId, data: payload })
}

function toggleItemStatus (itemId) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  if (item.status === '上架') item.status = '下架'
  else if (item.status === '下架') item.status = '上架'
  item.time = '刚刚'
  void syncAction('toggleItemStatus', { itemId })
}

function setItemStatus (itemId, status) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  item.status = status
  item.time = '刚刚'
  void syncAction('setItemStatus', { itemId, status })
}

function reviewItem (itemId, status) {
  if (status !== '上架' && status !== '驳回') return
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  item.status = status
  item.time = '刚刚'
  void syncAction('reviewItem', { itemId, status })
}

function updateUserStatus (userId, status) {
  const user = state.users.find((u) => u.id === userId)
  if (!user) return
  user.status = status
  if (status === '禁用') {
    state.items.forEach((item) => {
      if (item.seller === user.name) {
        item.status = '下架'
        item.time = '刚刚'
      }
    })
    if (state.user.name === user.name) {
      logout()
    }
  }
  void syncAction('updateUserStatus', { userId, status })
}

function verifyCurrentUser () {
  const user = state.users.find((u) => u.name === state.user.name)
  if (!user) return
  user.verified = true
  void syncAction('verifyCurrentUser', { name: state.user.name })
}

function publishItem (payload) {
  const today = getToday()
  const item = {
    id: Date.now(),
    title: payload.title,
    price: Number(payload.price) || 0,
    campus: payload.campus,
    condition: Number(payload.condition) || 9,
    category: payload.category,
    time: '刚刚',
    createdAt: today,
    seller: state.user.name || '体验用户',
    desc: payload.desc || '暂无描述',
    tags: payload.tags || ['新发布'],
    shipping: payload.shipping || '包邮',
    method: payload.method || '面交优先',
    views: 0,
    likes: 0,
    status: '待审核',
    images: payload.images
  }
  state.items.unshift(item)
  void syncAction('publishItem', { data: payload })
  return item
}

async function adminLogin (account, password) {
  const response = await api.post('/v1/auth/admin-login', { account, password })
  return response.data
}

export const store = {
  state,
  bootstrap,
  login,
  logout,
  adminLogin,
  toggleFavorite,
  isFavorite,
  setSelectedChat,
  startChat,
  sendMessage,
  createOrder,
  updateOrderStatus,
  updateSellerOrderStatus,
  updateItem,
  toggleItemStatus,
  setItemStatus,
  reviewItem,
  updateUserStatus,
  verifyCurrentUser,
  publishItem
}
