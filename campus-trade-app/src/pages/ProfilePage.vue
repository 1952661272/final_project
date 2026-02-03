<template>
  <q-page class="page">
    <div class="profile-grid">
      <q-card class="profile-card" flat bordered>
        <div class="profile-header">
          <q-avatar size="64px" color="primary" text-color="white" icon="person" />
          <div>
            <div class="profile-name">
              {{ store.state.user.name }}
              <span v-if="currentUserInfo?.verified" class="verified-badge">已认证</span>
            </div>
            <div class="muted">学号：20230001 · 学生</div>
          </div>
        </div>
        <div class="profile-actions">
          <q-btn unelevated class="btn-primary" label="发布闲置" to="/publish" />
          <q-btn flat class="btn-ghost" label="我的收藏" @click="showFavorites = true" />
        </div>
        <q-separator class="q-my-md" />
        <div class="stat-grid">
          <div class="stat">
            <div class="stat-value">{{ store.state.favorites.length }}</div>
            <div class="stat-label">收藏</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ myListings.length }}</div>
            <div class="stat-label">发布中</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ currentUserInfo?.credit || '4.8' }}</div>
            <div class="stat-label">信用评分</div>
          </div>
        </div>
      </q-card>

      <q-card class="profile-card" flat bordered>
        <div class="section-title">我的交易</div>
        <q-tabs v-model="tab" dense align="left" class="sub-tabs" active-color="primary">
          <q-tab name="buy" label="我买到的" />
          <q-tab name="sell" label="我卖掉的" />
          <q-tab name="listing" label="我发布的" />
        </q-tabs>

        <div v-if="tab === 'buy'" class="list-block">
          <div class="order-list">
            <q-card v-for="order in store.state.orders" :key="order.id" flat bordered class="order-card">
              <q-img
                v-if="getItemImages(order.item).length"
                :src="getItemImages(order.item)[0]"
                :ratio="1"
                class="order-cover"
              />
              <div v-else class="order-cover empty-thumb">暂无图片</div>
              <div class="order-body">
                <div class="order-title">{{ order.item }}</div>
                <div class="order-meta">订单号 {{ order.id }} · {{ order.status }}</div>
                <div class="order-meta">{{ order.method }} · {{ order.address }}</div>
                <div class="order-meta">卖家 {{ order.seller || '-' }} · {{ order.time }}</div>
              </div>
              <div class="order-actions">
                <div class="order-price">¥ {{ order.price }}</div>
                <q-btn
                  v-if="order.status === '待确认'"
                  unelevated
                  class="btn-primary"
                  label="付款"
                  size="sm"
                  @click="updateBuyStatus(order.id, '进行中')"
                />
                <q-btn
                  v-if="order.status === '待确认'"
                  flat
                  class="btn-ghost"
                  label="取消"
                  size="sm"
                  @click="updateBuyStatus(order.id, '已取消')"
                />
                <q-btn
                  v-if="order.status === '进行中'"
                  flat
                  class="btn-ghost"
                  label="确认收货"
                  size="sm"
                  @click="updateBuyStatus(order.id, '已完成')"
                />
                <q-btn
                  v-if="order.status === '已完成'"
                  flat
                  class="btn-ghost"
                  label="查看评价"
                  size="sm"
                  @click="notify('评价入口已打开')"
                />
                <q-btn
                  flat
                  class="btn-ghost"
                  label="详情"
                  size="sm"
                  @click="openOrderDetail(order, 'buy')"
                />
              </div>
            </q-card>
          </div>
        </div>

        <div v-else-if="tab === 'sell'" class="list-block">
          <div class="order-list">
            <q-card v-for="order in mySales" :key="order.id" flat bordered class="order-card">
              <q-img
                v-if="getItemImages(order.item).length"
                :src="getItemImages(order.item)[0]"
                :ratio="1"
                class="order-cover"
              />
              <div v-else class="order-cover empty-thumb">暂无图片</div>
              <div class="order-body">
                <div class="order-title">{{ order.item }}</div>
                <div class="order-meta">订单号 {{ order.id }} · {{ order.status }}</div>
                <div class="order-meta">{{ order.method }} · {{ order.address }}</div>
                <div class="order-meta">买家 {{ order.buyer || '-' }} · {{ order.time || '刚刚' }}</div>
              </div>
              <div class="order-actions">
                <div class="order-price">¥ {{ order.price }}</div>
                <q-btn
                  v-if="order.status === '待确认'"
                  unelevated
                  class="btn-primary"
                  label="同意"
                  size="sm"
                  @click="updateSellStatus(order.id, '已确认')"
                />
                <q-btn
                  v-if="order.status === '待确认'"
                  flat
                  class="btn-ghost"
                  label="拒绝"
                  size="sm"
                  @click="updateSellStatus(order.id, '已拒绝')"
                />
                <q-btn
                  v-if="order.status === '已确认'"
                  flat
                  class="btn-ghost"
                  label="已发货"
                  size="sm"
                  @click="updateSellStatus(order.id, '已完成')"
                />
                <q-btn
                  flat
                  class="btn-ghost"
                  label="详情"
                  size="sm"
                  @click="openOrderDetail(order, 'sell')"
                />
              </div>
            </q-card>
          </div>
        </div>

        <div v-else class="list-block">
          <q-card v-for="item in myListings" :key="item.id" flat bordered class="result-card">
            <q-img :src="item.images[0]" :ratio="1" class="result-img" />
            <div class="result-body">
              <div class="item-title">{{ item.title }}</div>
              <div class="item-meta">{{ item.campus }} · {{ item.time }} · 成色 {{ item.condition }}</div>
            </div>
            <div class="result-actions">
              <div class="price">¥ {{ item.price }}</div>
              <div class="item-meta status-pill">{{ item.status }}</div>
              <q-btn flat class="btn-ghost" label="详情" @click="openListingDetail(item)" />
              <q-btn flat class="btn-ghost" label="编辑" @click="openEdit(item)" />
              <q-btn
                v-if="item.status === '上架' || item.status === '下架'"
                unelevated
                class="btn-primary"
                :label="item.status === '上架' ? '下架' : '上架'"
                @click="toggleStatus(item)"
              />
              <q-btn
                v-if="item.status === '待审核'"
                flat
                class="btn-ghost"
                label="撤回"
                @click="recallItem(item)"
              />
              <q-btn
                v-if="item.status === '驳回'"
                unelevated
                class="btn-primary"
                label="重新提交"
                @click="resubmitItem(item)"
              />
            </div>
          </q-card>
        </div>
      </q-card>
    </div>

    <q-dialog v-model="showFavorites">
      <q-card class="picker-card">
        <div class="card-title">我的收藏</div>
        <div v-if="favoriteItems.length === 0" class="empty">暂无收藏商品</div>
        <div v-else class="result-list">
          <q-card v-for="item in favoriteItems" :key="item.id" flat bordered class="result-card">
            <q-img :src="item.images[0]" :ratio="1" class="result-img" />
            <div class="result-body">
              <div class="item-title">{{ item.title }}</div>
              <div class="item-meta">{{ item.campus }} · {{ item.time }} · {{ item.status }}</div>
            </div>
            <div class="result-actions">
              <div class="price">¥ {{ item.price }}</div>
              <q-btn flat class="btn-ghost" label="详情" :to="`/detail/${item.id}`" />
            </div>
          </q-card>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="关闭" v-close-popup />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEdit">
      <q-card class="picker-card">
        <div class="card-title">编辑商品信息</div>
        <div class="gallery-grid">
          <div v-for="(img, index) in editImages" :key="index" class="gallery-item">
            <img :src="img" alt="preview" />
            <div v-if="index === 0" class="cover-badge">主图</div>
            <q-btn flat dense icon="close" class="remove-btn" @click="removeEditImage(index)" />
            <q-btn flat dense icon="star" class="cover-btn" @click="setEditCover(index)" />
          </div>
        </div>
        <q-file
          v-model="editUpload"
          multiple
          accept="image/*"
          outlined
          dense
          label="更新商品图片（最多 6 张）"
          class="q-mt-sm"
          @update:model-value="handleEditFileSelect"
        />
        <div class="form-grid">
          <q-input v-model="editForm.title" outlined dense label="标题" />
          <q-input v-model="editForm.price" outlined dense label="价格" />
          <q-input v-model="editForm.condition" outlined dense label="成色" />
          <q-input v-model="editForm.desc" type="textarea" outlined label="描述" />
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="取消" v-close-popup />
          <q-btn unelevated class="btn-primary" label="保存" @click="saveEdit" />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showOrderDetail">
      <q-card class="picker-card">
        <div class="card-title">订单详情</div>
        <q-img
          v-if="orderItemInfo?.images?.length"
          :src="orderItemInfo.images[0]"
          :ratio="1"
          class="preview-img"
        />
        <div class="detail-list">
          <div><strong>订单号：</strong>{{ orderDetail.id }}</div>
          <div><strong>商品：</strong>{{ orderDetail.item }}</div>
          <div><strong>金额：</strong>¥ {{ orderDetail.price }}</div>
          <div><strong>状态：</strong>{{ orderDetail.status }}</div>
          <div><strong>交易方式：</strong>{{ orderDetail.method || '-' }}</div>
          <div><strong>交易地点：</strong>{{ orderDetail.address || '-' }}</div>
          <div><strong>时间：</strong>{{ orderDetail.time || '-' }}</div>
          <div v-if="orderDetail.seller"><strong>卖家：</strong>{{ orderDetail.seller }}</div>
          <div v-if="orderDetail.buyer"><strong>买家：</strong>{{ orderDetail.buyer }}</div>
        </div>
        <div class="dialog-actions">
          <q-btn flat class="btn-ghost" label="关闭" v-close-popup />
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showListingDetail">
      <q-card class="picker-card">
        <div class="card-title">发布详情</div>
        <q-img v-if="listingDetail.images?.length" :src="listingDetail.images[0]" :ratio="1" class="preview-img" />
        <div class="detail-list">
          <div><strong>商品：</strong>{{ listingDetail.title }}</div>
          <div><strong>价格：</strong>¥ {{ listingDetail.price }}</div>
          <div><strong>分类：</strong>{{ listingDetail.category }}</div>
          <div><strong>校区：</strong>{{ listingDetail.campus }}</div>
          <div><strong>成色：</strong>{{ listingDetail.condition }}</div>
          <div><strong>状态：</strong>{{ listingDetail.status }}</div>
          <div><strong>物流：</strong>{{ listingDetail.shipping }}</div>
          <div><strong>交易方式：</strong>{{ listingDetail.method }}</div>
          <div><strong>描述：</strong>{{ listingDetail.desc }}</div>
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
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const tab = ref('buy')

const currentUserInfo = computed(() => store.state.users.find((user) => user.name === store.state.user.name))
const myListings = computed(() => store.state.items.filter((item) => item.seller === store.state.user.name))
const mySales = computed(() => store.state.sellerOrders.filter((order) => order.seller === store.state.user.name))
const favoriteItems = computed(() => store.state.items.filter((item) => store.state.favorites.includes(item.id)))

const showFavorites = ref(false)
const showEdit = ref(false)
const showOrderDetail = ref(false)
const showListingDetail = ref(false)
const editUpload = ref([])
const editForm = ref({ id: null, title: '', price: '', condition: '', desc: '' })
const editImages = ref([])
const orderDetail = ref({})
const listingDetail = ref({})
const orderItemInfo = computed(() => store.state.items.find((item) => item.title === orderDetail.value.item))

function getItemImages (title) {
  const item = store.state.items.find((candidate) => candidate.title === title)
  return item?.images || []
}

function resizeImage (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxSize = 800
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const scale = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function updateBuyStatus (id, status) {
  store.updateOrderStatus(id, status)
  Notify.create({ type: 'positive', message: `订单状态已更新为 ${status}` })
}

function updateSellStatus (id, status) {
  store.updateSellerOrderStatus(id, status)
  Notify.create({ type: 'positive', message: `订单状态已更新为 ${status}` })
}

function openEdit (item) {
  editForm.value = { id: item.id, title: item.title, price: item.price, condition: item.condition, desc: item.desc }
  editImages.value = [...(item.images || [])]
  showEdit.value = true
}

async function handleEditFileSelect (files) {
  const list = Array.isArray(files) ? files : files ? [files] : []
  for (const file of list) {
    if (editImages.value.length >= 6) {
      Notify.create({ type: 'warning', message: '最多上传 6 张图片' })
      break
    }
    try {
      const dataUrl = await resizeImage(file)
      editImages.value.push(dataUrl)
    } catch (err) {
      Notify.create({ type: 'warning', message: '图片读取失败，请重试' })
    }
  }
  editUpload.value = []
}

function removeEditImage (idx) {
  editImages.value.splice(idx, 1)
}

function setEditCover (idx) {
  if (idx === 0) return
  const [img] = editImages.value.splice(idx, 1)
  editImages.value.unshift(img)
}

function saveEdit () {
  if (editImages.value.length === 0) {
    Notify.create({ type: 'warning', message: '请至少保留 1 张商品图片' })
    return
  }
  store.updateItem(editForm.value.id, {
    title: editForm.value.title,
    price: editForm.value.price,
    condition: editForm.value.condition,
    desc: editForm.value.desc,
    images: [...editImages.value]
  })
  const target = store.state.items.find((item) => item.id === editForm.value.id)
  if (target && target.status === '驳回') {
    store.setItemStatus(target.id, '待审核')
  }
  Notify.create({ type: 'positive', message: '商品信息已更新' })
  showEdit.value = false
}

function notify (message) {
  Notify.create({ type: 'info', message })
}

function toggleStatus (item) {
  store.toggleItemStatus(item.id)
  Notify.create({ type: 'info', message: `商品已${item.status}` })
}

function recallItem (item) {
  store.setItemStatus(item.id, '下架')
  Notify.create({ type: 'info', message: '商品已撤回' })
}

function resubmitItem (item) {
  store.setItemStatus(item.id, '待审核')
  Notify.create({ type: 'positive', message: '已重新提交审核' })
}

function openOrderDetail (order, type) {
  orderDetail.value = { ...order, type }
  showOrderDetail.value = true
}

function openListingDetail (item) {
  listingDetail.value = { ...item }
  showListingDetail.value = true
}
</script>
