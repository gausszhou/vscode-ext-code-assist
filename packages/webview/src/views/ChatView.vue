<template>
  <div class="chat-container" :class="{ 'has-code': promptCode }">
    <ChatHeader :messages="currentMessageList" :loading="loading" @update:conversationId="handleConversationChange" />
    <ChatBody :messages="currentMessageList" :promptCode="promptCode" :currentMessage="currentMessage"
      :loading="loading" />
    <ChatFooter v-model="prompt" :promptCode="promptCode" :loading="loading" @code="onCodeButtonCLick"
      @send="onSendButtonClick" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { chatService } from '../acp';
import { ChatMessage } from '../models/Message';

import ChatBody from './components/ChatBody.vue';
import ChatFooter from './components/ChatFooter.vue';
import ChatHeader from './components/ChatHeader.vue';
import { useSettingStore } from '@/stores/useSettingStore';
import { useSession } from '@/stores/useSession';
import { QueueRender } from '@/utils/QueueRender';
import type { IChatChunkMerge } from '@/types';

const settingStore = useSettingStore();
const session = useSession();

// 流式消息内存缓存
const latestMessageMap = new Map<string, ChatMessage>();

function getLatestMessage(convId: string): ChatMessage {
  let m = latestMessageMap.get(convId);
  if (!m) {
    m = new ChatMessage('agent', convId);
    latestMessageMap.set(convId, m);
  }
  return m;
}

function deleteLatestMessage(convId: string) {
  latestMessageMap.delete(convId);
}

const currentMessage = ref<ChatMessage>(getLatestMessage(session.conversationId.value));
const currentMessageList = ref<ChatMessage[]>([]);
const loading = ref(false);
const prompt = ref('');
const promptCode = ref('');
let abortController: AbortController | null = null;

function toApiMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

// 加载消息
const loadMessages = async (convId?: string) => {
  const id = convId || session.conversationId.value;
  if (!id) {currentMessageList.value = []; return;}
  currentMessage.value = getLatestMessage(id);
  const data = await chatService.getSessionMessages(id);
  currentMessageList.value = data.messages.map((m: any) => {
    const msg = new ChatMessage(m.role, id);
    msg.content = m.content;
    return msg;
  });
};

// 处理窗口消息
const handleWindowMessage = (e: MessageEvent) => {
  const { type, text } = e.data;
  switch (type) {
    case 'optimization':
      handleOptimization(text);
      break;
    case 'explanation':
      handleExplanation(text);
      break;
    case 'comment':
      handleComment(text);
      break;
    case 'test':
      handleTest(text);
      break;
    case 'upgrade-class':
      handleUpgradeClass(text);
      break;
    case 'upgrade-vue':
      handleUpgradeVue(text);
      break;
    case 'upgrade-react':
      handleUpgradeReact(text);
      break;
    case 'analysis': {
      handleAnalysis(text);
      break;
    }
    case 'translation': {
      handleTranslation(text);
      break;
    }
    case 'appreciation': {
      handleAppreciation(text);
      break;
    }
    case 'add-to-chat': {
      handleAddToChat(text);
    }
    default:
      break;
  }
};

let queueRender: QueueRender | null = null;

onUnmounted(() => {
  // 不取消请求——让 Agent 在后台继续处理，重开 webview 后通过 session/load 恢复
  queueRender?.dispose();
});

const enqueue = async (value: IChatChunkMerge) => {
  queueRender?.queueAsync(value, (result) => {
    switch (result.type) {
      case 'content':
      case 'reasoning':
        handleChating(result);
        break;
      case 'end':
        {
          handleChatEnd(result);
          queueRender?.dispose();
        }
        break;
      default:
        break;
    }
  });
};

// 等待 AI 回复
const handleChatRequest = async (messages: ChatMessage[]) => {
  loading.value = true;
  abortController = new AbortController();
  queueRender = new QueueRender();
  const { baseURL, apiKey, model, provider } = settingStore.getModelParams(settingStore.currentModelHash);
  let currentConversationId = session.conversationId.value;

  // 确保 ACP session 已创建
  if (!currentConversationId) {
    currentConversationId = await chatService.initSession({ baseURL, apiKey, model, provider });
    await session.linkSessionId(currentConversationId);
  }

  deleteLatestMessage(currentConversationId);
  currentMessage.value = getLatestMessage(currentConversationId);
  currentMessage.value.model = model;
  currentMessage.value.provider = provider;
  const startTime = Date.now();
  let loadTime = 0;
  const onChunk = (text: string) => {
    if (!loadTime) {loadTime = Date.now();}
    const endTime = Date.now();
    enqueue({ conversationId: currentConversationId, type: 'content', data: text, startTime, loadTime, endTime });
  };
  const promptText = toApiMessages(messages).map(m => m.content).join('\n');
  try {
    await chatService.sendPrompt(currentConversationId, promptText, onChunk, abortController.signal);
    const endTime = Date.now();
    enqueue({ conversationId: currentConversationId, type: 'end', startTime, loadTime, endTime });
  } catch (error: any) {
    queueRender?.dispose();
    if (!loadTime) {loadTime = Date.now();}
    const endTime = Date.now();
    enqueue({ conversationId: currentConversationId, type: 'end', startTime, loadTime, endTime });
    if (error.name === 'AbortError') {
      console.log('Chat request aborted');
    } else {
      console.error('Chat request error', error);
    }
  }
};

const handleChating = (result: IChatChunkMerge) => {
  const botMessage = getLatestMessage(result.conversationId);
  if (result.type === 'content') {
    botMessage.content += result.data || '';
  }
  if (result.startTime !== undefined) botMessage.startTime = result.startTime;
  if (result.loadTime !== undefined) botMessage.loadTime = result.loadTime;
  if (result.endTime !== undefined) botMessage.endTime = result.endTime;
  if (currentMessage.value.conversationId === result.conversationId) {
    currentMessage.value = structuredClone(botMessage);
  }
};

// AI 结束回答
const handleChatEnd = async (result: IChatChunkMerge) => {
  const botMessage = getLatestMessage(result.conversationId);
  if (result.startTime !== undefined) botMessage.startTime = result.startTime;
  if (result.loadTime !== undefined) botMessage.loadTime = result.loadTime;
  if (result.endTime !== undefined) botMessage.endTime = result.endTime;
  // 保存到 Agent
  const msgList = [...currentMessageList.value, botMessage];
  await chatService.saveSession({
    sessionId: result.conversationId,
    messages: msgList.map((m) => ({ role: m.role, content: m.content })),
  });
  // 更新当前页面消息列表
  if (session.conversationId.value === result.conversationId) {
    currentMessageList.value = msgList;
  }
  loading.value = false;
  deleteLatestMessage(result.conversationId);
};

const handleOptimization = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `完善或优化一下这段代码，可以是性能优化、代码简化、功能完善等方面的优化。请确保优化后的代码能够正常运行，并且在功能上与原代码保持一致。只要回答代码部分，不要有多余的文字，代码如下：`;

  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleExplanation = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `解释一下这段代码的作用`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleComment = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `给下面这段代码补充注释`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleTest = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `给下面这段代码生成对应的测试用例，测试用例要覆盖主要的逻辑分支，并且符合常见的测试框架规范`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleUpgradeClass = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `将以下代码转换为 ES6 Class 语法，请确保转换后的代码符合 ES6 语法规范，并且能够正常运行。只要回答代码部分，不要有多余的文字，代码如下：`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleUpgradeVue = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `将以下代码转换为 Vue 3 的 Composition API 组件，请确保转换后的代码符合 Vue 3 的 Composition API 规范，并且能够正常运行。只要回答js/ts代码部分，不要有多余的文字，代码如下：`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleUpgradeReact = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `将以下代码转换为 React.FC 组件，请确保转换后的代码符合 ES6 语法规范，并且能够正常运行。只要回答代码部分，不要有多余的文字，代码如下：`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleAnalysis = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `分析一下这段数据`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleTranslation = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `对以下文本进行翻译，如果是中文则翻译成英文，如果是其他语言则翻译成中文`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleAppreciation = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = `鉴赏或者评价一下这段文字`;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
  onSendButtonClick();
};

const handleAddToChat = (code: string) => {
  if (!code) {
    return;
  }
  prompt.value = ``;
  promptCode.value = `
\`\`\`
${code}
\`\`\``;
};

const onCodeButtonCLick = async () => {
  promptCode.value = prompt.value
    ? `\`\`\`
${prompt.value} 
\`\`\``
    : '';
  prompt.value = '';
};

// 发送消息
const onSendButtonClick = async () => {
  const currentConversationId = session.conversationId.value;
  const content = `${prompt.value}
${promptCode.value}
`;
  if (loading.value) {
    abortController?.abort();
    loading.value = false;
    return;
  }
  if (!prompt.value.trim()) {
    return;
  }
  prompt.value = '';
  promptCode.value = '';
  const userMessage = new ChatMessage('user', currentConversationId);
  userMessage.content = content;
  currentMessageList.value = [...currentMessageList.value, userMessage];
  const requestMessages = [...currentMessageList.value];
  // 保存用户消息到 Agent
  chatService.saveSession({
    sessionId: currentConversationId,
    messages: currentMessageList.value.map((m) => ({ role: m.role, content: m.content })),
  }).catch(() => {});
  handleChatRequest(requestMessages);
};

// 会话变更处理
const handleConversationChange = () => {
  currentMessageList.value = [];
  loadMessages();
};

const restoreACPHistoryIfNeeded = async () => {
  const convId = session.conversationId.value;
  if (!convId) return;
  const data = await chatService.getSessionMessages(convId);
  if (data.messages.length > 0) {
    currentMessageList.value = data.messages.map((m: any) => {
      const msg = new ChatMessage(m.role, convId);
      msg.content = m.content;
      return msg;
    });
  }
};

onMounted(async () => {
  window.addEventListener('message', handleWindowMessage);

  await restoreACPHistoryIfNeeded();

  await loadMessages();
});

onUnmounted(() => {
  window.removeEventListener('message', handleWindowMessage);
});
</script>

<style>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 400px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 100vh;
  padding: 0 4px;
}
</style>
