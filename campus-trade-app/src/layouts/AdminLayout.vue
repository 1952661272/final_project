<template>
  <q-layout view="lHh Lpr lFf" class="admin-shell">
    <q-header elevated class="admin-header">
      <q-toolbar>
        <div class="brand">
          <div class="brand-mark">管</div>
          <div>
            <div class="brand-title">管理后台</div>
            <div class="brand-sub">校园二手交易平台 · Admin</div>
          </div>
        </div>
        <q-space />
        <q-btn flat icon="home" label="返回前台" to="/" />
        <q-btn flat icon="logout" label="退出" @click="logout" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above bordered class="admin-drawer">
      <div class="drawer-title">后台导航</div>
      <q-list>
        <q-item clickable v-ripple :to="{ name: 'admin-dashboard' }">
          <q-item-section avatar><q-icon name="dashboard" /></q-item-section>
          <q-item-section>数据看板</q-item-section>
        </q-item>
        <q-item clickable v-ripple :to="{ name: 'admin-listings' }">
          <q-item-section avatar><q-icon name="verified" /></q-item-section>
          <q-item-section>商品审核</q-item-section>
        </q-item>
        <q-item clickable v-ripple :to="{ name: 'admin-users' }">
          <q-item-section avatar><q-icon name="people" /></q-item-section>
          <q-item-section>用户管理</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <transition name="page-fade" mode="out-in">
        <router-view />
      </transition>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const drawer = ref(true)

function logout () {
  localStorage.removeItem('admin_auth')
  router.push({ name: 'admin-login' })
}
</script>
