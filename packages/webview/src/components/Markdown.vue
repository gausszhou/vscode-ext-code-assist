<template>
  <MarkdownRender mode="chat" :content="content" :final="final" />
</template>

<script setup lang="ts">
import MarkdownRender from 'markstream-vue';
import 'markstream-vue/index.css';

defineProps({
  content: { default: '' },
  final: { default: true },
});
</script>
