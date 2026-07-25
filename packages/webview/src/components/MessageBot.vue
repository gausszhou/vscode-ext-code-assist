<template>
  <div class="chat-message message-bot">
    <div class="message-title">
      <span>Bot</span>
    </div>
    <el-collapse v-if="message.reasoning" v-model="activeNames" class="reasoning-box" expand-icon-position="left">
      <el-collapse-item title="Think" name="Think">
        <div class="reasoning-content">
          {{ message.reasoning }}
        </div>
      </el-collapse-item>
    </el-collapse>
    <div v-if="message.content" class="markdown-content">
      <Markdown :content="message.content" mode="full"></Markdown>
    </div>
    <div class="footer-content">
      <el-icon v-if="!copied" class="message-icon" @click="copyContent(message.content)">
        <CopyDocument />
      </el-icon>
      <el-icon v-else>
        <Check />
      </el-icon>
      <MessageInfo :message="message" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChatMessage } from '@/models/Message';
import { copyToClipboard } from '@/utils';
import { Check, CopyDocument } from '@element-plus/icons-vue';
import { ref } from 'vue';
import Markdown from '@/components/Markdown.vue';
import MessageInfo from './MessageInfo.vue';

const props = defineProps({
  message: {
    default: () => new ChatMessage('agent', ''),
  },
});
const activeNames = ref([]);
const copied = ref(false);
const copyContent = async (content: string) => {
  await copyToClipboard(content);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1000);
};
</script>

<style lang="scss">
.message-title {
  margin-bottom: 8px;
}

.reasoning-box {
  margin-bottom: 16px;
}

.message-bot .reasoning-content {
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
