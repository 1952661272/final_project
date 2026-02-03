<template>
  <q-page class="page admin-login">
    <q-card class="login-card" flat bordered>
      <div class="section-title">管理员登录</div>
      <q-input v-model="form.account" outlined dense label="管理员账号" class="q-mb-md" />
      <q-input v-model="form.password" outlined dense type="password" label="密码" class="q-mb-md" />
      <q-btn unelevated class="btn-primary full" label="登录" @click="login" />
      <div class="muted" style="margin-top: 10px;">默认账号：admin / 123456</div>
    </q-card>
  </q-page>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'

const router = useRouter()
const form = reactive({ account: '', password: '' })

function login () {
  if (!form.account || !form.password) {
    Notify.create({ type: 'warning', message: '请输入管理员账号与密码' })
    return
  }
  localStorage.setItem('admin_auth', '1')
  router.push({ name: 'admin-dashboard' })
}
</script>
