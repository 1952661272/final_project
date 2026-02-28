<template>
  <q-page class="page login-page">
    <div class="auth-wrap">
      <q-card class="login-card auth-card" flat bordered>
        <div class="section-title">用户登录</div>
        <q-input v-model="form.name" outlined dense label="昵称 / 学号" class="q-mb-md" />
        <q-input v-model="form.password" outlined dense type="password" label="密码" class="q-mb-md" />
        <q-btn unelevated class="btn-primary full" label="登录" @click="handleLogin" />
        <div class="muted q-mt-sm">默认账号：张同学 / 任意密码</div>
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
const form = reactive({ name: '张同学', password: '' })

function handleLogin () {
  if (!form.name) {
    Notify.create({ type: 'warning', message: '请输入账号' })
    return
  }
  const user = store.state.users.find((candidate) => candidate.name === form.name)
  if (user && user.status === '禁用') {
    Notify.create({ type: 'negative', message: '该账号已被禁用，请联系管理员' })
    return
  }
  localStorage.setItem('user_auth', '1')
  store.login(form.name)
  const redirect = route.query.redirect || '/'
  router.push(redirect)
}
</script>
