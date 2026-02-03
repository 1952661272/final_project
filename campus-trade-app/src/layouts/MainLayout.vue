<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
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
          <q-btn flat icon="notifications_none" label="提醒" />
          <q-btn
            v-if="!store.state.user.loggedIn"
            flat
            icon="login"
            label="登录"
            to="/login"
          />
          <q-btn
            v-else
            flat
            icon="account_circle"
            :label="store.state.user.name"
            to="/profile"
          />
          <q-btn
            v-if="store.state.user.loggedIn"
            flat
            icon="logout"
            label="退出"
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
      <div class="drawer-title">分类导航</div>
      <q-list>
        <q-item
          v-for="cat in drawerCategories"
          :key="cat"
          clickable
          v-ripple
          :to="{ name: 'search', query: { category: cat } }"
        >
          <q-item-section>{{ cat }}</q-item-section>
        </q-item>
      </q-list>
      <div class="drawer-block">
        <div class="drawer-title">快捷入口</div>
        <q-btn outline class="full-width q-mb-sm" label="发布闲置" to="/publish" />
        <q-btn outline class="full-width" label="我的订单" to="/profile" />
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
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { categories } from 'src/data/mock'
import { store } from 'src/data/store'

const leftDrawerOpen = ref(false)
const searchKeyword = ref('')
const router = useRouter()
const drawerCategories = categories.filter((cat) => cat !== '全部')

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
