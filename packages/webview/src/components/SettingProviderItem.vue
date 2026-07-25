<template>
  <div class="provider-item">
    <el-icon v-if="showDelete" class="hover-visible icon-delete" @click="$emit('delete')">
      <Delete />
    </el-icon>
    <div class="form-container">
      <div class="form-section">
        <label>Base URL</label>
        <input v-model="provider.baseURL" class="vscode-input" placeholder="https://api.example.com/v1" />
      </div>
      <div class="form-section">
        <label>API Key</label>
        <input v-model="provider.apiKey" class="vscode-input" type="password" placeholder="sk-..." />
      </div>
      <div class="form-section">
        <label class="toggle-label">
          <span>Enabled</span>
          <label class="switch">
            <input v-model="provider.enabled" type="checkbox" switch/>
            <span class="slider"></span>
          </label>
        </label>
      </div>
    </div>
    <div class="preview-container">
      <label style="display: flex; align-items: center; gap: 8px">
        <div class="vscode-button is-text" :disabled="loading" style="padding: 2px" @click="getModels(provider)">
          <span>Update Models</span>
          <el-icon v-if="loading" class="animation-rotate"><Loading /></el-icon>
          <el-icon v-else>
            <Refresh></Refresh>
          </el-icon>
        </div>
      </label>
      <div class="model-container">
        <div v-for="model in provider.models" :key="model.id" class="model-item">{{ model.id }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { agentClient } from '@/agent/agent.client';
import type { Model } from '@/models/Model';
import type { Provider } from '@/models/Provider';
import { sha256 } from '@/utils/hash';
import { Delete, Loading, Refresh } from '@element-plus/icons-vue';
import { ref } from 'vue';
import { sleep } from '@/utils';

const props = defineProps<{
  provider: Provider;
  showDelete: boolean;
}>();

defineEmits<{
  delete: [];
}>();

const loading = ref(false);
const getModels = async (provider: Provider) => {
  loading.value = true;
  try {
    await sleep(300);
    const res = await agentClient.models({
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
    });
    const models = res.body.data || ([] as Model[]);
    const modelsWithHash: Model[] = [];
    for (const model of models) {
      const hash = await sha256(provider.baseURL + provider.apiKey + model.id);
      modelsWithHash.push({
        id: model.id,
        hash,
      });
    }
    provider.models = modelsWithHash.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.provider-item {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--vscode-pickerGroup-border);
  margin-bottom: 12px;
  position: relative;
  display: flex;
  gap: 8px;

  .form-container {
    width: 300px;
  }

  .preview-container {
    flex: 1;
  }

  .hover-visible {
    visibility: hidden;
  }

  &:hover .hover-visible {
    visibility: visible;
  }
}

.icon-delete {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 14px;
  cursor: pointer;
}

.form-section {
  margin-bottom: 16px;
}

.form-section label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
}

.model-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
  max-height: 160px;
  overflow-y: auto;
}

.model-item {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background-color: #272822;
}

.form-section .toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
}

.form-section label.switch {
  margin-bottom: 0;
}
</style>
