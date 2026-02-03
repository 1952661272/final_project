<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">用户管理</div>
      <q-table
        flat
        dense
        :rows="userRows"
        :columns="userColumns"
        row-key="id"
        hide-pagination
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row.status === '正常' ? 'green' : 'negative'">
              {{ props.row.status }}
            </q-badge>
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
import { computed } from 'vue'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const userRows = computed(() => {
  return store.state.users.map((user) => {
    const listings = store.state.items.filter((item) => item.seller === user.name)
    const activeListings = listings.filter((item) => item.status === '上架').length
    return {
      ...user,
      listings: listings.length,
      activeListings
    }
  })
})

const userColumns = [
  { name: 'name', label: '用户', field: 'name' },
  { name: 'campus', label: '校区', field: 'campus' },
  { name: 'status', label: '状态', field: 'status' },
  { name: 'verified', label: '认证', field: (row) => (row.verified ? '已认证' : '未认证') },
  { name: 'credit', label: '信用分', field: 'credit' },
  { name: 'listings', label: '累计发布', field: 'listings' },
  { name: 'activeListings', label: '在售', field: 'activeListings' },
  { name: 'reg', label: '注册时间', field: 'reg' },
  { name: 'action', label: '操作', field: 'action' }
]

function toggleUser (user) {
  const nextStatus = user.status === '正常' ? '禁用' : '正常'
  store.updateUserStatus(user.id, nextStatus)
  Notify.create({ type: 'info', message: `${user.name} 已${nextStatus}` })
}
</script>
