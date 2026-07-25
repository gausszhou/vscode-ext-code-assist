<template>
  <div class="setting-container">
    <div class="setting-header">
      <h2 class="setting-header-title">Settings</h2>
      <div class="header-icon-group right">
        <el-icon class="header-icon" @click="$router.push('/')">
          <Back />
        </el-icon>
      </div>
    </div>
    <div class="setting-body">
      <div class="model-setting-header">
        <h2 class="model-setting-title">Model</h2>
      </div>
      <div class="model-setting-body">
        <SettingModelItem
          v-model="currentModelHash"
          label="Chat Model"
          :options="currentModels"
          placeholder="Select a model"
        />
        <SettingModelItem
          v-model="summaryModelHash"
          label="Summary Model"
          :options="currentModels"
          placeholder="Select a model"
        />
      </div>
      <div class="provider-setting-header">
        <h2 class="provider-setting-title">Provider</h2>
      </div>
      <div class="provider-setting-body">
        <ProviderItem
          v-for="provider in providers"
          :key="provider.id"
          :provider="provider"
          :show-delete="providers.length > 1"
          @delete="handleRemoveProvider(provider.id)"
        />
      </div>
    </div>
    <div class="setting-footer">
      <div style="flex: 1">
        <button class="vscode-button" @click="handleAddProvider">Add Provider</button>
      </div>
      <button class="vscode-button" @click="handleResetClick">Reset</button>
      <button class="vscode-button primary" @click="onConfirmClick">OK</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import ProviderItem from '@/components/SettingProviderItem.vue';
import SettingModelItem from '@/components/SettingModelItem.vue';
import { useSettingStore } from '@/stores/useSettingStore';
import { useProviderStore } from '@/stores/useProviderStore';
import { Back } from '@element-plus/icons-vue';
import type { IStandardItem } from '@/types';
import { useRouter } from 'vue-router';
import { computed, ref, toRef } from 'vue';

const router = useRouter();
const settingStore = useSettingStore();
const providerStore = useProviderStore();

const providers = toRef(providerStore, 'providers');
const currentModelHash = ref(settingStore.currentModelHash || '');
const summaryModelHash = ref(settingStore.summaryModelHash || '');

const currentModels = computed(() => {
  const groups: Record<string, IStandardItem<string>[]> = {};
  providers.value.forEach((p) => {
    if (!p.enabled) {return;}
    if (!groups[p.baseURL]) {
      groups[p.baseURL] = [];
    }
    p.models.forEach((m) => {
      let option = {
        label: m.id,
        value: m.hash,
      };
      if (!groups[p.baseURL].find((o) => o.value === option.value)) {
        groups[p.baseURL].push(option);
      }
    });
  });
  return Object.entries(groups).map(([label, options]) => ({
    label,
    options,
  }));
});

const handleAddProvider = async () => {
  const { createDefaultProvider } = await import('@/models/Provider');
  providers.value.push(await createDefaultProvider());
};

const handleRemoveProvider = (id: string) => {
  providerStore.setProviders(providers.value.filter((p: any) => p.id !== id));
};

const handleResetClick = async () => {
  await providerStore.resetProviders();
};

const onConfirmClick = async () => {
  if (providers.value.length > 0) {
    await providerStore.setProviders(providers.value);
    await settingStore.setCurrentModelHash(currentModelHash.value);
    await settingStore.setSummaryModelHash(summaryModelHash.value);
    router.push('/');
  }
};
</script>

<style lang="scss" scoped>
.setting-container {
  min-width: 400px;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 4px;
  display: flex;
  flex-direction: column;
}

.setting-header,
.model-setting-header,
.provider-setting-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 28px;
  margin-bottom: 8px;

  .setting-header-title {
    font-size: 16px;
    font-weight: 500;
  }

  .model-setting-title,
  .provider-setting-title {
    border-left: 2px solid var(--vscode-pickerGroup-border);
    padding-left: 0.5em;
    font-size: 14px;
    font-weight: 500;
  }
}

.model-setting-body {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  padding-top: 16px;
  border: 1px solid var(--vscode-pickerGroup-border);
  border-radius: 8px;
  margin-bottom: 16px;
}

.provider-setting-body {
  flex: 1;
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}

.setting-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
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
