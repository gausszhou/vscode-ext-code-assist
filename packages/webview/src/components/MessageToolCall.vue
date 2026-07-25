<template>
  <div class="chat-message message-tool-call">
    <div class="tool-call-list">
      <div v-for="(tc, idx) in toolCalls" :key="idx" class="tool-call-item">
        <div class="tool-call-header">
          <el-icon :class="statusIconClass(tc.status)">
            <Loading v-if="tc.status === 'running'" />
            <CircleCheckFilled v-else-if="tc.status === 'completed'" />
            <WarningFilled v-else />
          </el-icon>
          <span class="tool-call-name">{{ tc.name }}</span>
        </div>
        <div v-if="tc.arguments" class="tool-call-args">
          <code>{{ tc.arguments }}</code>
        </div>
        <div v-if="tc.result && tc.status !== 'running'" class="tool-call-result">
          <pre>{{ tc.result }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckFilled, Loading, WarningFilled } from '@element-plus/icons-vue';
import type { IToolCallDisplay } from '@/models/Message';

defineProps<{
  toolCalls: IToolCallDisplay[]
}>();

function statusIconClass(status: string): string {
  if (status === 'running') {return 'status-running';}
  if (status === 'completed') {return 'status-completed';}
  return 'status-error';
}
</script>

<style lang="scss" scoped>
.tool-call-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  margin: 8px 0;
}

.tool-call-item {
  padding: 4px 0;
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.tool-call-name {
  color: var(--el-text-color-primary);
}

.tool-call-args {
  margin: 4px 0 0 20px;
  font-size: 12px;
  code {
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }
}

.tool-call-result {
  margin: 4px 0 0 20px;
  pre {
    font-size: 11px;
    background: var(--el-fill-color);
    padding: 6px 8px;
    border-radius: 4px;
    max-height: 120px;
    overflow: auto;
    color: var(--el-text-color-regular);
  }
}

.status-running {
  color: var(--el-color-primary);
}

.status-completed {
  color: var(--el-color-success);
}

.status-error {
  color: var(--el-color-danger);
}
</style>