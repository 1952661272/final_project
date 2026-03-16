<template>
  <q-page class="page login-page">
    <div class="auth-wrap">
      <q-card class="login-card auth-card" flat bordered>
        <div class="section-title">新用户注册</div>
        <q-input v-model="form.username" outlined dense label="姓名" class="q-mb-md" />
        <q-input v-model="form.studentNo" outlined dense label="学号" class="q-mb-md" />
        <q-input v-model="form.password" outlined dense type="password" label="密码" class="q-mb-md" />
        <q-input v-model="form.confirmPassword" outlined dense type="password" label="确认密码" class="q-mb-md" />
        <q-btn unelevated class="btn-primary full" label="注册并登录" @click="handleRegister" />
        <q-btn
          flat
          no-caps
          class="full q-mt-sm"
          color="primary"
          label="已有账号？返回登录"
          :to="{ name: 'login', query: { redirect: route.query.redirect } }"
        />
      </q-card>

      <q-card class="auth-aside" flat>
        <div class="auth-kicker">Campus Trade</div>
        <div class="auth-title">从注册开始，接入真实校园身份</div>
        <div class="auth-desc">注册后即可登录、发布商品、沟通协商，并保持用户身份与数据库一致。</div>
        <div class="auth-points">
          <div>1. 学号作为唯一登录账号</div>
          <div>2. 注册信息写入真实数据库用户表</div>
          <div>3. 注册成功后自动进入已登录状态</div>
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
const form = reactive({
  username: '',
  studentNo: '',
  password: '',
  confirmPassword: ''
})

async function handleRegister() {
  if (!form.username || !form.studentNo || !form.password || !form.confirmPassword) {
    Notify.create({ type: 'warning', message: '请完整填写注册信息' })
    return
  }
  if (form.password.length < 6) {
    Notify.create({ type: 'warning', message: '密码长度不能少于 6 位' })
    return
  }
  if (form.password !== form.confirmPassword) {
    Notify.create({ type: 'warning', message: '两次输入的密码不一致' })
    return
  }

  try {
    await store.register({
      username: form.username,
      studentNo: form.studentNo,
      password: form.password
    })
    Notify.create({ type: 'positive', message: '注册成功，已自动登录' })
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '注册失败' })
  }
}
</script>
