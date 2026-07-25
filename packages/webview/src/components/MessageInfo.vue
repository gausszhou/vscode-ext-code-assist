<template>
  <el-tooltip effect="dark" placement="top">
    <template #content>
      <div class="tooltip">
        <div class="tooltip__item">
          <span>Provider :</span>
          <span>{{ info.provider }}</span>
        </div>
        <div class="tooltip__item">
          <span>Model :</span>
          <span>{{ message.model }}</span>
        </div>
        <div class="tooltip__item">
          <span>Load Duration :</span>
          <span>{{ info.loadDuration }} Second</span>
        </div>
        <div class="tooltip__item">
          <span>Eval Duration :</span>
          <span>{{ info.evalDuration }} Second</span>
        </div>
        <div class="tooltip__item">
          <span>Total Duration :</span>
          <span>{{ info.totalDuration }} Second</span>
        </div>
        <div class="tooltip__item">
          <span>Char Count:</span>
          <span>{{ info.chars }} Chars</span>
        </div>
        <div class="tooltip__item">
          <span>Token Count:</span>
          <span>{{ info.tokens }} Token</span>
        </div>
        <div class="tooltip__item">
          <span>Char Speed: </span>
          <span>{{ info.charsSpeed }} Chars/s</span>
        </div>
        <div class="tooltip__item">
          <span>Token Speed: </span>
          <span>{{ info.tokensSpeed }} Token/s</span>
        </div>
      </div>
    </template>
    <el-icon class="message-icon">
      <InfoFilled />
    </el-icon>
  </el-tooltip>
</template>
<script lang="ts" setup>
import { ChatMessage } from '@/models/Message';
import { getMessageInfoFromMessage } from '@/utils/token';
import { InfoFilled } from '@element-plus/icons-vue';

const props = defineProps({
  message: {
    default: () => new ChatMessage('system', ''),
  },
});

const info = getMessageInfoFromMessage(props.message);
</script>
<style lang="scss" scoped>
.tooltip__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
</style>
