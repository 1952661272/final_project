<template>
  <q-page class="page">
    <div class="home-top">
      <div class="hero-block animate-in" style="--delay: 0s">
        <div>
          <div class="hero-title">校园热卖榜</div>
          <div class="hero-sub">同校优质好物，真实图片与即时沟通</div>
          <div class="hero-meta">今日上新 {{ newItemsCount }} 件 · 热门收藏 {{ totalFavorites }} 次</div>
        </div>
        <div class="hero-actions">
          <q-btn unelevated class="btn-primary" label="去逛一逛" @click="goExplore" />
          <q-btn flat class="btn-ghost" label="发布闲置" @click="goPublish" />
        </div>
      </div>

      <div class="home-banners animate-list">
        <q-card
          v-for="banner in banners"
          :key="banner.title"
          class="banner-card clickable-card"
          flat
          bordered
          @click="handleBanner(banner)"
        >
          <div class="banner-tag">{{ banner.tag }}</div>
          <div class="banner-title">{{ banner.title }}</div>
          <div class="banner-desc">{{ banner.desc }}</div>
        </q-card>
      </div>
    </div>

    <div class="section">
      <div class="section-title">热门分类</div>
      <div class="chip-row animate-list">
        <q-chip
          v-for="cat in displayCategories"
          :key="cat"
          clickable
          class="chip"
          @click="goSearch(cat)"
        >
          {{ cat }}
        </q-chip>
      </div>
    </div>

    <div class="section">
      <div class="section-title">校园频道</div>
      <div class="channel-grid animate-list">
        <q-card
          class="channel-card clickable-card"
          v-for="channel in channels"
          :key="channel.title"
          @click="goSearch(channel.tag)"
        >
          <div class="channel-tag">{{ channel.tag }}</div>
          <div class="channel-title">{{ channel.title }}</div>
          <div class="channel-desc">{{ channel.desc }}</div>
        </q-card>
      </div>
    </div>

    <div class="section">
      <div class="section-title">今日热卖</div>
      <div class="item-grid animate-list">
        <q-card v-for="item in hotItems" :key="item.id" class="item-card" flat bordered>
          <q-img :src="item.images[0]" :ratio="1" class="item-img">
            <div class="item-price">¥ {{ item.price }}</div>
          </q-img>
          <div class="item-body">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-meta">{{ item.campus }} · {{ item.time }} · 成色 {{ item.condition }}</div>
            <div class="item-stats">浏览 {{ item.views }} · 收藏 {{ item.likes }}</div>
            <div class="item-actions">
              <q-btn flat class="link" label="查看详情" :to="`/detail/${item.id}`" />
              <q-btn
                flat
                class="link"
                :label="store.isFavorite(item.id) ? '已收藏' : '收藏'"
                @click="store.toggleFavorite(item.id)"
              />
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="showVerify">
      <q-card class="picker-card">
        <div class="card-title">校园认证</div>
        <div class="detail-list">
          <div><strong>认证状态：</strong>{{ isVerified ? '已认证' : '未认证' }}</div>
          <div><strong>认证权益：</strong>展示认证徽章 · 提升交易可信度</div>
          <div><strong>认证流程：</strong>填写学号 → 上传校园卡 → 完成审核</div>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="稍后再说" v-close-popup />
          <q-btn
            unelevated
            class="btn-primary"
            :disable="isVerified || !store.state.user.loggedIn"
            :label="store.state.user.loggedIn ? (isVerified ? '已认证' : '立即认证') : '请先登录'"
            @click="confirmVerify"
          />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { categories } from 'src/data/mock'
import { store } from 'src/data/store'

const router = useRouter()

const displayCategories = categories.filter((cat) => cat !== '全部')

function formatDate (date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const today = formatDate(new Date())

const newItemsCount = computed(() => store.state.items.filter((item) => item.createdAt === today).length)
const totalFavorites = computed(() => store.state.items.reduce((sum, item) => sum + (item.likes || 0), 0))

const hotItems = computed(() => {
  return store.state.items
    .filter((item) => item.status === '上架')
    .slice()
    .sort((a, b) => (b.likes + b.views / 10) - (a.likes + a.views / 10))
    .slice(0, 8)
})

const channels = [
  { title: '同校数码', desc: '好价电子产品集合', tag: '数码' },
  { title: '考研资料', desc: '高频教材与讲义', tag: '教材' },
  { title: '宿舍必备', desc: '生活用品一站购齐', tag: '生活用品' },
  { title: '通勤代步', desc: '自行车与配件', tag: '交通工具' }
]

const banners = [
  { tag: '校园认证', title: '同校交易更安心', desc: '学号认证 + 面交建议', action: 'verify' },
  { tag: '精选数码', title: '数码捡漏专区', desc: '近期低价好物合集', action: 'category', value: '数码' },
  { tag: '闲置回收', title: '图书资料专区', desc: '教材讲义一站购齐', action: 'category', value: '教材' }
]

const showVerify = ref(false)
const currentUser = computed(() => store.state.users.find((user) => user.name === store.state.user.name))
const isVerified = computed(() => currentUser.value?.verified)

function goSearch (cat) {
  router.push({ name: 'search', query: { category: cat } })
}

function goExplore () {
  router.push({ name: 'search' })
}

function goPublish () {
  if (!store.state.user.loggedIn) {
    router.push({ name: 'login', query: { redirect: '/publish' } })
    return
  }
  router.push({ name: 'publish' })
}

function handleBanner (banner) {
  if (banner.action === 'verify') {
    showVerify.value = true
    return
  }
  if (banner.action === 'category') {
    goSearch(banner.value)
  }
}

function confirmVerify () {
  if (!store.state.user.loggedIn) return
  store.verifyCurrentUser()
  Notify.create({ type: 'positive', message: '认证信息已提交' })
  showVerify.value = false
}
</script>
