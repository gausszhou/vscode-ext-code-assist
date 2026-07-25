<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="session-modal-overlay" @click.self="$emit('close')">
        <div class="session-modal">
          <div class="session-modal-header">
            <span class="session-modal-title">会话列表</span>
            <el-icon class="session-modal-close" @click="$emit('close')">
              <Close />
            </el-icon>
          </div>
          <div class="session-modal-body">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="session-item"
              :class="{ active: s.id === activeId }"
              @click="selectSession(s.id)"
            >
              <span class="session-item-title">{{ s.title || '新会话' }}</span>
              <span class="session-item-id">{{ s.id }}</span>
            </div>
            <div v-if="sessions.length === 0" class="session-empty">
              <el-icon class="session-empty-icon"><ChatDotRound /></el-icon>
              <span>暂无会话</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { agentClient } from '@/agent/agent.client';
import { Close, ChatDotRound } from '@element-plus/icons-vue';
import { onMounted, ref, watch } from 'vue';

interface SessionItem {
  id: string;
  title: string;
}

const props = defineProps({
  activeId: { default: '' },
  visible: { default: false },
});

const emit = defineEmits<{
  select: [id: string];
  close: [];
}>();

const sessions = ref<SessionItem[]>([]);

const load = async () => {
  const list = await agentClient.listSessions();
  sessions.value = list.map((s: any) => ({ id: s.id, title: s.title || '新会话' }));
};

const selectSession = (id: string) => {
  emit('select', id);
};

watch(() => props.visible, (v) => {
  if (v) {load();}
});

onMounted(() => {
  if (props.visible) {load();}
});

defineExpose({ load });
</script>

<style scoped>
.session-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.session-modal {
  width: 420px;
  max-height: 70vh;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-editorWidget-border, #333);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.session-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #333);
}

.session-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vscode-foreground, #ccc);
}

.session-modal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vscode-icon-foreground, #999);
  transition: all 0.15s;
}

.session-modal-close:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1));
  color: var(--vscode-foreground, #fff);
}

.session-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.session-item:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.session-item.active {
  background: var(--vscode-list-activeSelectionBackground, #094771);
}

.session-item-title {
  font-size: 13px;
  color: var(--vscode-foreground, #ccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item.active .session-item-title {
  color: var(--vscode-list-activeSelectionForeground, #fff);
}

.session-item-id {
  font-size: 11px;
  color: var(--vscode-disabledForeground, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--vscode-disabledForeground, #666);
  font-size: 13px;
}

.session-empty-icon {
  font-size: 32px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .session-modal,
.modal-leave-active .session-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .session-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.modal-leave-to .session-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>
