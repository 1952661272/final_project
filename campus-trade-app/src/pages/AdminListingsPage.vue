<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">商品列表</div>
          <div class="section-sub">查看全部商品数据，支持按关键词、状态、分类、校区和发布人筛选，并保留审核与违规下架操作。</div>
        </div>
      </div>

      <div class="filter-bar">
        <q-input
          v-model="filters.keyword"
          outlined
          dense
          label="关键词"
          class="filter-item filter-item-wide"
          @keyup.enter="applyFilters"
        />
        <q-input
          v-model="filters.seller"
          outlined
          dense
          label="发布人"
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
          v-model="filters.category"
          outlined
          dense
          emit-value
          map-options
          label="分类"
          :options="categoryOptions"
          class="filter-item"
        />
        <q-select
          v-model="filters.campus"
          outlined
          dense
          emit-value
          map-options
          label="校区"
          :options="campusOptions"
          class="filter-item"
        />
        <q-btn unelevated class="btn-primary" label="筛选" @click="applyFilters" />
        <q-btn flat class="btn-ghost" label="重置" @click="resetFilters" />
      </div>

      <div class="section-sub filter-summary">
        共 {{ filteredItems.length }} 件商品
      </div>

      <q-table
        flat
        dense
        :rows="filteredItems"
        :columns="listingColumns"
        row-key="id"
        :pagination="{ rowsPerPage: 0, sortBy: 'createdAt', descending: true }"
        :rows-per-page-options="[0]"
        hide-pagination
      >
        <template #body-cell-price="props">
          <q-td :props="props">
            ￥ {{ props.row.price }}
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row.status)">
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-tags="props">
          <q-td :props="props">
            {{ formatTags(props.row.tags) }}
          </q-td>
        </template>

        <template #body-cell-reviewRemark="props">
          <q-td :props="props">
            {{ props.row.reviewRemark || '-' }}
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
          <div><strong>价格：</strong>￥ {{ selectedItem.price }}</div>
          <div><strong>分类：</strong>{{ selectedItem.category }}</div>
          <div><strong>校区：</strong>{{ selectedItem.campus }}</div>
          <div><strong>成色：</strong>{{ selectedItem.condition }}</div>
          <div><strong>发布人：</strong>{{ selectedItem.seller }}</div>
          <div><strong>状态：</strong>{{ selectedItem.status }}</div>
          <div><strong>物流：</strong>{{ selectedItem.shipping || '-' }}</div>
          <div><strong>交易方式：</strong>{{ selectedItem.method || '-' }}</div>
          <div><strong>标签：</strong>{{ formatTags(selectedItem.tags) }}</div>
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
import { computed, reactive, ref } from 'vue'
import { Dialog, Notify } from 'quasar'
import { store } from 'src/data/store'

const filters = reactive({
  keyword: '',
  seller: '',
  status: '',
  category: '',
  campus: ''
})

const appliedFilters = reactive({
  keyword: '',
  seller: '',
  status: '',
  category: '',
  campus: ''
})

const showDetail = ref(false)
const selectedItem = ref({})

const allItems = computed(() => {
  return [...store.state.items].sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
})

const statusOptions = computed(() => {
  const preferredOrder = ['待审核', '上架', '交易中', '已售出', '下架', '驳回']
  const existing = new Set(allItems.value.map((item) => String(item.status || '').trim()).filter(Boolean))
  const options = [{ label: '全部状态', value: '' }]

  preferredOrder.forEach((status) => {
    if (existing.has(status)) options.push({ label: status, value: status })
  })

  Array.from(existing)
    .filter((status) => !preferredOrder.includes(status))
    .sort((left, right) => left.localeCompare(right))
    .forEach((status) => {
      options.push({ label: status, value: status })
    })

  return options
})

const categoryOptions = computed(() => {
  const values = Array.from(new Set(allItems.value.map((item) => String(item.category || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
  return [{ label: '全部分类', value: '' }, ...values.map((value) => ({ label: value, value }))]
})

const campusOptions = computed(() => {
  const values = Array.from(new Set(allItems.value.map((item) => String(item.campus || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
  return [{ label: '全部校区', value: '' }, ...values.map((value) => ({ label: value, value }))]
})

const filteredItems = computed(() => {
  const keyword = appliedFilters.keyword.trim().toLowerCase()
  const seller = appliedFilters.seller.trim().toLowerCase()

  return allItems.value.filter((item) => {
    if (appliedFilters.status && item.status !== appliedFilters.status) return false
    if (appliedFilters.category && item.category !== appliedFilters.category) return false
    if (appliedFilters.campus && item.campus !== appliedFilters.campus) return false
    if (seller && !String(item.seller || '').toLowerCase().includes(seller)) return false
    if (!keyword) return true

    const haystacks = [
      item.title,
      item.desc,
      item.seller,
      item.category,
      item.campus,
      ...(Array.isArray(item.tags) ? item.tags : [])
    ]

    return haystacks.some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

const listingColumns = [
  { name: 'title', label: '商品', field: 'title', align: 'left' },
  { name: 'seller', label: '发布人', field: 'seller', align: 'left' },
  { name: 'category', label: '分类', field: 'category', align: 'left' },
  { name: 'campus', label: '校区', field: 'campus', align: 'left' },
  { name: 'price', label: '价格', field: 'price', align: 'right' },
  { name: 'condition', label: '成色', field: 'condition', align: 'center' },
  { name: 'shipping', label: '物流', field: 'shipping', align: 'center' },
  { name: 'method', label: '交易方式', field: 'method', align: 'center' },
  { name: 'tags', label: '标签', field: 'tags', align: 'left' },
  { name: 'createdAt', label: '提交时间', field: 'createdAt', align: 'center' },
  { name: 'status', label: '状态', field: 'status', align: 'center' },
  { name: 'reviewRemark', label: '备注', field: 'reviewRemark', align: 'left' },
  { name: 'action', label: '操作', field: 'action', align: 'right' }
]

function formatTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '-'
  return tags.join(' / ')
}

function applyFilters() {
  Object.assign(appliedFilters, filters)
}

function resetFilters() {
  filters.keyword = ''
  filters.seller = ''
  filters.status = ''
  filters.category = ''
  filters.campus = ''
  applyFilters()
}

function statusColor(status) {
  if (status === '待审核') return 'orange'
  if (status === '上架') return 'positive'
  if (status === '交易中') return 'primary'
  if (status === '驳回') return 'negative'
  if (status === '已售出') return 'dark'
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-item {
  min-width: 180px;
}

.filter-item-wide {
  min-width: 240px;
}

.filter-summary {
  margin-bottom: 16px;
}

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
