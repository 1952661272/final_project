<template>
  <q-page class="page">
    <div class="search-layout">
      <q-card class="filter-panel" flat bordered>
        <div class="panel-title">筛选条件</div>
        <q-input v-model="filters.keyword" outlined dense label="关键词" />
        <q-select v-model="filters.category" :options="categories" outlined dense label="分类" />
        <q-select v-model="filters.campus" :options="campuses" outlined dense label="校区" />
        <q-select v-model="filters.price" :options="priceOptions" outlined dense label="价格区间" />
        <q-select v-model="filters.condition" :options="conditionOptions" outlined dense label="成色" />
        <div class="panel-actions">
          <q-btn unelevated class="btn-primary full" label="应用筛选" @click="applyFilters" />
          <q-btn flat class="btn-ghost full" label="重置" @click="resetFilters" />
        </div>
      </q-card>

      <div class="search-results">
        <div class="result-header">
          <div>
            <div class="section-title">搜索结果</div>
            <div class="result-summary">共 {{ filteredItems.length }} 件 · 价格区间 ¥ {{ priceRange }}</div>
          </div>
          <div class="sort-row">
            <q-btn flat :class="sortClass('最新')" label="最新" @click="filters.sort = '最新'" />
            <q-btn flat :class="sortClass('价格升序')" label="价格↑" @click="filters.sort = '价格升序'" />
            <q-btn flat :class="sortClass('价格降序')" label="价格↓" @click="filters.sort = '价格降序'" />
          </div>
        </div>

        <div class="result-chips">
          <q-chip
            v-for="cat in categories"
            :key="cat"
            clickable
            class="chip"
            :class="{ active: filters.category === cat }"
            @click="filters.category = cat"
          >
            {{ cat }}
          </q-chip>
        </div>

        <div v-if="filteredItems.length === 0" class="empty">暂无符合条件的商品</div>
        <div v-else class="result-list animate-list">
          <q-card v-for="item in filteredItems" :key="item.id" class="result-card" flat bordered>
            <q-img :src="item.images[0]" :ratio="1" class="result-img" />
            <div class="result-body">
              <div class="item-title">{{ item.title }}</div>
              <div class="item-meta">{{ item.campus }} · {{ item.time }} · 成色 {{ item.condition }}</div>
              <div class="item-meta">{{ item.shipping }} · {{ item.method }}</div>
              <div class="tag-row">
                <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
              </div>
            </div>
            <div class="result-actions">
              <div class="price">¥ {{ item.price }}</div>
              <q-btn flat class="btn-ghost" label="详情" :to="`/detail/${item.id}`" />
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { categories, campuses } from 'src/data/mock'
import { store } from 'src/data/store'

const route = useRoute()

const priceOptions = ['全部', '0-100', '100-500', '500-2000', '2000+']
const conditionOptions = ['全部', '9-10', '8-9', '7-8', '7以下']

const defaultFilters = {
  keyword: route.query.keyword || '',
  category: route.query.category || '全部',
  campus: '全部',
  price: '全部',
  condition: '全部',
  sort: '最新'
}

const filters = reactive({ ...defaultFilters })

watch(
  () => route.query,
  (query) => {
    if (query.category) filters.category = query.category
    if (query.keyword) filters.keyword = query.keyword
  }
)

const filteredItems = computed(() => {
  let result = store.state.items.filter((item) => item.status === '上架')
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    result = result.filter((item) => item.title.toLowerCase().includes(keyword) || item.desc.toLowerCase().includes(keyword))
  }
  if (filters.category !== '全部') {
    result = result.filter((item) => item.category === filters.category)
  }
  if (filters.campus !== '全部') {
    result = result.filter((item) => item.campus === filters.campus)
  }
  if (filters.price !== '全部') {
    result = result.filter((item) => {
      if (filters.price === '0-100') return item.price <= 100
      if (filters.price === '100-500') return item.price > 100 && item.price <= 500
      if (filters.price === '500-2000') return item.price > 500 && item.price <= 2000
      if (filters.price === '2000+') return item.price > 2000
      return true
    })
  }
  if (filters.condition !== '全部') {
    result = result.filter((item) => {
      if (filters.condition === '9-10') return item.condition >= 9
      if (filters.condition === '8-9') return item.condition >= 8 && item.condition < 9
      if (filters.condition === '7-8') return item.condition >= 7 && item.condition < 8
      if (filters.condition === '7以下') return item.condition < 7
      return true
    })
  }
  if (filters.sort === '最新') {
    result.sort((a, b) => new Date(`${b.createdAt}T00:00:00`) - new Date(`${a.createdAt}T00:00:00`))
  }
  if (filters.sort === '价格升序') result.sort((a, b) => a.price - b.price)
  if (filters.sort === '价格降序') result.sort((a, b) => b.price - a.price)
  return result
})

const priceRange = computed(() => {
  if (filteredItems.value.length === 0) return '0 - 0'
  const prices = filteredItems.value.map((item) => item.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return `${min} - ${max}`
})

function applyFilters () {
  // computed handles it
}

function resetFilters () {
  Object.assign(filters, {
    keyword: route.query.keyword || '',
    category: route.query.category || '全部',
    campus: '全部',
    price: '全部',
    condition: '全部',
    sort: '最新'
  })
}

function sortClass (value) {
  return filters.sort === value ? 'sort-active' : ''
}
</script>
