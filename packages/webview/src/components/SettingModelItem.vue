<template>
  <div class="model-setting-item form-section">
    <label style="display: flex; align-items: center; gap: 8px">
      <div class="vscode-button is-text" style="padding: 2px" @click="testModel(modelValue)">
        <span>{{ label }}</span>
        <el-icon v-if="loading" class="animation-rotate"><Loading /></el-icon>
        <el-icon v-else-if="status === 1" style="color: var(--vscode-testing-iconPassed)"><CircleCheck /></el-icon>
        <el-icon v-else-if="status === -1"  style="color: var(--vscode-testing-iconFailed)"><CircleClose /></el-icon>
        <el-icon v-else>
          <Refresh></Refresh>
        </el-icon>
      </div>
    </label>
    <SelectPicker
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script lang="ts" setup>
import SelectPicker from '@/components/SelectPicker.vue';
import { CircleCheck, CircleClose, Loading, Refresh } from '@element-plus/icons-vue';
import type { IStandardItem } from '@/types';
import { useSettingStore } from '@/stores/useSettingStore';
import { agentClient } from '@/agent/agent.client';
import { ref, watch } from 'vue';
import { sleep } from '@/utils';

const settingStore = useSettingStore();

const props = defineProps<{
  label: string;
  modelValue: string;
  options: {
    label: string;
    options: IStandardItem<string>[];
  }[];
  placeholder?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();

const loading = ref(false);
const status = ref(0);

watch(
  () => props.modelValue,
  () => {
    status.value = 0;
  }
);

const testModel = async (hash) => {
  const { baseURL, apiKey, model } = settingStore.getModelParams(hash);
  loading.value = true;
  status.value = 0;
  await sleep(300);
  agentClient.chatRaw({
      baseURL,
      apiKey,
      model,
      messages: [
        {
          role: 'user',
          content: '验证功能是否正常，请回复 OK 或者 NO',
        },
      ],
    })
    .then(() => {
      status.value = 1;
    })
    .catch(() => {
      status.value = -1;
    })
    .finally(() => {
      loading.value = false;
    });
};
</script>

<style lang="scss" scoped>
.model-setting-item {
  flex: 1;
}

.form-section {
  margin-bottom: 16px;
}

.form-section label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}
</style>
