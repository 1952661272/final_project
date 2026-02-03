<template>
  <q-page class="page">
    <div v-if="!item" class="empty">未找到该商品</div>
    <div v-else class="detail-layout">
      <div class="detail-media">
        <q-img :src="currentImage" :ratio="1" class="detail-main" />
        <div class="detail-thumbs">
          <img
            v-for="(img, idx) in item.images"
            :key="img"
            :src="img"
            :class="['thumb', idx === activeIndex ? 'active' : '']"
            @click="activeIndex = idx"
          />
        </div>
      </div>
      <div class="detail-info">
        <div class="detail-title">{{ item.title }}</div>
        <div class="price">¥ {{ item.price }}</div>
        <div class="detail-meta">{{ item.campus }} · 成色 {{ item.condition }} · {{ item.time }} · {{ item.status }}</div>
        <div class="detail-meta">{{ item.shipping }} · {{ item.method }}</div>

        <q-banner v-if="!isAvailable" class="status-banner" dense>
          该商品当前为「{{ item.status }}」，暂不可购买。
        </q-banner>

        <div class="detail-block">
          <div class="detail-label">标签</div>
          <div class="detail-tags">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-label">商品描述</div>
          <div class="detail-desc">{{ item.desc }}</div>
        </div>

        <div class="detail-block">
          <div class="detail-label">卖家信息</div>
          <q-card flat bordered class="seller-card">
            <div class="seller-name">
              {{ item.seller }}
              <span v-if="sellerInfo?.verified" class="verified-badge">已认证</span>
            </div>
            <div class="muted">
              {{ sellerInfo?.campus || item.campus }} · 信用 {{ sellerInfo?.credit || '4.6' }}
              · 在售 {{ sellerListings }} 件
            </div>
            <div class="muted">发布 {{ item.time }} · 浏览 {{ item.views }}</div>
            <div class="seller-actions">
              <q-btn flat class="btn-ghost" label="查看主页" to="/profile" />
              <q-btn flat class="btn-ghost" label="联系卖家" to="/messages" />
            </div>
          </q-card>
        </div>

        <div class="detail-actions">
          <q-btn unelevated class="btn-primary" label="我想要" :disable="!isAvailable" @click="buyNow" />
          <q-btn outline class="btn-ghost" label="私聊" :disable="!isAvailable" @click="chatNow" />
          <q-btn
            flat
            class="link"
            :label="store.isFavorite(item.id) ? '已收藏' : '收藏'"
            @click="store.toggleFavorite(item.id)"
          />
        </div>

        <q-card class="safe-tip" flat>
          <div class="safe-title">安全提示</div>
          <div class="safe-desc">建议校内面交，验货后再付款，避免校外交易风险。</div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const route = useRoute()
const itemId = Number(route.params.id)
const router = useRouter()
const item = store.state.items.find((it) => it.id === itemId)

const activeIndex = ref(0)
const currentImage = computed(() => (item ? item.images[activeIndex.value] : ''))
const isAvailable = computed(() => item && item.status === '上架')
const sellerInfo = computed(() => store.state.users.find((user) => user.name === item?.seller))
const sellerListings = computed(() => store.state.items.filter((it) => it.seller === item?.seller && it.status === '上架').length)

function buyNow () {
  if (!item || !isAvailable.value) return
  if (!store.state.user.loggedIn) {
    Notify.create({ type: 'warning', message: '请先登录再下单' })
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  store.createOrder(item)
  Notify.create({ type: 'positive', message: '订单已创建' })
  router.push({ name: 'profile' })
}

function chatNow () {
  if (!item || !isAvailable.value) return
  if (!store.state.user.loggedIn) {
    Notify.create({ type: 'warning', message: '请先登录再私聊' })
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  store.startChat(item.seller)
  router.push({ name: 'messages' })
}
</script>
