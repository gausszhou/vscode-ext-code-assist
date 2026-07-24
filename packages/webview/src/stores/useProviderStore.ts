import { createDefaultProvider, Provider } from '@/models/Provider';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatService } from '@/acp';

export const useProviderStore = defineStore('provider', () => {
  const providers = ref<Provider[]>([]);

  const setProviders = async (value: Provider[]) => {
    providers.value = value;
    await chatService.saveProviders(value);
  };

  const resetProviders = async () => {
    await setProviders([await createDefaultProvider()]);
  };

  const init = async () => {
    const result = await chatService.listProviders();
    if (result && result.length > 0) {
      providers.value = result as Provider[];
    } else {
      await resetProviders();
    }
  };

  return {
    providers,
    setProviders,
    resetProviders,
    init,
  };
});
