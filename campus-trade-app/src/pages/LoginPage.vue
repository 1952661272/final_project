<template>
  <q-page class="page login-page">
    <div class="auth-wrap">
      <q-card class="login-card auth-card" flat bordered>
        <div class="section-title">用户登录</div>
        <q-input v-model="form.account" outlined dense label="学号" class="q-mb-md" />
        <q-input v-model="form.password" outlined dense type="password" label="密码" class="q-mb-md" />
        <q-btn unelevated class="btn-primary full" label="登录" @click="handleLogin" />
        <q-btn
          flat
          no-caps
          class="full q-mt-sm"
          color="primary"
          label="没有账号？去注册"
          :to="{ name: 'register', query: { redirect: route.query.redirect } }"
        />
        <div class="muted q-mt-sm">演示账号：202301 / 123456</div>
      </q-card>

      <q-card class="auth-aside" flat>
        <div class="auth-kicker">Campus Trade</div>
        <div class="auth-title">让闲置更快找到下一位主人</div>
        <div class="auth-desc">同校认证、即时沟通、流程闭环，面向校园场景打造轻量安全的二手交易体验。</div>
        <div class="auth-points">
          <div>1. 统一身份与认证标识</div>
          <div>2. 发布-审核-成交全流程追踪</div>
          <div>3. 支持买卖双角色一体管理</div>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const router = useRouter()
const route = useRoute()
const form = reactive({ account: '202301', password: '123456' })

async function handleLogin() {
  if (!form.account || !form.password) {
    Notify.create({ type: 'warning', message: '请输入学号和密码' })
    return
  }

  try {
    await store.login(form.account, form.password)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '登录失败' })
  }
}
</script>
