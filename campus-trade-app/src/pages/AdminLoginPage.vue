<template>
  <q-page class="page admin-login">
    <div class="auth-wrap admin-auth-wrap">
      <q-card class="login-card auth-card" flat bordered>
        <div class="section-title">管理员登录</div>
        <q-input v-model="form.account" outlined dense label="管理员账号" class="q-mb-md" />
        <q-input v-model="form.password" outlined dense type="password" label="密码" class="q-mb-md" />
        <q-btn unelevated class="btn-primary full" label="登录" @click="login" />
        <div class="muted q-mt-sm">默认账号：admin / 123456</div>
      </q-card>

      <q-card class="auth-aside admin-auth-aside" flat>
        <div class="auth-kicker">Admin Console</div>
        <div class="auth-title">平台治理与运营监控中心</div>
        <div class="auth-desc">集中完成商品审核、用户治理和平台数据分析，保障交易秩序与系统稳定运行。</div>
        <div class="auth-points">
          <div>1. 待审商品快速处理</div>
          <div>2. 用户状态与风险管控</div>
          <div>3. 运营数据趋势可视化</div>
        </div>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { store } from 'src/data/store'

const router = useRouter()
const form = reactive({ account: '', password: '' })

async function login () {
  if (!form.account || !form.password) {
    Notify.create({ type: 'warning', message: '请输入管理员账号与密码' })
    return
  }
  try {
    await store.adminLogin(form.account, form.password)
    localStorage.setItem('admin_auth', '1')
    router.push({ name: 'admin-dashboard' })
  } catch (error) {
    Notify.create({ type: 'negative', message: error.message || '管理员登录失败' })
  }
}
</script>
