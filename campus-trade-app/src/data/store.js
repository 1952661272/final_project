import { reactive } from 'vue'
import {
  items as seedItems,
  chats as seedChats,
  orders as seedOrders,
  sellerOrders as seedSellerOrders,
  users as seedUsers
} from './mock'
import { api } from 'src/services/api'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

const state = reactive({
  ready: false,
  loading: false,
  bootstrapped: false,
  backendConnected: false,
  user: {
    loggedIn: localStorage.getItem('user_auth') === '1',
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

function replaceArray(target, source) {
  target.splice(0, target.length, ...(Array.isArray(source) ? source : []))
}

function userHeaders() {
  const headers = {}
  const name = localStorage.getItem('user_name') || state.user.name
  const adminAccount = localStorage.getItem('admin_account') || ''
  if (name) headers['x-user-name'] = encodeURIComponent(name)
  if (localStorage.getItem('admin_auth') === '1' && adminAccount) {
    headers['x-admin-account'] = encodeURIComponent(adminAccount)
  }
  return headers
}

async function fetchCurrentUser() {
  if (localStorage.getItem('user_auth') !== '1') return null
  const response = await api.get('/v1/users/me', { headers: userHeaders() })
  return response.data
}

async function fetchUsers() {
  const response = await api.get('/v1/users')
  return response.data
}

async function fetchListings() {
  const response = await api.get('/v1/listings?page=1&pageSize=200')
  return response.data?.list || []
}

async function fetchOrders(role) {
  const response = await api.get(`/v1/orders?role=${role}`)
  return response.data?.list || []
}

async function fetchFavorites() {
  if (localStorage.getItem('user_auth') !== '1') return []
  const response = await api.get('/v1/favorites', { headers: userHeaders() })
  return response.data?.favorites || []
}

async function fetchConversations() {
  if (localStorage.getItem('user_auth') !== '1') return []
  const response = await api.get('/v1/conversations', { headers: userHeaders() })
  const summaries = response.data?.list || []
  const chats = await Promise.all(summaries.map(async (summary) => {
    const messages = await api.get(`/v1/conversations/${summary.id}/messages`, { headers: userHeaders() })
    return {
      id: summary.id,
      name: summary.name,
      listingId: summary.listingId,
      listingTitle: summary.listingTitle,
      messages: messages.data?.list || []
    }
  }))
  return chats
}

async function refreshDomainState() {
  const [currentUser, users, items, buyerOrders, sellerOrders, favorites, chats] = await Promise.all([
    fetchCurrentUser().catch(() => null),
    fetchUsers(),
    fetchListings(),
    fetchOrders('buyer').catch(() => []),
    fetchOrders('seller').catch(() => []),
    fetchFavorites().catch(() => []),
    fetchConversations().catch(() => [])
  ])

  state.user.loggedIn = !!currentUser
  state.user.name = currentUser?.name || ''
  replaceArray(state.users, users)
  replaceArray(state.items, items)
  replaceArray(state.orders, buyerOrders)
  replaceArray(state.sellerOrders, sellerOrders)
  replaceArray(state.chats, chats)
  state.favorites = [...favorites]
  if (state.selectedChat >= state.chats.length) state.selectedChat = 0
}

async function bootstrap(force = false) {
  if (state.loading) return
  if (state.bootstrapped && !force) {
    state.ready = true
    return
  }

  state.loading = true
  try {
    await refreshDomainState()
    state.backendConnected = true
  } catch (error) {
    state.backendConnected = false
  } finally {
    state.bootstrapped = true
    state.ready = true
    state.loading = false
  }
}

async function login(name = '张同学') {
  const actualName = (name || '张同学').trim() || '张同学'
  await api.post('/v1/auth/login', { name: actualName })
  localStorage.setItem('user_auth', '1')
  localStorage.setItem('user_name', actualName)
  state.user.loggedIn = true
  state.user.name = actualName
  await bootstrap(true)
}

async function logout() {
  localStorage.removeItem('user_auth')
  localStorage.removeItem('user_name')
  state.user.loggedIn = false
  state.user.name = ''
  state.favorites = []
  replaceArray(state.orders, [])
  replaceArray(state.sellerOrders, [])
  replaceArray(state.chats, [])
  await api.post('/v1/auth/logout', {}, { headers: userHeaders() }).catch(() => null)
  await bootstrap(true)
}

async function toggleFavorite(id) {
  if (localStorage.getItem('user_auth') !== '1') return
  if (state.favorites.includes(id)) {
    await api.delete(`/v1/listings/${id}/favorite`, { headers: userHeaders() })
  } else {
    await api.post(`/v1/listings/${id}/favorite`, {}, { headers: userHeaders() })
  }
  state.favorites = await fetchFavorites()
}

function isFavorite(id) {
  return state.favorites.includes(id)
}

function setSelectedChat(index) {
  state.selectedChat = index
}

async function startChat(item) {
  const listingId = item?.id || item?.listingId
  if (!listingId) return null
  const response = await api.post('/v1/conversations', { listingId }, { headers: userHeaders() })
  const chats = await fetchConversations()
  replaceArray(state.chats, chats)
  const nextIndex = state.chats.findIndex((chat) => chat.id === response.data?.id)
  state.selectedChat = nextIndex >= 0 ? nextIndex : 0
  return response.data
}

async function sendMessage(text) {
  if (localStorage.getItem('user_auth') !== '1') return
  const chat = state.chats[state.selectedChat]
  if (!chat || !text.trim()) return
  await api.post(`/v1/conversations/${chat.id}/messages`, { text: text.trim() }, { headers: userHeaders() })
  const messages = await api.get(`/v1/conversations/${chat.id}/messages`, { headers: userHeaders() })
  chat.messages = messages.data?.list || []
}

async function createOrder(item) {
  const response = await api.post('/v1/orders', { listingId: item.id }, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function updateOrderStatus(orderId, status) {
  await api.patch(`/v1/orders/${orderId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function updateSellerOrderStatus(orderId, status) {
  await updateOrderStatus(orderId, status)
}

async function updateItem(itemId, payload) {
  await api.patch(`/v1/listings/${itemId}`, payload, { headers: userHeaders() })
  await bootstrap(true)
}

async function toggleItemStatus(itemId) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  const status = item.status === '上架' ? '下架' : '上架'
  await api.patch(`/v1/listings/${itemId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function setItemStatus(itemId, status) {
  await api.patch(`/v1/listings/${itemId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function reviewItem(itemId, status) {
  await api.post(`/v1/admin/listings/${itemId}/review`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function updateUserStatus(userId, status) {
  await api.patch(`/v1/admin/users/${userId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function verifyCurrentUser() {
  await api.post('/v1/users/verify', {}, { headers: userHeaders() })
  await bootstrap(true)
}

async function publishItem(payload) {
  const response = await api.post('/v1/listings', payload, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function adminLogin(account, password) {
  const response = await api.post('/v1/auth/admin-login', { account, password })
  localStorage.setItem('admin_auth', '1')
  localStorage.setItem('admin_account', response.data?.account || account)
  return response.data
}

export const store = {
  state,
  bootstrap,
  refresh: () => bootstrap(true),
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
