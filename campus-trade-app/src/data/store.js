import { reactive } from 'vue'
import {
  items as seedItems,
  chats as seedChats,
  orders as seedOrders,
  sellerOrders as seedSellerOrders,
  users as seedUsers
} from './mock'

const STORAGE_KEY = 'campus_trade_state_v3'

function readStorage () {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (err) {
    return null
  }
}

function writeStorage (payload) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function formatDate (date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function getToday () {
  return formatDate(new Date())
}

const saved = readStorage() || {}

const state = reactive({
  user: {
    loggedIn: false,
    name: saved.userName || ''
  },
  favorites: saved.favorites || [],
  items: saved.items || JSON.parse(JSON.stringify(seedItems)),
  chats: saved.chats || JSON.parse(JSON.stringify(seedChats)),
  orders: saved.orders || JSON.parse(JSON.stringify(seedOrders)),
  sellerOrders: saved.sellerOrders || JSON.parse(JSON.stringify(seedSellerOrders)),
  users: saved.users || JSON.parse(JSON.stringify(seedUsers)),
  selectedChat: saved.selectedChat || 0
})

function persist () {
  writeStorage({
    favorites: state.favorites,
    items: state.items,
    chats: state.chats,
    orders: state.orders,
    sellerOrders: state.sellerOrders,
    users: state.users,
    userName: state.user.name,
    selectedChat: state.selectedChat
  })
}

function login (name = '张同学') {
  const actualName = name || '张同学'
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
  persist()
}

function logout () {
  state.user.loggedIn = false
  state.user.name = ''
  persist()
}

function toggleFavorite (id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((fav) => fav !== id)
  } else {
    state.favorites = [...state.favorites, id]
  }
  persist()
}

function isFavorite (id) {
  return state.favorites.includes(id)
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
  persist()
}

function sendMessage (text) {
  const chat = state.chats[state.selectedChat]
  if (!chat || !text.trim()) return
  chat.messages.push({ from: 'me', text: text.trim(), time: '刚刚' })
  persist()
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
  persist()
  return order
}

function updateOrderStatus (orderId, status) {
  const order = state.orders.find((o) => o.id === orderId)
  if (order) {
    order.status = status
    if (status === '已完成') {
      const item = state.items.find((it) => it.title === order.item)
      if (item) item.status = '下架'
    }
    persist()
  }
}

function updateSellerOrderStatus (orderId, status) {
  const order = state.sellerOrders.find((o) => o.id === orderId)
  if (order) {
    order.status = status
    if (status === '已完成') {
      const item = state.items.find((it) => it.title === order.item)
      if (item) item.status = '下架'
    }
    persist()
  }
}

function updateItem (itemId, payload) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  Object.assign(item, payload)
  item.time = '刚刚'
  persist()
}

function toggleItemStatus (itemId) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  if (item.status === '上架') {
    item.status = '下架'
  } else if (item.status === '下架') {
    item.status = '上架'
  }
  item.time = '刚刚'
  persist()
}

function setItemStatus (itemId, status) {
  const item = state.items.find((it) => it.id === itemId)
  if (!item) return
  item.status = status
  item.time = '刚刚'
  persist()
}

function reviewItem (itemId, status) {
  if (status !== '上架' && status !== '驳回') return
  setItemStatus(itemId, status)
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
  }
  persist()
}

function verifyCurrentUser () {
  const user = state.users.find((u) => u.name === state.user.name)
  if (!user) return
  user.verified = true
  persist()
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
  persist()
  return item
}

export const store = {
  state,
  login,
  logout,
  toggleFavorite,
  isFavorite,
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
