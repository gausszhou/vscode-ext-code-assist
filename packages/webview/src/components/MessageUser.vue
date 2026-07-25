<template>
  <div class="chat-message messgae-user">
    <div class="message-title">
      <span>You</span>
    </div>
    <div class="message-content">
      <div class="plain-content">{{ message.content }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChatMessage } from '@/models/Message';

const props = defineProps({
  message: {
    type: Object,
    default: () => new ChatMessage('user', ''),
  },
});
</script>

<style lang="scss" scoped>
.message-title {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.message-content {
  display: flex;
  justify-content: flex-end;
}

.messages-area  .messgae-user .markdown-content {
  max-width: 100%;
  font-size: 13px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--vscode-inputOption-activeBorder);
  background-color: var(--vscode-editor-background);
}
</style>