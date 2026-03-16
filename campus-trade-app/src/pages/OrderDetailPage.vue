<template>
  <q-page class="page">
    <div class="section">
      <div class="section-head">
        <div>
          <div class="section-title">订单详情</div>
          <div class="section-sub">查看订单状态、支付信息和完整操作时间线。</div>
        </div>
        <q-btn flat class="btn-ghost" label="返回我的交易" :to="{ name: 'profile', query: { tab: roleTab } }" />
      </div>

      <div v-if="loading" class="empty-state">
        <q-spinner color="primary" size="40px" />
        <div>正在加载订单信息...</div>
      </div>

      <div v-else-if="!order.id" class="empty-state">
        <q-icon name="receipt_long" size="40px" color="grey-5" />
        <div>没有找到这笔订单</div>
      </div>

      <div v-else class="detail-grid">
        <q-card flat bordered class="detail-card detail-main">
          <div class="hero-head">
            <div>
              <div class="hero-title">{{ order.item }}</div>
              <div class="hero-sub">订单号 {{ order.id }}</div>
            </div>
            <div class="hero-price">¥ {{ order.price }}</div>
          </div>

          <div v-if="paymentSuccessBanner" class="success-banner">
            付款已完成，当前状态为“{{ order.status }}”。
          </div>

          <div class="status-grid">
            <div class="status-chip">
              <span class="status-label">订单状态</span>
              <strong>{{ order.status }}</strong>
            </div>
            <div class="status-chip">
              <span class="status-label">支付状态</span>
              <strong>{{ order.paymentStatus || '未支付' }}</strong>
            </div>
            <div class="status-chip">
              <span class="status-label">支付方式</span>
              <strong>{{ order.paymentMethod || '待选择' }}</strong>
            </div>
            <div class="status-chip">
              <span class="status-label">交易方式</span>
              <strong>{{ order.method || '-' }}</strong>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-row"><span>交易地点</span><strong>{{ order.address || '-' }}</strong></div>
            <div class="info-row"><span>更新时间</span><strong>{{ order.time || '-' }}</strong></div>
            <div class="info-row" v-if="order.buyer"><span>买家</span><strong>{{ order.buyer }}</strong></div>
            <div class="info-row" v-if="order.seller"><span>卖家</span><strong>{{ order.seller }}</strong></div>
          </div>

          <div v-if="order.rejectReason || order.cancelReason" class="reason-panel">
            <div v-if="order.rejectReason" class="reason-line">
              <span class="reason-key">拒绝原因</span>
              <span>{{ order.rejectReason }}</span>
            </div>
            <div v-if="order.cancelReason" class="reason-line">
              <span class="reason-key">取消原因</span>
              <span>{{ order.cancelReason }}</span>
            </div>
          </div>

          <div class="action-row">
            <q-btn
              v-if="canConfirm"
              unelevated
              class="btn-primary"
              label="确认订单"
              @click="changeStatus('已确认')"
            />
            <q-btn
              v-if="canReject"
              flat
              class="btn-ghost"
              label="拒绝订单"
              @click="changeStatus('已拒绝', true)"
            />
            <q-btn
              v-if="canPay"
              unelevated
              class="btn-primary"
              label="去付款"
              @click="showPaymentDialog = true"
            />
            <q-btn
              v-if="canComplete"
              unelevated
              class="btn-primary"
              label="完成订单"
              @click="changeStatus('已完成')"
            />
            <q-btn
              v-if="canCancel"
              flat
              class="btn-ghost"
              label="取消订单"
              @click="changeStatus('已取消', true)"
            />
            <q-btn flat class="btn-ghost" label="查看商品" :to="{ name: 'detail', params: { id: order.listingId } }" />
          </div>
        </q-card>

        <q-card flat bordered class="detail-card side-card" v-if="orderItem">
          <q-img :src="orderItem.images?.[0]" :ratio="1" class="cover-img" />
          <div class="side-title">{{ orderItem.title }}</div>
          <div class="side-meta">{{ orderItem.campus }} · 成色 {{ orderItem.condition }} · {{ orderItem.status }}</div>
          <div class="side-desc">{{ orderItem.desc }}</div>
        </q-card>

        <q-card flat bordered class="detail-card timeline-card">
          <div class="card-title">订单时间线</div>
          <div v-if="!orderLogs.length" class="empty-inline">还没有操作记录</div>
          <div v-else class="timeline">
            <div v-for="log in orderLogs" :key="log.id" class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-body">
                <div class="timeline-title">{{ log.toStatus }}</div>
                <div class="timeline-meta">{{ log.createdAt }} · {{ log.operator }}</div>
                <div v-if="log.note" class="timeline-note">{{ log.note }}</div>
              </div>
            </div>
          </div>
        </q-card>
      </div>
    </div>

    <q-dialog v-model="showPaymentDialog">
      <q-card class="picker-card">
        <div class="card-title">选择付款方式</div>
        <div class="detail-list">
          <div><strong>订单号：</strong>{{ order.id || '-' }}</div>
          <div><strong>商品：</strong>{{ order.item || '-' }}</div>
          <div><strong>应付金额：</strong>¥ {{ order.price || 0 }}</div>
        </div>
        <q-option-group
          v-model="paymentMethod"
          type="radio"
          color="primary"
          :options="paymentOptions"
          class="q-mt-md"
        />
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="取消" v-close-popup />
          <q-btn unelevated class="btn-primary" label="确认付款" @click="payOrderNow" />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Dialog, Notify } from 'quasar'
import { store } from 'src/data/store'

const route = useRoute()

const loading = ref(true)
const order = ref({})
const orderLogs = ref([])
const showPaymentDialog = ref(false)
const paymentMethod = ref('微信支付')
const paymentSuccessBanner = ref(false)

const paymentOptions = [
  { label: '微信支付', value: '微信支付' },
  { label: '支付宝', value: '支付宝' },
  { label: '银行卡', value: '银行卡' },
  { label: '当面付款', value: '当面付款' }
]

const roleTab = computed(() => String(route.query.role || 'buy'))
const orderItem = computed(() => store.state.items.find((item) => item.id === order.value.listingId))
const isBuyerView = computed(() => roleTab.value !== 'sell')
const isSellerView = computed(() => roleTab.value === 'sell')

const canPay = computed(() => isBuyerView.value && order.value.status === '已确认')
const canConfirm = computed(() => isSellerView.value && order.value.status === '待确认')
const canReject = computed(() => isSellerView.value && order.value.status === '待确认')
const canComplete = computed(() => order.value.status === '进行中')
const canCancel = computed(() => ['待确认', '已确认', '进行中'].includes(order.value.status))

async function loadOrder() {
  loading.value = true
  try {
    await store.bootstrap()
    order.value = await store.getOrderDetail(String(route.params.id))
    orderLogs.value = await store.getOrderLogs(String(route.params.id))
    if (String(route.query.action || '') === 'pay' && canPay.value) {
      showPaymentDialog.value = true
    }
  } catch (error) {
    order.value = {}
    orderLogs.value = []
    Notify.create({ type: 'negative', message: error.message || '订单详情加载失败' })
  } finally {
    loading.value = false
  }
}

function requestReason(title) {
  return new Promise((resolve) => {
    Dialog.create({
      title,
      prompt: {
        model: '',
        type: 'text',
        isValid: (value) => String(value || '').trim().length > 0
      },
      cancel: true,
      persistent: true
    }).onOk((value) => resolve(String(value || '').trim()))
      .onCancel(() => resolve(''))
      .onDismiss(() => resolve(''))
  })
}

async function changeStatus(status, requireReason = false) {
  const reason = requireReason
    ? await requestReason(status === '已拒绝' ? '请输入拒绝原因' : '请输入取消原因')
    : ''
  if (requireReason && !reason) return

  try {
    if (reason) {
      await store.updateOrderStatusWithReason(order.value.id, status, reason)
    } else if (isSellerView.value) {
      await store.updateSellerOrderStatus(order.value.id, status)
    } else {
      await store.updateOrderStatus(order.value.id, status)
    }
    await loadOrder()
    Notify.create({ type: 'positive', message: `订单已更新为“${status}”` })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '订单状态更新失败' })
  }
}

async function payOrderNow() {
  try {
    await store.payOrder(order.value.id, paymentMethod.value)
    showPaymentDialog.value = false
    paymentSuccessBanner.value = true
    await loadOrder()
    Notify.create({ type: 'positive', message: `付款成功，已使用${paymentMethod.value}` })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '付款失败' })
  }
}

watch(
  () => route.params.id,
  () => {
    paymentSuccessBanner.value = false
    void loadOrder()
  }
)

onMounted(() => {
  void loadOrder()
})
</script>

<style scoped>
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.section-sub {
  margin-top: 6px;
  color: var(--text-muted);
}

.empty-state {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.9fr);
  gap: 20px;
}

.detail-card {
  border-radius: 28px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.detail-main {
  grid-column: 1;
}

.side-card {
  grid-column: 2;
  align-self: start;
}

.timeline-card {
  grid-column: 1 / span 2;
}

.hero-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.hero-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-dark);
}

.hero-sub {
  margin-top: 6px;
  color: var(--text-muted);
}

.hero-price {
  font-size: 30px;
  font-weight: 800;
  color: var(--primary);
}

.success-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 18px;
  color: #0f5132;
  background: linear-gradient(135deg, rgba(214, 248, 226, 0.95), rgba(243, 255, 248, 0.96));
  border: 1px solid rgba(42, 157, 90, 0.2);
}

.status-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.status-chip {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(246, 249, 251, 0.95);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  color: var(--text-muted);
  font-size: 13px;
}

.info-grid {
  margin-top: 20px;
  display: grid;
  gap: 12px;
}

.info-row,
.reason-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.info-row span,
.reason-key {
  color: var(--text-muted);
}

.reason-panel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 22px;
  background: rgba(255, 247, 237, 0.95);
}

.action-row {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.cover-img {
  border-radius: 22px;
  overflow: hidden;
}

.side-title {
  margin-top: 16px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-dark);
}

.side-meta,
.side-desc,
.timeline-meta,
.timeline-note,
.empty-inline {
  color: var(--text-muted);
}

.side-meta {
  margin-top: 6px;
}

.side-desc {
  margin-top: 12px;
  line-height: 1.7;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-dark);
}

.timeline {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 14px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  margin-top: 6px;
  background: linear-gradient(135deg, #0b7d8e, #1f9aa8);
  box-shadow: 0 0 0 5px rgba(11, 125, 142, 0.12);
}

.timeline-title {
  font-weight: 700;
  color: var(--text-dark);
}

.timeline-meta {
  margin-top: 4px;
}

.timeline-note {
  margin-top: 6px;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-main,
  .side-card,
  .timeline-card {
    grid-column: auto;
  }
}

@media (max-width: 680px) {
  .section-head,
  .hero-head,
  .info-row,
  .reason-line {
    flex-direction: column;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
