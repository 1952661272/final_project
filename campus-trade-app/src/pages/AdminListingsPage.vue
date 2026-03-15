<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">商品治理</div>
          <div class="section-sub">审核新商品，也可以对已上架商品执行违规下架。</div>
        </div>
      </div>

      <q-table flat dense :rows="managedItems" :columns="listingColumns" row-key="id" hide-pagination>
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row.status)">
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props">
            <div class="action-cell">
              <q-btn
                v-if="props.row.status === '待审核' || props.row.status === '驳回'"
                unelevated
                class="btn-primary"
                label="通过"
                size="sm"
                @click="approveItem(props.row)"
              />
              <q-btn
                v-if="props.row.status === '待审核' || props.row.status === '驳回'"
                flat
                class="btn-ghost"
                label="驳回"
                size="sm"
                @click="rejectItem(props.row)"
              />
              <q-btn
                v-if="['上架', '交易中'].includes(props.row.status)"
                flat
                class="btn-ghost"
                label="违规下架"
                size="sm"
                @click="violateItem(props.row)"
              />
              <q-btn flat class="btn-ghost" label="详情" size="sm" @click="openDetail(props.row)" />
            </div>
          </q-td>
        </template>
      </q-table>
    </div>

    <q-dialog v-model="showDetail">
      <q-card class="picker-card">
        <div class="card-title">商品详情</div>
        <q-img v-if="selectedItem.images?.length" :src="selectedItem.images[0]" :ratio="1" class="preview-img" />
        <div class="detail-list">
          <div><strong>标题：</strong>{{ selectedItem.title }}</div>
          <div><strong>价格：</strong>¥ {{ selectedItem.price }}</div>
          <div><strong>分类：</strong>{{ selectedItem.category }}</div>
          <div><strong>校区：</strong>{{ selectedItem.campus }}</div>
          <div><strong>成色：</strong>{{ selectedItem.condition }}</div>
          <div><strong>发布人：</strong>{{ selectedItem.seller }}</div>
          <div><strong>状态：</strong>{{ selectedItem.status }}</div>
          <div><strong>描述：</strong>{{ selectedItem.desc }}</div>
          <div><strong>提交时间：</strong>{{ selectedItem.createdAt }}</div>
          <div v-if="selectedItem.reviewRemark"><strong>备注：</strong>{{ selectedItem.reviewRemark }}</div>
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
import { Dialog, Notify } from 'quasar'
import { store } from 'src/data/store'

const showDetail = ref(false)
const selectedItem = ref({})

const managedItems = computed(() => {
  return [...store.state.items].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
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

function statusColor(status) {
  if (status === '待审核') return 'orange'
  if (status === '上架') return 'positive'
  if (status === '交易中') return 'primary'
  if (status === '驳回') return 'negative'
  return 'grey-7'
}

async function approveItem(item) {
  try {
    await store.reviewItem(item.id, '上架')
    Notify.create({ type: 'positive', message: `已通过：${item.title}` })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '审核失败' })
  }
}

function rejectItem(item) {
  Dialog.create({
    title: '驳回原因',
    message: `请输入“${item.title}”的驳回原因`,
    prompt: {
      model: '',
      type: 'text',
      isValid: (value) => String(value || '').trim().length > 0
    },
    cancel: true,
    persistent: true
  }).onOk(async (reason) => {
    try {
      await store.reviewItem(item.id, '驳回', reason)
      Notify.create({ type: 'warning', message: `已驳回：${item.title}` })
    } catch (error) {
      Notify.create({ type: 'negative', message: error.message || '审核失败' })
    }
  })
}

function violateItem(item) {
  Dialog.create({
    title: '违规下架原因',
    message: `请输入“${item.title}”的违规下架原因`,
    prompt: {
      model: '',
      type: 'text',
      isValid: (value) => String(value || '').trim().length > 0
    },
    cancel: true,
    persistent: true
  }).onOk(async (reason) => {
    try {
      await store.flagListingViolation(item.id, reason)
      Notify.create({ type: 'warning', message: `已下架违规商品：${item.title}` })
    } catch (error) {
      Notify.create({ type: 'negative', message: error.message || '违规下架失败' })
    }
  })
}

function openDetail(item) {
  selectedItem.value = item
  showDetail.value = true
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

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
