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
    name: localStorage.getItem('user_name') || '',
    account: localStorage.getItem('user_account') || ''
  },
  favorites: [],
  items: deepClone(seedItems),
  chats: deepClone(seedChats),
  notifications: [],
  orders: deepClone(seedOrders),
  sellerOrders: deepClone(seedSellerOrders),
  users: deepClone(seedUsers),
  adminUsers: [],
  adminNotifications: [],
  selectedChat: 0,
  sseConnected: false,
  adminUserFilters: {
    studentNo: '',
    status: '',
    verified: ''
  },
  adminDashboardFilters: {
    dateFrom: '',
    dateTo: ''
  },
  adminOverview: {
    totalUsers: seedUsers.length,
    newItems: 0,
    completedOrders: 0,
    pendingReview: 0,
    todayItems: 0,
    totalGMV: 0,
    trendSeries: []
  }
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

function toQueryString(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value))
    }
  })
  const text = search.toString()
  return text ? `?${text}` : ''
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

async function fetchAdminUsers(filters = state.adminUserFilters) {
  if (localStorage.getItem('admin_auth') !== '1') return []
  const response = await api.get(`/v1/admin/users${toQueryString(filters)}`, { headers: userHeaders() })
  return response.data?.list || []
}

async function fetchAdminNotifications() {
  if (localStorage.getItem('admin_auth') !== '1') return []
  const response = await api.get('/v1/admin/notifications', { headers: userHeaders() })
  return response.data?.list || []
}

async function fetchListings() {
  const response = await api.get('/v1/listings?page=1&pageSize=200')
  return response.data?.list || []
}

async function fetchOrders(role) {
  if (localStorage.getItem('user_auth') !== '1') return []
  const response = await api.get(`/v1/orders?role=${role}`, { headers: userHeaders() })
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
      type: summary.type || 'chat',
      name: summary.name,
      peerUser: summary.peerUser || null,
      listingId: summary.listingId,
      listingTitle: summary.listingTitle,
      listingPrice: summary.listingPrice || 0,
      listingStatus: summary.listingStatus || '已下架',
      unreadCount: summary.unreadCount || 0,
      updatedAt: summary.updatedAt || summary.lastMessage?.time || '',
      lastMessage: summary.lastMessage || null,
      messages: messages.data?.list || []
    }
  }))
  return chats
}

async function fetchNotifications() {
  if (localStorage.getItem('user_auth') !== '1') return []
  const response = await api.get('/v1/notifications', { headers: userHeaders() })
  return response.data?.list || []
}

async function fetchAdminOverview() {
  if (localStorage.getItem('admin_auth') !== '1') return null
  const response = await api.get(`/v1/admin/dashboard${toQueryString(state.adminDashboardFilters)}`, { headers: userHeaders() })
  return response.data || null
}

let eventSource = null

function closeEventStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  state.sseConnected = false
}

function ensureEventStream() {
  if (typeof window === 'undefined') return
  if (eventSource) return
  const userName = localStorage.getItem('user_name') || ''
  const adminAccount = localStorage.getItem('admin_account') || ''
  if (!userName && localStorage.getItem('admin_auth') !== '1') return

  const url = `/api/v1/events/stream${toQueryString({ userName, adminAccount })}`
  eventSource = new window.EventSource(url)

  const handleRefresh = () => {
    state.sseConnected = true
    void bootstrap(true)
  }

  eventSource.addEventListener('connected', () => {
    state.sseConnected = true
  })
  eventSource.addEventListener('inbox.updated', handleRefresh)
  eventSource.addEventListener('orders.updated', handleRefresh)
  eventSource.addEventListener('listings.updated', handleRefresh)
  eventSource.addEventListener('admin.updated', handleRefresh)
  eventSource.onerror = () => {
    closeEventStream()
  }
}

async function refreshDomainState() {
  const [currentUser, users, adminUsers, adminNotifications, items, buyerOrders, sellerOrders, favorites, chats, notifications, adminOverview] = await Promise.all([
    fetchCurrentUser().catch(() => null),
    fetchUsers(),
    fetchAdminUsers().catch(() => []),
    fetchAdminNotifications().catch(() => []),
    fetchListings(),
    fetchOrders('buyer').catch(() => []),
    fetchOrders('seller').catch(() => []),
    fetchFavorites().catch(() => []),
    fetchConversations().catch(() => []),
    fetchNotifications().catch(() => []),
    fetchAdminOverview().catch(() => null)
  ])

  state.user.loggedIn = !!currentUser
  state.user.name = currentUser?.name || ''
  state.user.account = currentUser?.studentNo || localStorage.getItem('user_account') || ''
  replaceArray(state.users, users)
  replaceArray(state.adminUsers, adminUsers)
  replaceArray(state.adminNotifications, adminNotifications)
  replaceArray(state.items, items)
  replaceArray(state.orders, buyerOrders)
  replaceArray(state.sellerOrders, sellerOrders)
  replaceArray(state.chats, chats)
  replaceArray(state.notifications, notifications)
  state.favorites = [...favorites]
  state.adminOverview = adminOverview || {
    totalUsers: users.length,
    newItems: 0,
    completedOrders: 0,
    pendingReview: items.filter((item) => item.status === '待审核').length,
    todayItems: 0,
    totalGMV: 0,
    trendSeries: []
  }
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
  } catch {
    state.backendConnected = false
  } finally {
    state.bootstrapped = true
    state.ready = true
    state.loading = false
  }
  ensureEventStream()
}

async function login(account = '202301', password = '123456') {
  let actualAccount = (account || '').trim()
  const actualPassword = (password || '').trim() || '123456'
  if (actualAccount && !/^\d+$/.test(actualAccount)) {
    const matchedUser = state.users.find((user) => user.name === actualAccount)
    actualAccount = matchedUser?.studentNo || actualAccount
  }
  const response = await api.post('/v1/auth/login', {
    account: actualAccount,
    password: actualPassword
  })
  const user = response.data || {}
  localStorage.setItem('user_auth', '1')
  localStorage.setItem('user_name', user.name || '')
  localStorage.setItem('user_account', user.studentNo || actualAccount)
  state.user.loggedIn = true
  state.user.name = user.name || ''
  state.user.account = user.studentNo || actualAccount
  await bootstrap(true)
  return user
}

async function register({ username, studentNo, password }) {
  const response = await api.post('/v1/auth/register', {
    username: (username || '').trim(),
    studentNo: (studentNo || '').trim(),
    password: (password || '').trim()
  })
  const user = response.data || {}
  localStorage.setItem('user_auth', '1')
  localStorage.setItem('user_name', user.name || '')
  localStorage.setItem('user_account', user.studentNo || '')
  state.user.loggedIn = true
  state.user.name = user.name || ''
  state.user.account = user.studentNo || ''
  await bootstrap(true)
  return user
}

async function logout() {
  closeEventStream()
  localStorage.removeItem('user_auth')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_account')
  state.user.loggedIn = false
  state.user.name = ''
  state.user.account = ''
  state.favorites = []
  replaceArray(state.orders, [])
  replaceArray(state.sellerOrders, [])
  replaceArray(state.chats, [])
  replaceArray(state.notifications, [])
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
  await bootstrap(true)
  const nextIndex = state.chats.findIndex((chat) => chat.id === response.data?.id)
  state.selectedChat = nextIndex >= 0 ? nextIndex : 0
  return response.data
}

async function sendMessage(text) {
  if (localStorage.getItem('user_auth') !== '1') return
  const chat = state.chats[state.selectedChat]
  if (!chat || !text.trim()) return
  await api.post(`/v1/conversations/${chat.id}/messages`, { text: text.trim() }, { headers: userHeaders() })
  await bootstrap(true)
  const nextIndex = state.chats.findIndex((item) => item.id === chat.id)
  state.selectedChat = nextIndex >= 0 ? nextIndex : state.selectedChat
}

async function createOrder(item) {
  const listingId = item?.id || item?.listingId
  const response = await api.post('/v1/orders', { listingId }, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function markConversationRead(conversationId) {
  if (localStorage.getItem('user_auth') !== '1' || !conversationId) return null
  const response = await api.patch(`/v1/conversations/${conversationId}/read`, {}, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function markNotificationRead(notificationId) {
  if (localStorage.getItem('user_auth') !== '1' || !notificationId) return null
  const response = await api.patch(`/v1/notifications/${notificationId}/read`, {}, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function getOrderDetail(orderId) {
  const response = await api.get(`/v1/orders/${orderId}`, { headers: userHeaders() })
  return response.data || null
}

async function getOrderLogs(orderId) {
  const response = await api.get(`/v1/order-logs/${orderId}`, { headers: userHeaders() })
  return response.data?.list || []
}

async function payOrder(orderId, paymentMethod) {
  const response = await api.post(`/v1/orders/${orderId}/pay`, { paymentMethod }, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function updateOrderStatus(orderId, status) {
  await api.patch(`/v1/orders/${orderId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function updateOrderStatusWithReason(orderId, status, reason) {
  await api.patch(`/v1/orders/${orderId}/status`, { status, reason }, { headers: userHeaders() })
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

async function reviewItem(itemId, status, reason = '') {
  await api.post(`/v1/admin/listings/${itemId}/review`, { status, reason }, { headers: userHeaders() })
  await bootstrap(true)
}

async function flagListingViolation(itemId, reason = '') {
  await api.patch(`/v1/admin/listings/${itemId}/violation`, { reason }, { headers: userHeaders() })
  await bootstrap(true)
}

async function updateUserStatus(userId, status) {
  await api.patch(`/v1/admin/users/${userId}/status`, { status }, { headers: userHeaders() })
  await bootstrap(true)
}

async function resetUserPassword(userId) {
  const response = await api.post(`/v1/admin/users/${userId}/password/reset`, {}, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
}

async function deleteUser(userId) {
  const response = await api.delete(`/v1/admin/users/${userId}`, { headers: userHeaders() })
  await bootstrap(true)
  return response.data
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
  ensureEventStream()
  return response.data
}

async function toggleConversationPin(conversationId, pinned) {
  await api.patch(`/v1/conversations/${conversationId}/pin`, { pinned }, { headers: userHeaders() })
  await bootstrap(true)
}

async function setAdminUserFilters(filters = {}) {
  state.adminUserFilters = {
    ...state.adminUserFilters,
    ...filters
  }
  await bootstrap(true)
}

async function setAdminDashboardFilters(filters = {}) {
  state.adminDashboardFilters = {
    ...state.adminDashboardFilters,
    ...filters
  }
  await bootstrap(true)
}

export const store = {
  state,
  bootstrap,
  refresh: () => bootstrap(true),
  login,
  register,
  logout,
  adminLogin,
  toggleFavorite,
  isFavorite,
  setSelectedChat,
  startChat,
  sendMessage,
  markConversationRead,
  markNotificationRead,
  toggleConversationPin,
  createOrder,
  payOrder,
  updateOrderStatus,
  updateOrderStatusWithReason,
  getOrderDetail,
  getOrderLogs,
  updateSellerOrderStatus,
  updateItem,
  toggleItemStatus,
  setItemStatus,
  reviewItem,
  flagListingViolation,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  setAdminUserFilters,
  setAdminDashboardFilters,
  verifyCurrentUser,
  publishItem
}
