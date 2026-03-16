<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">消息中心</div>
          <div class="section-sub">聊天会话和系统通知统一展示，先沟通再购买。</div>
        </div>
      </div>

      <div class="inbox-layout">
        <aside class="inbox-sidebar">
          <div class="sidebar-top">
            <div>
              <div class="sidebar-title">全部消息</div>
              <div class="sidebar-sub">支持搜索、置顶和未读提醒</div>
            </div>
            <q-badge color="primary" rounded>{{ filteredInboxItems.length }}</q-badge>
          </div>

          <q-input
            v-model="searchKeyword"
            outlined
            dense
            clearable
            placeholder="搜索联系人、商品或通知"
            class="sidebar-search"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>

          <div v-if="!filteredInboxItems.length" class="empty-sidebar">
            <q-icon name="forum" size="32px" color="grey-5" />
            <div>{{ searchKeyword ? '没有匹配的消息结果' : '还没有新的聊天或系统通知' }}</div>
          </div>

          <div v-else class="inbox-list">
            <button
              v-for="item in filteredInboxItems"
              :key="item.key"
              type="button"
              :class="['inbox-item', selectedKey === item.key ? 'active' : '', !item.read ? 'unread' : '']"
              @click="selectInbox(item)"
            >
              <div class="inbox-avatar" :class="item.type">
                <q-icon :name="item.type === 'chat' ? 'chat_bubble_outline' : 'campaign'" size="20px" />
              </div>
              <div class="inbox-copy">
                <div class="inbox-line">
                  <span class="inbox-name">
                    {{ item.title }}
                    <q-icon v-if="item.pinned" name="push_pin" size="14px" class="pin-mark" />
                  </span>
                  <span class="inbox-time">{{ item.timeText }}</span>
                </div>
                <div v-if="item.subtitle" class="inbox-subtitle">{{ item.subtitle }}</div>
                <div class="inbox-preview">{{ item.preview }}</div>
              </div>
              <q-badge v-if="item.unreadCount > 0" color="negative" rounded>{{ item.unreadCount }}</q-badge>
            </button>
          </div>
        </aside>

        <section class="inbox-detail">
          <div v-if="!activeInbox" class="detail-empty">
            <q-icon name="mark_chat_unread" size="48px" color="grey-5" />
            <div class="detail-empty-title">选择一条消息开始处理</div>
            <div class="detail-empty-sub">商品咨询、系统通知和购买流程都会在这里联动显示。</div>
          </div>

          <template v-else-if="activeInbox.type === 'chat'">
            <div class="detail-header">
              <div>
                <div class="detail-title">{{ activeInbox.title }}</div>
                <div class="detail-muted">围绕商品继续沟通，确认无误后再创建订单。</div>
              </div>
              <div class="detail-actions">
                <q-btn
                  flat
                  round
                  dense
                  :icon="activeInbox.pinned ? 'push_pin' : 'keep_off'"
                  :aria-label="activeInbox.pinned ? '取消置顶' : '置顶会话'"
                  @click="togglePin(activeInbox)"
                />
                <q-badge outline color="primary">{{ activeInbox.chat.listingStatus }}</q-badge>
              </div>
            </div>

            <q-card flat bordered class="listing-card">
              <div class="listing-copy">
                <div class="listing-title">{{ activeInbox.chat.listingTitle }}</div>
                <div class="listing-meta">¥ {{ activeInbox.chat.listingPrice }} · {{ activeInbox.chat.listingStatus }}</div>
                <div v-if="relatedOrder" class="listing-order-status">
                  当前订单：{{ relatedOrder.status }}
                  <span v-if="relatedOrder.paymentStatus"> · {{ relatedOrder.paymentStatus }}</span>
                </div>
              </div>
              <div class="listing-actions">
                <q-btn
                  unelevated
                  class="btn-primary"
                  label="购买"
                  :disable="purchaseDisabled"
                  @click="purchaseFromChat"
                />
                <div class="listing-hint">{{ purchaseHint }}</div>
              </div>
            </q-card>

            <div class="message-stream">
              <template v-for="group in messageGroups" :key="group.label">
                <div class="message-day">{{ group.label }}</div>
                <div
                  v-for="message in group.messages"
                  :key="message.id"
                  :class="['message-bubble', message.from]"
                >
                  <div class="message-text">{{ message.text }}</div>
                  <div class="message-time">{{ formatTime(message.time) }}</div>
                </div>
              </template>
            </div>

            <div class="message-input">
              <q-input
                v-model="draft"
                outlined
                autogrow
                placeholder="输入消息，和卖家先确认成色、时间和地点"
                @keyup.enter.exact.prevent="send"
              />
              <q-btn unelevated class="btn-primary" label="发送" @click="send" />
            </div>
          </template>

          <template v-else>
            <div class="detail-header">
              <div>
                <div class="detail-title">系统通知</div>
                <div class="detail-muted">商品审核、订单流转和平台消息都会出现在这里。</div>
              </div>
              <q-badge :color="activeInbox.notification.read ? 'positive' : 'negative'">
                {{ activeInbox.notification.read ? '已读' : '未读' }}
              </q-badge>
            </div>

            <q-card flat bordered class="system-card">
              <div class="system-title">{{ activeInbox.notification.title }}</div>
              <div class="system-time">{{ formatTime(activeInbox.notification.createdAt) }}</div>
              <div class="system-content">{{ activeInbox.notification.content }}</div>
              <div class="system-links">
                <q-btn
                  v-if="activeInbox.notification.relatedListingId"
                  flat
                  class="btn-ghost"
                  label="查看商品"
                  :to="{ name: 'detail', params: { id: activeInbox.notification.relatedListingId } }"
                />
                <q-btn
                  v-if="activeInbox.notification.relatedOrderId"
                  flat
                  class="btn-ghost"
                  label="查看订单"
                  :to="{ name: 'order-detail', params: { id: activeInbox.notification.relatedOrderId }, query: { role: 'buy' } }"
                />
              </div>
            </q-card>
          </template>
        </section>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const route = useRoute()
const router = useRouter()

const draft = ref('')
const searchKeyword = ref('')
const selectedKey = ref('')

function formatTime(value) {
  if (!value) return ''
  return String(value).replace(/^(\d{4})-/, '')
}

function formatDayLabel(value) {
  if (!value) return '更早'
  const today = new Date()
  const label = String(value).slice(0, 10)
  const date = new Date(`${label}T00:00:00`)
  const diff = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - date) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return label.replace(/^(\d{4})-/, '')
}

const allOrders = computed(() => [...store.state.orders, ...store.state.sellerOrders])

const inboxItems = computed(() => {
  const chatItems = store.state.chats.map((chat) => ({
    key: `chat:${chat.id}`,
    type: 'chat',
    pinned: !!chat.pinned,
    read: !chat.unreadCount,
    unreadCount: chat.unreadCount || 0,
    title: chat.name,
    subtitle: chat.listingTitle,
    preview: chat.lastMessage?.text || chat.messages.at(-1)?.text || '点击继续沟通',
    timeText: formatTime(chat.updatedAt || chat.lastMessage?.time),
    sortValue: chat.updatedAt || chat.lastMessage?.time || '',
    searchText: `${chat.name} ${chat.listingTitle} ${chat.lastMessage?.text || ''}`.toLowerCase(),
    chat
  }))

  const notificationItems = store.state.notifications.map((notification) => ({
    key: `notification:${notification.id}`,
    type: 'system',
    pinned: false,
    read: !!notification.read,
    unreadCount: notification.read ? 0 : 1,
    title: notification.title,
    subtitle: '系统通知',
    preview: notification.content,
    timeText: formatTime(notification.createdAt),
    sortValue: notification.createdAt || '',
    searchText: `${notification.title} ${notification.content}`.toLowerCase(),
    notification
  }))

  return [...chatItems, ...notificationItems].sort((left, right) => {
    if (right.pinned !== left.pinned) return Number(right.pinned) - Number(left.pinned)
    return String(right.sortValue).localeCompare(String(left.sortValue))
  })
})

const filteredInboxItems = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return inboxItems.value
  return inboxItems.value.filter((item) => item.searchText.includes(keyword))
})

const activeInbox = computed(() => filteredInboxItems.value.find((item) => item.key === selectedKey.value) || null)

const relatedOrder = computed(() => {
  const chat = activeInbox.value?.chat
  if (!chat) return null
  return allOrders.value.find((order) => order.listingId === chat.listingId) || null
})

const isOwnListingConversation = computed(() => {
  const chat = activeInbox.value?.chat
  if (!chat) return false
  const listing = store.state.items.find((item) => item.id === chat.listingId)
  return listing?.seller === store.state.user.name
})

const purchaseDisabled = computed(() => {
  const chat = activeInbox.value?.chat
  if (!chat) return true
  if (isOwnListingConversation.value) return true
  if (relatedOrder.value) return true
  return chat.listingStatus !== '上架'
})

const purchaseHint = computed(() => {
  const chat = activeInbox.value?.chat
  if (!chat) return ''
  if (isOwnListingConversation.value) return '不能购买自己发布的商品'
  if (relatedOrder.value) return `该商品已有订单：${relatedOrder.value.status}`
  if (chat.listingStatus !== '上架') return `商品当前状态为“${chat.listingStatus}”，暂时不能购买`
  return '确认交易细节后，再从这里创建订单'
})

const messageGroups = computed(() => {
  const chat = activeInbox.value?.chat
  if (!chat) return []
  const groups = []
  for (const message of chat.messages || []) {
    const dayKey = String(message.time || '').slice(0, 10)
    const lastGroup = groups.at(-1)
    if (!lastGroup || lastGroup.key !== dayKey) {
      groups.push({
        key: dayKey,
        label: formatDayLabel(dayKey),
        messages: [message]
      })
      continue
    }
    lastGroup.messages.push(message)
  }
  return groups
})

function syncSelection() {
  const conversationId = String(route.query.conversationId || '').trim()
  const notificationId = String(route.query.notificationId || '').trim()

  if (conversationId) {
    const key = `chat:${conversationId}`
    if (filteredInboxItems.value.some((item) => item.key === key)) {
      selectedKey.value = key
      return
    }
  }

  if (notificationId) {
    const key = `notification:${notificationId}`
    if (filteredInboxItems.value.some((item) => item.key === key)) {
      selectedKey.value = key
      return
    }
  }

  if (!selectedKey.value || !filteredInboxItems.value.some((item) => item.key === selectedKey.value)) {
    selectedKey.value = filteredInboxItems.value[0]?.key || ''
  }
}

async function markActiveAsRead(item) {
  if (!item) return
  try {
    if (item.type === 'chat' && item.unreadCount > 0) {
      const index = store.state.chats.findIndex((chat) => chat.id === item.chat.id)
      if (index >= 0) store.setSelectedChat(index)
      await store.markConversationRead(item.chat.id)
    }
    if (item.type === 'system' && !item.notification.read) {
      await store.markNotificationRead(item.notification.id)
    }
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '同步已读状态失败' })
  }
}

async function selectInbox(item) {
  selectedKey.value = item.key
  if (item.type === 'chat') {
    const index = store.state.chats.findIndex((chat) => chat.id === item.chat.id)
    if (index >= 0) store.setSelectedChat(index)
    await router.replace({ name: 'messages', query: { conversationId: item.chat.id } })
  } else {
    await router.replace({ name: 'messages', query: { notificationId: item.notification.id } })
  }
  await markActiveAsRead(item)
}

async function send() {
  const text = draft.value.trim()
  const chat = activeInbox.value?.chat
  if (!chat || !text) return
  try {
    const index = store.state.chats.findIndex((item) => item.id === chat.id)
    if (index >= 0) store.setSelectedChat(index)
    await store.sendMessage(text)
    draft.value = ''
    await router.replace({ name: 'messages', query: { conversationId: chat.id } })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '发送失败' })
  }
}

async function purchaseFromChat() {
  const chat = activeInbox.value?.chat
  if (!chat || purchaseDisabled.value) return
  try {
    await store.createOrder({ id: chat.listingId })
    Notify.create({ type: 'positive', message: '订单已创建，请等待卖家确认后完成付款' })
    await router.replace({ name: 'messages', query: { conversationId: chat.id } })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '创建订单失败' })
  }
}

async function togglePin(item) {
  if (!item?.chat) return
  try {
    await store.toggleConversationPin(item.chat.id, !item.pinned)
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '会话置顶失败' })
  }
}

watch(
  () => [route.query.conversationId, route.query.notificationId, filteredInboxItems.value.length],
  () => {
    syncSelection()
  },
  { immediate: true }
)

watch(
  activeInbox,
  async (item, previous) => {
    if (!item || item.key === previous?.key) return
    await markActiveAsRead(item)
  }
)

onMounted(async () => {
  await store.bootstrap()
  syncSelection()
  if (activeInbox.value) {
    await markActiveAsRead(activeInbox.value)
  }
})
</script>

<style scoped>
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-sub {
  color: var(--text-muted);
  margin-top: 6px;
}

.inbox-layout {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 20px;
  min-height: 700px;
}

.inbox-sidebar,
.inbox-detail {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 28px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.inbox-sidebar {
  padding: 20px;
}

.sidebar-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.sidebar-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-dark);
}

.sidebar-sub {
  color: var(--text-muted);
  margin-top: 4px;
}

.sidebar-search {
  margin-bottom: 16px;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inbox-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 20px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.inbox-item:hover,
.inbox-item.active {
  transform: translateY(-1px);
  border-color: rgba(11, 125, 142, 0.3);
  box-shadow: 0 14px 28px rgba(11, 125, 142, 0.12);
}

.inbox-item.unread {
  background: linear-gradient(135deg, rgba(219, 242, 244, 0.9), rgba(255, 255, 255, 0.95));
}

.inbox-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
}

.inbox-avatar.chat {
  background: linear-gradient(135deg, #0b7d8e, #1f9aa8);
}

.inbox-avatar.system {
  background: linear-gradient(135deg, #f59e0b, #fb7185);
}

.inbox-copy {
  min-width: 0;
  flex: 1;
}

.inbox-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.inbox-name {
  font-weight: 700;
  color: var(--text-dark);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pin-mark {
  color: var(--primary);
}

.inbox-time,
.system-time,
.message-time,
.detail-muted,
.inbox-subtitle,
.inbox-preview,
.listing-hint,
.listing-order-status,
.detail-empty-sub,
.sidebar-sub {
  color: var(--text-muted);
}

.inbox-subtitle,
.inbox-preview {
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-sidebar,
.detail-empty {
  min-height: 280px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.detail-empty-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-dark);
}

.inbox-detail {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-dark);
}

.listing-card,
.system-card {
  border-radius: 24px;
  padding: 18px;
}

.listing-card {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  background: linear-gradient(135deg, rgba(219, 242, 244, 0.72), rgba(255, 255, 255, 0.96));
}

.listing-copy {
  min-width: 0;
}

.listing-title,
.system-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-dark);
}

.listing-meta {
  margin-top: 6px;
  color: var(--primary);
  font-weight: 700;
}

.listing-order-status,
.listing-hint {
  margin-top: 8px;
}

.listing-actions {
  min-width: 180px;
  text-align: right;
}

.message-stream {
  flex: 1;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  background: rgba(246, 249, 251, 0.95);
  overflow-y: auto;
}

.message-day {
  align-self: center;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-muted);
  background: rgba(15, 23, 42, 0.06);
}

.message-bubble {
  max-width: min(72%, 520px);
  padding: 14px 16px 10px;
  border-radius: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.message-bubble.me {
  align-self: flex-end;
  background: linear-gradient(135deg, #0b7d8e, #1f9aa8);
  color: #fff;
}

.message-bubble.other {
  align-self: flex-start;
  background: #fff;
}

.message-text {
  line-height: 1.6;
}

.message-time {
  margin-top: 8px;
  font-size: 12px;
}

.message-bubble.me .message-time {
  color: rgba(255, 255, 255, 0.75);
}

.message-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.system-content {
  margin-top: 14px;
  line-height: 1.8;
  color: var(--text-dark);
}

.system-links {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 1100px) {
  .inbox-layout {
    grid-template-columns: 1fr;
  }

  .listing-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .listing-actions {
    width: 100%;
    min-width: 0;
    text-align: left;
  }
}

@media (max-width: 720px) {
  .message-input {
    grid-template-columns: 1fr;
  }

  .detail-header {
    flex-direction: column;
  }

  .message-bubble {
    max-width: 90%;
  }
}
</style>
