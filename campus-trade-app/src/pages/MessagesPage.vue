<template>
  <q-page class="page">
    <div class="section">
      <div class="section-title">消息中心</div>
      <div class="chat-layout">
        <div class="chat-list animate-list">
        <q-card
          v-for="(chat, idx) in chats"
          :key="chat.name"
          flat
          bordered
          :class="['chat-item', idx === activeIndex ? 'active' : '']"
          @click="selectChat(idx)"
        >
            <div class="chat-name">{{ chat.name }}</div>
            <div class="muted">{{ chat.messages[chat.messages.length - 1]?.text }}</div>
          </q-card>
        </div>
        <div class="chat-room">
          <div class="chat-header">
            <div class="chat-title">{{ activeChat?.name }}</div>
            <div class="muted">在线 · 建议校内面交</div>
          </div>
          <div class="chat-messages">
            <div v-for="(msg, idx) in activeChat?.messages" :key="idx" :class="['bubble', msg.from]">
              <div>{{ msg.text }}</div>
              <div class="bubble-time">{{ msg.time }}</div>
            </div>
          </div>
          <div class="chat-input">
            <q-input v-model="input" dense outlined placeholder="输入消息…" />
            <q-btn unelevated class="btn-primary" label="发送" @click="send" />
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store } from 'src/data/store'

const chats = store.state.chats
const activeIndex = ref(store.state.selectedChat)
const input = ref('')

const activeChat = computed(() => chats[activeIndex.value])

function selectChat (idx) {
  activeIndex.value = idx
  store.state.selectedChat = idx
}

function send () {
  if (!input.value.trim()) return
  store.state.selectedChat = activeIndex.value
  store.sendMessage(input.value)
  input.value = ''
}
</script>
