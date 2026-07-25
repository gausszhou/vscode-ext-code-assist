<template>
  <div class="chat-header">
    <div class="chat-header-left">
      <span class="chat-header-title">{{ title || 'Chat' }}</span>
    </div>
    <div class="chat-header-right">
      <el-icon class="header-icon" title="会话列表" @click="$emit('toggleSessions')">
        <FolderOpened />
      </el-icon>
      <el-icon class="header-icon" title="设置" @click="gotoSetting">
        <Setting />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderOpened, Setting } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';

const router = useRouter();

defineProps({
  title: { default: '' },
  sessionsOpen: { default: false },
});

defineEmits<{
  toggleSessions: [];
}>();

const gotoSetting = () => {
  router.push('/setting');
};
</script>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  flex-shrink: 0;
}

.chat-header-left {
  flex: 1;
  min-width: 0;
}

.chat-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vscode-foreground, #cccccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-icon {
  font-size: 18px;
  color: var(--vscode-icon-foreground, #999);
  cursor: pointer;
  transition: color 0.15s;
}

.header-icon:hover {
  color: var(--vscode-foreground, #ccc);
}
</style>
