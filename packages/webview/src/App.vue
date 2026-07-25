<script setup lang="ts">
import { onMounted } from 'vue';
import { useProviderStore } from '@/stores/useProviderStore';
import { useSettingStore } from '@/stores/useSettingStore';

onMounted(() => {
  useProviderStore().init();
  useSettingStore().init();
});
</script>

<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped>
.app-container {
  height: 100%;
  width: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
