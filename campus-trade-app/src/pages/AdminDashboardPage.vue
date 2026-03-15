<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">数据看板</div>

      <div class="filter-bar">
        <q-input v-model="filters.dateFrom" outlined dense type="date" label="开始日期" class="filter-item" />
        <q-input v-model="filters.dateTo" outlined dense type="date" label="结束日期" class="filter-item" />
        <q-btn unelevated class="btn-primary" label="筛选" @click="applyFilters" />
        <q-btn flat class="btn-ghost" label="重置" @click="resetFilters" />
      </div>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat-value">{{ overview.totalUsers }}</div>
          <div class="stat-label">用户总数</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ overview.newItems }}</div>
          <div class="stat-label">近 7 日新增商品</div>
        </div>
        <div class="stat">
          <div class="stat-value">{{ overview.completedOrders }}</div>
          <div class="stat-label">成交订单</div>
        </div>
      </div>

      <div class="stat-grid stat-grid-secondary">
        <div class="stat stat-secondary">
          <div class="stat-value">{{ overview.pendingReview }}</div>
          <div class="stat-label">待审核商品</div>
        </div>
        <div class="stat stat-secondary">
          <div class="stat-value">{{ overview.todayItems }}</div>
          <div class="stat-label">今日发布</div>
        </div>
        <div class="stat stat-secondary">
          <div class="stat-value">¥ {{ formattedGMV }}</div>
          <div class="stat-label">累计成交额</div>
        </div>
      </div>

      <div class="status-grid">
        <div class="status-card">
          <div class="status-label">待确认</div>
          <div class="status-value">{{ groups.pending }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">已确认</div>
          <div class="status-value">{{ groups.confirmed }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">进行中</div>
          <div class="status-value">{{ groups.inProgress }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">已完成</div>
          <div class="status-value">{{ groups.completed }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">已取消</div>
          <div class="status-value">{{ groups.cancelled }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">已拒绝</div>
          <div class="status-value">{{ groups.rejected }}</div>
        </div>
      </div>

      <trend-chart :series="overview.trendSeries || []" />
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Notify } from 'quasar'
import TrendChart from 'src/components/TrendChart.vue'
import { store } from 'src/data/store'

const filters = reactive({
  dateFrom: store.state.adminDashboardFilters.dateFrom || '',
  dateTo: store.state.adminDashboardFilters.dateTo || ''
})

const overview = computed(() => store.state.adminOverview || {
  totalUsers: 0,
  newItems: 0,
  completedOrders: 0,
  pendingReview: 0,
  todayItems: 0,
  totalGMV: 0,
  trendSeries: [],
  orderStatusGroups: {}
})

const groups = computed(() => ({
  pending: overview.value.orderStatusGroups?.pending || 0,
  confirmed: overview.value.orderStatusGroups?.confirmed || 0,
  inProgress: overview.value.orderStatusGroups?.inProgress || 0,
  completed: overview.value.orderStatusGroups?.completed || 0,
  cancelled: overview.value.orderStatusGroups?.cancelled || 0,
  rejected: overview.value.orderStatusGroups?.rejected || 0
}))

const formattedGMV = computed(() => Number(overview.value.totalGMV || 0).toLocaleString())

async function applyFilters() {
  try {
    await store.setAdminDashboardFilters({ ...filters })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '筛选失败' })
  }
}

async function resetFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  await applyFilters()
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-item {
  min-width: 180px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.status-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.status-label {
  color: var(--text-muted);
  margin-bottom: 8px;
}

.status-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-dark);
}
</style>
