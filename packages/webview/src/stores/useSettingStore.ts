import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useProviderStore } from './useProviderStore';
import { agentClient } from '@/agent/agent.client';

export const useSettingStore = defineStore('setting', () => {
  const providerStore = useProviderStore();
  const currentModelHash = ref('');
  const summaryModelHash = ref('');

  const setCurrentModelHash = async (value: string) => {
    currentModelHash.value = value;
    await agentClient.setSettings({ currentModelHash: value });
  };

  const setSummaryModelHash = async (value: string) => {
    summaryModelHash.value = value;
    await agentClient.setSettings({ summaryModelHash: value });
  };

  const getModelParams = (modelHash: string) => {
    const providers = providerStore.providers;
    let provider = null;
    let model = null;
    providers.forEach((p) => {
      if (!p.enabled) return;
      p.models.forEach((m) => {
        if (m.hash === modelHash) {
          provider = p;
          model = m.id;
        }
      });
    });
    return {
      baseURL: provider?.baseURL || '',
      apiKey: provider?.apiKey || '',
      model,
      provider: provider?.baseURL || '',
    };
  };

  const init = async () => {
    const settings = await agentClient.getSettings(['currentModelHash', 'summaryModelHash']);
    if (settings.currentModelHash) currentModelHash.value = settings.currentModelHash as string;
    if (settings.summaryModelHash) summaryModelHash.value = settings.summaryModelHash as string;
  };

  return {
    currentModelHash,
    setCurrentModelHash,
    summaryModelHash,
    setSummaryModelHash,
    getModelParams,
    init,
  };
});
