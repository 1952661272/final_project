<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">用户管理</div>

      <div class="filter-bar">
        <q-input
          v-model="filters.studentNo"
          outlined
          dense
          label="学号"
          class="filter-item"
          @keyup.enter="applyFilters"
        />
        <q-select
          v-model="filters.status"
          outlined
          dense
          emit-value
          map-options
          label="状态"
          :options="statusOptions"
          class="filter-item"
        />
        <q-select
          v-model="filters.verified"
          outlined
          dense
          emit-value
          map-options
          label="认证"
          :options="verifiedOptions"
          class="filter-item"
        />
        <q-btn unelevated class="btn-primary" label="筛选" @click="applyFilters" />
        <q-btn flat class="btn-ghost" label="重置" @click="resetFilters" />
      </div>

      <q-table
        flat
        dense
        :rows="userRows"
        :columns="userColumns"
        row-key="id"
        :pagination="{ rowsPerPage: 0, sortBy: 'reg', descending: true }"
        :rows-per-page-options="[0]"
        hide-pagination
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row.status === '正常' ? 'green' : 'negative'">
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-verified="props">
          <q-td :props="props">
            {{ props.row.verified ? '已认证' : '未认证' }}
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props">
            <q-btn
              flat
              class="btn-ghost"
              :label="props.row.status === '正常' ? '禁用' : '恢复'"
              size="sm"
              @click="toggleUser(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const filters = reactive({
  studentNo: store.state.adminUserFilters.studentNo || '',
  status: store.state.adminUserFilters.status || '',
  verified: store.state.adminUserFilters.verified || ''
})

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '正常', value: '正常' },
  { label: '禁用', value: '禁用' }
]

const verifiedOptions = [
  { label: '全部认证', value: '' },
  { label: '已认证', value: 'verified' },
  { label: '未认证', value: 'unverified' }
]

const userRows = computed(() => {
  const source = store.state.adminUsers.length ? store.state.adminUsers : store.state.users
  return source
    .map((user) => {
      const listings = store.state.items.filter((item) => item.seller === user.name)
      const activeListings = listings.filter((item) => item.status === '上架').length
      return {
        ...user,
        listings: listings.length,
        activeListings
      }
    })
    .sort((a, b) => String(b.reg || '').localeCompare(String(a.reg || '')))
})

const userColumns = [
  { name: 'name', label: '用户', field: 'name', align: 'left' },
  { name: 'studentNo', label: '学号', field: 'studentNo', align: 'left' },
  { name: 'campus', label: '校区', field: 'campus', align: 'left' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'verified', label: '认证', field: 'verified', align: 'center' },
  { name: 'credit', label: '信用分', field: 'credit', align: 'center' },
  { name: 'listings', label: '累计发布', field: 'listings', align: 'center' },
  { name: 'activeListings', label: '在售', field: 'activeListings', align: 'center' },
  { name: 'reg', label: '注册时间', field: 'reg', align: 'center' },
  { name: 'action', label: '操作', field: 'action', align: 'right' }
]

async function applyFilters() {
  try {
    await store.setAdminUserFilters({ ...filters })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '筛选失败' })
  }
}

async function resetFilters() {
  filters.studentNo = ''
  filters.status = ''
  filters.verified = ''
  await applyFilters()
}

async function toggleUser(user) {
  const nextStatus = user.status === '正常' ? '禁用' : '正常'
  try {
    await store.updateUserStatus(user.id, nextStatus)
    Notify.create({ type: 'info', message: `${user.name} 已${nextStatus}` })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '用户状态更新失败' })
  }
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
</style>
