<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div class="section-title">用户管理</div>
        <div class="section-sub">支持查看账号、重置密码、禁用/恢复与软删除用户。</div>
      </div>

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
        :pagination="{ rowsPerPage: 0, sortBy: isDeletedView ? 'deletedAt' : 'reg', descending: true }"
        :rows-per-page-options="[0]"
        hide-pagination
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row)">
              {{ displayStatus(props.row) }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-verified="props">
          <q-td :props="props">
            {{ props.row.verified ? '已认证' : '未认证' }}
          </q-td>
        </template>

        <template #body-cell-deletedAt="props">
          <q-td :props="props">
            {{ props.row.deletedAt || '-' }}
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props" class="action-td">
            <q-btn flat round dense icon="more_horiz" color="grey-8">
              <q-menu auto-close>
                <q-list dense class="action-menu">
                  <q-item clickable @click="openAccount(props.row)">
                    <q-item-section>查看账号</q-item-section>
                  </q-item>
                  <q-item v-if="!props.row.deletedAt" clickable @click="resetPassword(props.row)">
                    <q-item-section>重置密码</q-item-section>
                  </q-item>
                  <q-item v-if="!props.row.deletedAt" clickable @click="toggleUser(props.row)">
                    <q-item-section>{{ props.row.status === '正常' ? '禁用' : '恢复' }}</q-item-section>
                  </q-item>
                  <q-item v-if="!props.row.deletedAt" clickable @click="removeUser(props.row)">
                    <q-item-section class="text-negative">删除用户</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showAccountDialog">
      <q-card class="picker-card">
        <div class="card-title">账号信息</div>
        <div v-if="selectedUser" class="detail-list">
          <div><strong>用户名：</strong>{{ selectedUser.name }}</div>
          <div><strong>学号账号：</strong>{{ selectedUser.account || selectedUser.studentNo || '-' }}</div>
          <div><strong>状态：</strong>{{ displayStatus(selectedUser) }}</div>
          <div><strong>注册时间：</strong>{{ selectedUser.reg || '-' }}</div>
          <div><strong>软删除时间：</strong>{{ selectedUser.deletedAt || '未删除' }}</div>
          <div class="password-tip">
            <strong>密码：</strong>不可查看原密码，仅支持管理员重置为 `123456`。
          </div>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="关闭" v-close-popup />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showResetDialog">
      <q-card class="picker-card">
        <div class="card-title">密码已重置</div>
        <div v-if="resetResult" class="detail-list">
          <div><strong>用户名：</strong>{{ resetResult.name }}</div>
          <div><strong>学号账号：</strong>{{ resetResult.account }}</div>
          <div><strong>新密码：</strong>{{ resetResult.password }}</div>
          <div class="password-tip">{{ resetResult.message }}</div>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="关闭" v-close-popup />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import { store } from 'src/data/store'

const filters = reactive({
  studentNo: store.state.adminUserFilters.studentNo || '',
  status: store.state.adminUserFilters.status || '',
  verified: store.state.adminUserFilters.verified || ''
})

const showAccountDialog = ref(false)
const showResetDialog = ref(false)
const selectedUser = ref(null)
const resetResult = ref(null)

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '正常', value: '正常' },
  { label: '禁用', value: '禁用' },
  { label: '已删除', value: '已删除' }
]

const verifiedOptions = [
  { label: '全部认证', value: '' },
  { label: '已认证', value: 'verified' },
  { label: '未认证', value: 'unverified' }
]

const isDeletedView = computed(() => filters.status === '已删除')

const userRows = computed(() => {
  return [...store.state.adminUsers]
    .map((user) => ({
      ...user,
      totalPublished: Number(user.totalPublished ?? user.listings ?? 0),
      onSale: Number(user.onSale ?? user.activeListings ?? 0)
    }))
    .sort((a, b) => {
      const left = String((isDeletedView.value ? a.deletedAt : a.reg) || '')
      const right = String((isDeletedView.value ? b.deletedAt : b.reg) || '')
      return right.localeCompare(left)
    })
})

const userColumns = [
  { name: 'name', label: '用户', field: 'name', align: 'left' },
  { name: 'studentNo', label: '学号', field: 'studentNo', align: 'left' },
  { name: 'campus', label: '校区', field: 'campus', align: 'left' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'verified', label: '认证', field: 'verified', align: 'center' },
  { name: 'credit', label: '信用分', field: 'credit', align: 'center' },
  { name: 'totalPublished', label: '累计发布', field: 'totalPublished', align: 'center' },
  { name: 'onSale', label: '在售', field: 'onSale', align: 'center' },
  { name: 'reg', label: '注册时间', field: 'reg', align: 'center' },
  { name: 'deletedAt', label: '删除时间', field: 'deletedAt', align: 'center' },
  { name: 'action', label: '操作', field: 'action', align: 'right' }
]

function displayStatus(user) {
  if (!user) return '-'
  return user.deletedAt ? '已删除' : user.status
}

function statusColor(user) {
  if (user?.deletedAt) return 'dark'
  return user?.status === '正常' ? 'green' : 'negative'
}

function openAccount(user) {
  selectedUser.value = user
  showAccountDialog.value = true
}

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

function resetPassword(user) {
  Dialog.create({
    title: '确认重置密码',
    message: `将把“${user.name}”的密码重置为 123456，是否继续？`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      resetResult.value = await store.resetUserPassword(user.id)
      showResetDialog.value = true
      Notify.create({ type: 'positive', message: `${user.name} 的密码已重置` })
    } catch (error) {
      Notify.create({ type: 'negative', message: error.message || '密码重置失败' })
    }
  })
}

function removeUser(user) {
  Dialog.create({
    title: '确认删除用户',
    message: `删除“${user.name}”后，将自动取消进行中订单并下架该用户全部商品。此操作为软删除，历史数据会保留。是否继续？`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await store.deleteUser(user.id)
      Notify.create({ type: 'warning', message: `${user.name} 已被软删除` })
    } catch (error) {
      Notify.create({ type: 'negative', message: error.message || '删除用户失败' })
    }
  })
}
</script>

<style scoped>
.section-head {
  margin-bottom: 18px;
}

.section-sub {
  margin-top: 6px;
  color: var(--text-muted);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-item {
  min-width: 180px;
}

.action-td {
  white-space: nowrap;
}

.action-menu {
  min-width: 140px;
}

.detail-list {
  display: grid;
  gap: 10px;
}

.password-tip {
  color: var(--text-muted);
  line-height: 1.6;
}
</style>
