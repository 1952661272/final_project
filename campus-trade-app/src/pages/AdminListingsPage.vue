<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">商品审核</div>
      <q-table
        flat
        dense
        :rows="pendingItems"
        :columns="listingColumns"
        row-key="id"
        hide-pagination
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row.status === '待审核' ? 'orange' : 'negative'" align="middle">
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </template>
        <template #body-cell-action="props">
          <q-td :props="props">
            <q-btn
              unelevated
              class="btn-primary"
              label="通过"
              size="sm"
              @click="approveItem(props.row)"
            />
            <q-btn
              flat
              class="btn-ghost"
              label="驳回"
              size="sm"
              @click="rejectItem(props.row)"
            />
            <q-btn
              flat
              class="btn-ghost"
              label="详情"
              size="sm"
              @click="openDetail(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showDetail">
      <q-card class="picker-card">
        <div class="card-title">商品详情</div>
        <q-img v-if="selectedItem.images" :src="selectedItem.images[0]" :ratio="1" class="preview-img" />
        <div class="detail-list">
          <div><strong>标题：</strong>{{ selectedItem.title }}</div>
          <div><strong>价格：</strong>¥ {{ selectedItem.price }}</div>
          <div><strong>分类：</strong>{{ selectedItem.category }}</div>
          <div><strong>校区：</strong>{{ selectedItem.campus }}</div>
          <div><strong>成色：</strong>{{ selectedItem.condition }}</div>
          <div><strong>发布人：</strong>{{ selectedItem.seller }}</div>
          <div><strong>描述：</strong>{{ selectedItem.desc }}</div>
          <div><strong>提交时间：</strong>{{ selectedItem.createdAt }}</div>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="关闭" v-close-popup />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const showDetail = ref(false)
const selectedItem = ref({})

const pendingItems = computed(() => {
  return store.state.items.filter((item) => item.status === '待审核' || item.status === '驳回')
})

const listingColumns = [
  { name: 'title', label: '商品', field: 'title' },
  { name: 'seller', label: '发布人', field: 'seller' },
  { name: 'campus', label: '校区', field: 'campus' },
  { name: 'price', label: '价格', field: (row) => `¥ ${row.price}` },
  { name: 'category', label: '分类', field: 'category' },
  { name: 'createdAt', label: '提交时间', field: 'createdAt' },
  { name: 'status', label: '状态', field: 'status' },
  { name: 'action', label: '操作', field: 'action' }
]

function approveItem (item) {
  store.reviewItem(item.id, '上架')
  Notify.create({ type: 'positive', message: `已通过：${item.title}` })
}

function rejectItem (item) {
  store.reviewItem(item.id, '驳回')
  Notify.create({ type: 'warning', message: `已驳回：${item.title}` })
}

function openDetail (item) {
  selectedItem.value = item
  showDetail.value = true
}
</script>
