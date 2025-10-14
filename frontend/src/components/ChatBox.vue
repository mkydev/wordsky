<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import type { Socket } from 'socket.io-client';

interface Message {
  playerName: string;
  message: string;
  timestamp: string;
}

const props = defineProps<{
  socket: Socket;
  roomId: string;
  playerName: string;
}>();

const messages = ref<Message[]>([]);
const newMessage = ref('');
const chatBody = ref<HTMLElement | null>(null);

function sendMessage() {
  if (newMessage.value.trim()) {
    props.socket.emit('sendMessage', {
      roomId: props.roomId,
      message: newMessage.value.trim(),
    });
    newMessage.value = '';
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight;
    }
  });
}

onMounted(() => {
  props.socket.on('newMessage', (message: Message) => {
    messages.value.push(message);
    scrollToBottom();
  });
});

watch(messages, () => {
  scrollToBottom();
}, { deep: true });
</script>

<template>
  <div class="chat-container">
    <div class="chat-header">
      <h3>Sohbet</h3>
    </div>
    <div class="chat-body" ref="chatBody">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="message"
        :class="{ 'my-message': msg.playerName === playerName }"
      >
        <div class="message-sender" v-if="msg.playerName !== playerName">{{ msg.playerName }}</div>
        <div class="message-content">{{ msg.message }}</div>
        <div class="message-time">{{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
      </div>
       <div v-if="messages.length === 0" class="no-messages">
        Henüz hiç mesaj yok.
      </div>
    </div>
    <div class="chat-footer">
      <input
        type="text"
        v-model="newMessage"
        placeholder="Mesajını yaz..."
        class="chat-input"
        @keyup.enter="sendMessage"
      />
      <button @click="sendMessage" class="send-btn">Gönder</button>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 400px;
  background-color: var(--background-color-soft);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--button-border);
  margin-top: 1rem;
}
.chat-header {
  padding: 0.75rem;
  background-color: var(--background-color);
  border-bottom: 1px solid var(--button-border);
  text-align: center;
}
.chat-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.chat-body {
  flex-grow: 1;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  width: fit-content;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  background-color: var(--button-bg);
  align-self: flex-start;
}
.message.my-message {
  align-self: flex-end;
  background-color: var(--success-color);
  color: white;
}
.message-sender {
  font-size: 0.75rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
  color: var(--text-color-muted);
}
.my-message .message-sender {
  display: none;
}
.message-content {
  font-size: 0.9rem;
  word-wrap: break-word;
}
.message-time {
  font-size: 0.7rem;
  align-self: flex-end;
  margin-top: 0.2rem;
  opacity: 0.7;
}
.no-messages {
  text-align: center;
  color: var(--text-color-muted);
  font-size: 0.9rem;
  margin: auto;
}
.chat-footer {
  display: flex;
  padding: 0.5rem;
  border-top: 1px solid var(--button-border);
  gap: 0.5rem;
}
.chat-input {
  flex-grow: 1;
  border: none;
  background-color: var(--background-color);
  color: var(--text-color);
  padding: 0.6rem;
  border-radius: 8px;
  font-size: 0.9rem;
}
.chat-input:focus {
  outline: 1px solid var(--success-color);
}
.send-btn {
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  background-color: var(--success-color);
  color: white;
  font-weight: bold;
  cursor: pointer;
}

@media (min-width: 769px) {
  .chat-container {
    margin-top: 0;
    max-height: none;
  }
}
</style>
