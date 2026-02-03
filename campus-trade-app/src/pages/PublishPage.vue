<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">发布闲置</div>
      <div class="publish-steps">步骤：1. 选择图片 → 2. 填写信息 → 3. 确认发布</div>
      <div class="publish-grid">
        <q-card class="publish-card" flat bordered>
          <div class="card-title">1. 选择图片</div>
          <div class="gallery-grid">
            <div v-for="(img, index) in selectedImages" :key="index" class="gallery-item">
              <img :src="img" alt="preview" />
              <div v-if="index === 0" class="cover-badge">主图</div>
              <q-btn flat dense icon="close" class="remove-btn" @click="removeImage(index)" />
              <q-btn flat dense icon="star" class="cover-btn" @click="setCover(index)" />
            </div>
          </div>
          <q-file
            v-model="uploadFiles"
            multiple
            accept="image/*"
            outlined
            dense
            label="上传商品图片（最多 6 张）"
            class="q-mt-md"
            @update:model-value="handleFileSelect"
          />
          <div class="muted q-mt-sm">支持 JPG/PNG，图片会自动压缩以便保存。</div>
        </q-card>

        <q-card class="publish-card" flat bordered>
          <div class="card-title">2. 填写商品信息</div>
          <div class="form-grid">
            <q-input v-model="form.title" outlined dense label="标题" />
            <q-input v-model="form.price" outlined dense label="价格" />
            <q-select v-model="form.category" :options="categoryOptions" outlined dense label="分类" />
            <q-select v-model="form.campus" :options="campusOptions" outlined dense label="校区" />
            <q-input v-model="form.condition" outlined dense label="成色" />
            <q-input v-model="form.desc" type="textarea" outlined label="描述" />
            <q-input v-model="form.shipping" outlined dense label="物流方式" />
            <q-input v-model="form.method" outlined dense label="交易方式" />
          </div>
          <div class="form-actions">
            <q-btn unelevated class="btn-primary" label="发布" @click="publish" />
            <q-btn flat class="btn-ghost" label="保存草稿" @click="saveDraft" />
          </div>
        </q-card>

        <q-card class="publish-card" flat bordered>
          <div class="card-title">3. 预览</div>
          <q-img v-if="previewImage" :src="previewImage" :ratio="1" class="preview-img" />
          <div v-else class="preview-placeholder">请先上传商品图片</div>
          <div class="preview-title">{{ form.title || '默认标题：九成新无线键盘' }}</div>
          <div class="preview-meta">{{ form.campus }} · 成色 {{ form.condition }}</div>
          <div class="price">¥ {{ form.price || '99' }}</div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Notify } from 'quasar'
import { categories, campuses } from 'src/data/mock'
import { store } from 'src/data/store'

const categoryOptions = categories.filter((cat) => cat !== '全部')
const campusOptions = campuses.filter((campus) => campus !== '全部')

const uploadFiles = ref([])
const selectedImages = ref([])

const form = reactive({
  title: '',
  price: '',
  category: '数码',
  campus: '北校区',
  condition: '9',
  desc: '',
  shipping: '包邮',
  method: '面交优先'
})

const previewImage = computed(() => selectedImages.value[0] || '')

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

async function handleFileSelect (files) {
  const list = Array.isArray(files) ? files : files ? [files] : []
  for (const file of list) {
    if (selectedImages.value.length >= 6) {
      Notify.create({ type: 'warning', message: '最多上传 6 张图片' })
      break
    }
    try {
      const dataUrl = await resizeImage(file)
      selectedImages.value.push(dataUrl)
    } catch (err) {
      Notify.create({ type: 'warning', message: '图片读取失败，请重试' })
    }
  }
  uploadFiles.value = []
}

function removeImage (idx) {
  selectedImages.value.splice(idx, 1)
}

function setCover (idx) {
  if (idx === 0) return
  const [img] = selectedImages.value.splice(idx, 1)
  selectedImages.value.unshift(img)
}

function publish () {
  if (!form.title || !form.price) {
    Notify.create({ type: 'warning', message: '请填写标题与价格' })
    return
  }
  if (selectedImages.value.length === 0) {
    Notify.create({ type: 'warning', message: '请至少上传 1 张图片' })
    return
  }
  store.publishItem({
    ...form,
    images: [...selectedImages.value],
    tags: ['新发布']
  })
  Notify.create({ type: 'positive', message: '发布成功，商品已提交审核' })
  form.title = ''
  form.price = ''
  form.desc = ''
  selectedImages.value = []
}

function saveDraft () {
  Notify.create({ type: 'info', message: '草稿已保存' })
}
</script>
