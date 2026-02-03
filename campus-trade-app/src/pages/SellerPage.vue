<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">卖家中心</div>
      <q-tabs v-model="tab" dense align="left" class="sub-tabs" active-color="primary">
        <q-tab name="list" label="我的发布" />
        <q-tab name="orders" label="订单处理" />
        <q-tab name="finance" label="财务统计" />
      </q-tabs>

      <div v-if="tab === 'list'" class="list-block">
        <q-card v-for="item in items" :key="item.id" flat bordered class="result-card">
          <q-img :src="item.images[0]" :ratio="1" class="result-img" />
          <div class="result-body">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-meta">状态：上架 · 浏览 {{ Math.floor(item.id * 38) }}</div>
          </div>
          <div class="result-actions">
            <q-btn flat class="btn-ghost" label="编辑" />
            <q-btn unelevated class="btn-primary" label="下架" />
          </div>
        </q-card>
      </div>

      <div v-else-if="tab === 'orders'" class="list-block">
        <q-table
          flat
          dense
          :rows="sellerOrders"
          :columns="orderColumns"
          row-key="id"
          hide-pagination
        >
          <template #body-cell-action="props">
            <q-td :props="props">
              <q-btn unelevated class="btn-primary" label="同意" size="sm" />
              <q-btn flat class="btn-ghost" label="拒绝" size="sm" />
            </q-td>
          </template>
        </q-table>
      </div>

      <div v-else class="list-block">
        <div class="stat-grid">
          <div class="stat">
            <div class="stat-value">¥ 3,260</div>
            <div class="stat-label">本月成交额</div>
          </div>
          <div class="stat">
            <div class="stat-value">¥ 480</div>
            <div class="stat-label">待结算</div>
          </div>
          <div class="stat">
            <div class="stat-value">4.9 / 5</div>
            <div class="stat-label">信用评分</div>
          </div>
        </div>
        <q-card flat bordered class="chart-card">成交趋势统计</q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { items, sellerOrders } from 'src/data/mock'

const tab = ref('list')

const orderColumns = [
  { name: 'id', label: '订单号', field: 'id' },
  { name: 'buyer', label: '买家', field: 'buyer' },
  { name: 'item', label: '商品', field: 'item' },
  { name: 'price', label: '金额', field: (row) => `¥ ${row.price}` },
  { name: 'status', label: '状态', field: 'status' },
  { name: 'action', label: '操作', field: 'action' }
]
</script>
