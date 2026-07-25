<template>
  <div class="app-footer footer-area">
    <div v-if="promptCode" class="prompt-code" :class="{ focus: promptCode }">
      <Markdown :content="promptCode"></Markdown>
    </div>
    <div class="prompt-area">
      <textarea
        ref="inputRef"
        v-model="modelValue"
        type="textarea"
        class="vscode-textarea"
        :class="{ focus: promptCode }"
        placeholder="Enter your question, use Shift + Enter to line break"
        :disabled="loading"
        @keypress="handleKeyPress"
      >
      </textarea>
      <button class="vscode-button is-icon button-code" :disabled="!promptCode && !modelValue" @click="$emit('code')">
        <el-icon>
          <component :is="modelValue ? DocumentAdd : DocumentRemove" />
        </el-icon>
      </button>
      <button class="vscode-button is-icon button-send" :disabled="!loading && !modelValue" @click="$emit('send')">
        <el-icon>
          <component :is="loading ? VideoPause : Promotion" />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DocumentAdd, DocumentRemove, VideoPause, Promotion } from '@element-plus/icons-vue';
import Markdown from '@/components/Markdown.vue';

const modelValue = defineModel<string>({ required: true });

const props = defineProps({
  loading: {
    default: false,
  },
  promptCode: {
    default: '',
  },
});
const emit = defineEmits(['update:model', 'change', 'code', 'send']);

// 处理键盘事件
const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    emit('send');
  }
};
</script>

<style lang="scss">
.footer-area {
  --button-position-padding: 4px;
  height: var(--chat-footer-height);
  position: relative;
  ::-webkit-scrollbar {
    display: none;
  }
}

.footer-area .prompt-code {
  z-index: 100;
  left: var(--prompt-position-padding);
  width: 100%;
  bottom: var(--chat-prompt-bottom);
  height: var(--chat-prompt-height);
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px 8px 0 0;
  border: 1px solid transparent;
  background-color: var(--vscode-input-background);

  &.focus {
    border-color: var(--vscode-inputOption-activeBorder);
    border-bottom: none;
  }

  .markdown-body pre {
    margin: 0;
  }
}

.footer-area .prompt-area {
  position: relative;
  height: var(--chat-footer-height);
}

.footer-area .vscode-textarea {
  width: 100%;
  height: 100%;
  border-radius: 0 0 8px 8px;
}

.footer-area .vscode-textarea {
  scrollbar-width: 0;
}

.footer-area .button-code,
.footer-area .button-send {
  position: absolute;
  right: var(--button-position-padding);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-area .button-code {
  top: var(--button-position-padding);
}

.footer-area .button-send {
  bottom: var(--button-position-padding);
}
</style>
