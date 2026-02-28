<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <div class="layout-orbs" aria-hidden="true">
      <span class="orb orb-a"></span>
      <span class="orb orb-b"></span>
      <span class="orb orb-c"></span>
    </div>
    <q-header elevated class="header-bar">
      <q-toolbar class="header-toolbar">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <div class="brand">
          <div class="brand-mark">校园</div>
          <div>
            <div class="brand-title">校园二手交易平台</div>
            <div class="brand-sub">高效、安全、面向校园的闲置交易</div>
          </div>
        </div>

        <q-space />

        <div class="search-bar">
          <q-input
            v-model="searchKeyword"
            dense
            outlined
            rounded
            placeholder="搜索商品/校园/关键词"
            class="search-input"
            @keyup.enter="doSearch"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
          <q-btn unelevated class="btn-primary" label="搜索" @click="doSearch" />
        </div>

        <q-space />

        <div class="header-actions">
          <q-btn flat icon="notifications_none" label="提醒" class="header-action-btn header-alert">
            <q-badge v-if="alertCount > 0" floating rounded color="negative" />
          </q-btn>
          <q-btn
            v-if="!store.state.user.loggedIn"
            flat
            icon="login"
            label="登录"
            class="header-action-btn"
            to="/login"
          />
          <q-btn
            v-else
            flat
            icon="account_circle"
            :label="store.state.user.name"
            class="header-action-btn"
            to="/profile"
          />
          <q-btn
            v-if="store.state.user.loggedIn"
            flat
            icon="logout"
            label="退出"
            class="header-action-btn"
            @click="logout"
          />
        </div>
      </q-toolbar>

      <q-tabs dense align="left" class="nav-tabs" active-color="primary" indicator-color="primary">
        <q-route-tab to="/" label="首页" exact />
        <q-route-tab to="/search" label="搜索" />
        <q-route-tab to="/publish" label="发布" />
        <q-route-tab to="/messages" label="消息" />
        <q-route-tab to="/profile" label="我的" />
      </q-tabs>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      class="left-drawer"
    >
      <div class="drawer-hero">
        <div class="drawer-kicker">Category</div>
        <div class="drawer-title">分类导航</div>
        <div class="drawer-sub">按品类快速查看在售商品与热门频道</div>
      </div>
      <q-list class="drawer-category-list">
        <q-item
          v-for="cat in drawerCategories"
          :key="cat.name"
          class="category-tile"
          clickable
          v-ripple
          :to="cat.to"
          @click="leftDrawerOpen = false"
        >
          <q-item-section avatar>
            <div class="category-icon" :style="{ '--cat-tone': cat.tone }">
              <q-icon :name="cat.icon" size="20px" />
            </div>
          </q-item-section>
          <q-item-section>
            <q-item-label class="category-name">{{ cat.name }}</q-item-label>
            <q-item-label caption class="category-desc">{{ cat.desc }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge rounded color="primary" class="category-count">{{ cat.count }}</q-badge>
          </q-item-section>
        </q-item>
      </q-list>
      <div class="drawer-block drawer-scenes">
        <div class="drawer-title drawer-title-plain">快速筛选</div>
        <q-list class="drawer-scene-list">
          <q-item
            v-for="scene in drawerScenes"
            :key="scene.key"
            clickable
            v-ripple
            class="scene-tile"
            :to="scene.to"
            @click="leftDrawerOpen = false"
          >
            <q-item-section avatar>
              <div class="scene-icon">
                <q-icon :name="scene.icon" size="18px" />
              </div>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ scene.label }}</q-item-label>
              <q-item-label caption>{{ scene.hint }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge outline color="primary">{{ scene.count }}</q-badge>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      <div class="drawer-block drawer-shortcuts">
        <div class="drawer-title drawer-title-plain">快捷入口</div>
        <q-btn unelevated class="full-width btn-primary q-mb-sm drawer-cta" icon="add_circle" label="发布闲置" to="/publish" />
        <q-btn flat class="full-width btn-ghost drawer-cta-ghost" icon="inventory_2" label="我的订单" to="/profile" />
      </div>
    </q-drawer>

    <q-page-container>
      <transition name="page-fade" mode="out-in">
        <router-view />
      </transition>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { categories } from 'src/data/mock'
import { store } from 'src/data/store'

const leftDrawerOpen = ref(false)
const searchKeyword = ref('')
const router = useRouter()
const categoryMeta = {
  数码: { icon: 'devices_other', desc: '手机、平板、电脑与配件', tone: '#0ea5e9' },
  教材: { icon: 'menu_book', desc: '课程教材与考研资料', tone: '#16a34a' },
  生活用品: { icon: 'weekend', desc: '宿舍日用与家居小件', tone: '#f59e0b' },
  交通工具: { icon: 'directions_bike', desc: '自行车及通勤装备', tone: '#8b5cf6' },
  租房: { icon: 'apartment', desc: '短租转租与室友招募', tone: '#ec4899' }
}

const drawerCategories = computed(() => {
  return categories
    .filter((cat) => cat !== '全部')
    .map((name) => {
      const meta = categoryMeta[name] || { icon: 'widgets', desc: '更多分类', tone: '#0ea5e9' }
      const count = store.state.items.filter((item) => item.category === name && item.status === '上架').length
      return {
        name,
        ...meta,
        count,
        to: { name: 'search-category', params: { category: name }, query: compactQuery({ sort: '最新' }) }
      }
    })
})

function matchWithQuery (item, query = {}) {
  if (item.status !== '上架') return false
  if (query.category && query.category !== '全部' && item.category !== query.category) return false
  if (query.campus && query.campus !== '全部' && item.campus !== query.campus) return false
  if (query.price && query.price !== '全部') {
    if (query.price === '0-100' && item.price > 100) return false
    if (query.price === '100-500' && (item.price <= 100 || item.price > 500)) return false
    if (query.price === '500-2000' && (item.price <= 500 || item.price > 2000)) return false
    if (query.price === '2000+' && item.price <= 2000) return false
  }
  if (query.condition && query.condition !== '全部') {
    if (query.condition === '9-10' && item.condition < 9) return false
    if (query.condition === '8-9' && (item.condition < 8 || item.condition >= 9)) return false
    if (query.condition === '7-8' && (item.condition < 7 || item.condition >= 8)) return false
    if (query.condition === '7以下' && item.condition >= 7) return false
  }
  return true
}

function countByQuery (query = {}) {
  return store.state.items.filter((item) => matchWithQuery(item, query)).length
}

const drawerScenes = computed(() => {
  const scenes = [
    { key: 'cheap', label: '低价捡漏', hint: '100元以内 · 价格升序', icon: 'savings', query: { price: '0-100', sort: '价格升序' } },
    { key: 'digital', label: '数码精选', hint: '数码品类 · 500元以内', icon: 'memory', query: { category: '数码', price: '100-500', sort: '价格升序' } },
    { key: 'books', label: '教材专区', hint: '教材最新发布', icon: 'library_books', query: { category: '教材', sort: '最新' } },
    { key: 'dorm', label: '宿舍好物', hint: '生活用品 · 低价优先', icon: 'chair', query: { category: '生活用品', price: '0-100', sort: '价格升序' } }
  ]
  return scenes.map((scene) => ({
    ...scene,
    count: countByQuery(scene.query),
    to: { name: 'search', query: compactQuery(scene.query) }
  }))
})

const alertCount = computed(() => {
  const buyPending = store.state.orders.filter((order) => order.status === '待确认').length
  const sellPending = store.state.sellerOrders.filter((order) => order.status === '待确认').length
  return buyPending + sellPending
})

function compactQuery (query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== '全部')
  )
}

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function logout () {
  localStorage.removeItem('user_auth')
  store.logout()
}

function doSearch () {
  if (!searchKeyword.value.trim()) {
    router.push({ name: 'search' })
    return
  }
  router.push({ name: 'search', query: { keyword: searchKeyword.value.trim() } })
}

onMounted(() => {
  if (!store.state.user.loggedIn && localStorage.getItem('user_auth') === '1') {
    const name = store.state.user.name || '张同学'
    const user = store.state.users.find((item) => item.name === name)
    if (user && user.status === '禁用') {
      localStorage.removeItem('user_auth')
      return
    }
    store.login(name)
  }
})
</script>
