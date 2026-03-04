<template>
  <div v-if="!store.state.ready" class="app-loading">
    <q-spinner color="primary" size="36px" />
    <div class="loading-text">正在连接后端服务...</div>
  </div>
  <router-view v-else />
</template>

<script setup>
import { onMounted } from 'vue'
import { store } from 'src/data/store'

onMounted(() => {
  void store.bootstrap()
})
</script>

<style scoped>
.app-loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #54627a;
}

.loading-text {
  font-size: 14px;
}
</style>
