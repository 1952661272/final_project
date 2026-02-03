<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">管理后台</div>
      <q-tabs v-model="tab" dense align="left" class="sub-tabs" active-color="primary">
        <q-tab name="dashboard" label="数据看板" />
        <q-tab name="listings" label="商品审核" />
        <q-tab name="users" label="用户管理" />
      </q-tabs>

      <div v-if="tab === 'dashboard'" class="list-block">
        <div class="stat-grid">
          <div class="stat">
            <div class="stat-value">1,280</div>
            <div class="stat-label">活跃用户</div>
          </div>
          <div class="stat">
            <div class="stat-value">268</div>
            <div class="stat-label">新增商品</div>
          </div>
          <div class="stat">
            <div class="stat-value">92</div>
            <div class="stat-label">成交订单</div>
          </div>
        </div>
        <q-card flat bordered class="chart-card">平台趋势统计</q-card>
      </div>

      <div v-else-if="tab === 'listings'" class="list-block">
        <q-table
          flat
          dense
          :rows="adminListings"
          :columns="listingColumns"
          row-key="id"
          hide-pagination
        >
          <template #body-cell-action="props">
            <q-td :props="props">
              <q-btn unelevated class="btn-primary" label="通过" size="sm" />
              <q-btn flat class="btn-ghost" label="驳回" size="sm" />
            </q-td>
          </template>
        </q-table>
      </div>

      <div v-else class="list-block">
        <q-table
          flat
          dense
          :rows="adminUsers"
          :columns="userColumns"
          row-key="id"
          hide-pagination
        >
          <template #body-cell-action="props">
            <q-td :props="props">
              <q-btn flat class="btn-ghost" label="禁用" size="sm" />
            </q-td>
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminListings, adminUsers } from 'src/data/mock'

const tab = ref('dashboard')
const route = useRoute()

watch(
  () => route.query.tab,
  (value) => {
    if (value === 'dashboard' || value === 'listings' || value === 'users') {
      tab.value = value
    }
  },
  { immediate: true }
)

const listingColumns = [
  { name: 'title', label: '商品', field: 'title' },
  { name: 'user', label: '发布人', field: 'user' },
  { name: 'time', label: '时间', field: 'time' },
  { name: 'status', label: '状态', field: 'status' },
  { name: 'action', label: '操作', field: 'action' }
]

const userColumns = [
  { name: 'name', label: '用户', field: 'name' },
  { name: 'status', label: '状态', field: 'status' },
  { name: 'reg', label: '注册时间', field: 'reg' },
  { name: 'action', label: '操作', field: 'action' }
]
</script>
