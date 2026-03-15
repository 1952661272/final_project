<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">通知记录</div>
          <div class="section-sub">查看系统通知是否成功投递到对应用户。</div>
        </div>
        <q-badge color="primary" rounded>{{ store.state.adminNotifications.length }}</q-badge>
      </div>

      <q-table flat dense :rows="store.state.adminNotifications" :columns="columns" row-key="id" hide-pagination>
        <template #body-cell-read="props">
          <q-td :props="props">
            <q-badge :color="props.row.read ? 'positive' : 'negative'">
              {{ props.row.read ? '已读' : '未读' }}
            </q-badge>
          </q-td>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script setup>
import { store } from 'src/data/store'

const columns = [
  { name: 'title', label: '标题', field: 'title' },
  { name: 'userName', label: '接收用户', field: 'userName' },
  { name: 'content', label: '内容', field: 'content' },
  { name: 'createdAt', label: '时间', field: 'createdAt' },
  { name: 'read', label: '状态', field: 'read' }
]
</script>

<style scoped>
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.section-sub {
  margin-top: 6px;
  color: var(--text-muted);
}
</style>
