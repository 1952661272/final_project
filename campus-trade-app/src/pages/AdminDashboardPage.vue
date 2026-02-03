<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">数据看板</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-value">{{ activeUsers }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ newItems }}</div>
          <div class="stat-label">近7日新增商品</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ completedOrders }}</div>
          <div class="stat-label">成交订单</div>
        </div>
      </div>

      <div class="stat-grid stat-grid-secondary">
        <div class="stat stat-secondary">
          <div class="stat-value">{{ pendingReview }}</div>
          <div class="stat-label">待审核商品</div>
        </div>
        <div class="stat stat-secondary">
          <div class="stat-value">{{ todayItems }}</div>
          <div class="stat-label">今日发布</div>
        </div>
        <div class="stat stat-secondary">
          <div class="stat-value">¥ {{ totalGMV }}</div>
          <div class="stat-label">累计成交额</div>
        </div>
      </div>

      <trend-chart :series="trendSeries" />
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import TrendChart from 'src/components/TrendChart.vue'
import { store } from 'src/data/store'

function formatDate (date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function formatLabel (date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function getLastDays (count) {
  const days = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date)
  }
  return days
}

const todayKey = formatDate(new Date())

const activeUsers = computed(() => store.state.users.filter((user) => user.status === '正常').length)

const newItems = computed(() => store.state.items.filter((item) => {
  if (!item.createdAt) return false
  const created = new Date(`${item.createdAt}T00:00:00`)
  const diffDays = (new Date() - created) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays < 7
}).length)

const completedOrders = computed(() => store.state.orders.filter((order) => order.status === '已完成').length)

const pendingReview = computed(() => store.state.items.filter((item) => item.status === '待审核').length)

const todayItems = computed(() => store.state.items.filter((item) => item.createdAt === todayKey).length)

const totalGMV = computed(() => {
  const sum = store.state.orders
    .filter((order) => order.status === '已完成')
    .reduce((total, order) => total + (order.price || 0), 0)
  return sum.toLocaleString()
})

const trendSeries = computed(() => {
  const days = getLastDays(7)
  const itemsByDate = store.state.items.reduce((acc, item) => {
    if (!item.createdAt) return acc
    acc[item.createdAt] = (acc[item.createdAt] || 0) + 1
    return acc
  }, {})
  const ordersByDate = store.state.orders.reduce((acc, order) => {
    if (!order.createdAt) return acc
    acc[order.createdAt] = (acc[order.createdAt] || 0) + 1
    return acc
  }, {})

  return days.map((date) => {
    const key = formatDate(date)
    return {
      label: formatLabel(date),
      items: itemsByDate[key] || 0,
      orders: ordersByDate[key] || 0
    }
  })
})
</script>
