<template>
  <div class="chat-message message-stream">
    <div class="message-title">
      <span>Bot</span>
    </div>
    <el-collapse v-if="message.reasoning" v-model="activeNames" class="reasoning-box" expand-icon-position="left" value="Think">
      <el-collapse-item title="Think" name="Think">
        <div class="reasoning-content">
          {{ message.reasoning }}
        </div>
      </el-collapse-item>
    </el-collapse>
    <div v-if="message.content" class="markdown-content">
      <Markdown :content="message.content" />
    </div>
    <div class="footer-content"></div>
  </div>
</template>

<script setup lang="ts">
import Markdown from '@/components/Markdown.vue';
import { ChatMessage } from '@/models/Message';
import { ref } from 'vue';

const props = defineProps({
  message: {
    type: Object,
    default: () => new ChatMessage('agent', ''),
  },
});

const activeNames = ref([]);
</script>

<style lang="scss" scoped>
.message-title {
  margin-bottom: 8px;
}

.reasoning-box {
  margin-bottom: 16px;
}

.message-stream .reasoning-content {
  font-size: 12px;
}

.footer-content {
  margin-top: 4px;
  height: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
