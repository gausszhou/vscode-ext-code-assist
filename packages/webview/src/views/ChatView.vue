<template>
  <div class="chat-container" :class="{ 'has-code': promptCode }">
    <SessionList
      :active-id="conversationId"
      :visible="showSessionList"
      @select="handleSessionSelect"
      @close="showSessionList = false"
    />
    <div class="chat-main">
      <ChatHeader
        :title="conversationTitle"
        :sessions-open="showSessionList"
        @toggle-sessions="showSessionList = !showSessionList"
      />
      <ChatBody :messages="currentMessageList" :promptCode="promptCode" :currentMessage="currentMessage"
        :loading="loading" />
      <div v-if="errorMessage" class="chat-error" @click="errorMessage = ''">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ errorMessage }}</span>
        <el-icon class="chat-error-close"><Close /></el-icon>
      </div>
      <ChatFooter v-model="prompt" :promptCode="promptCode" :loading="loading" @code="onCodeButtonCLick"
        @send="onSendButtonClick" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { agentClient } from '../agent/agent.client';
import { ChatMessage } from '../models/Message';

import ChatBody from '@/components/ChatBody.vue';
import ChatFooter from '@/components/ChatFooter.vue';
import ChatHeader from '@/components/ChatHeader.vue';
import SessionList from '@/components/SessionList.vue';
import { useSettingStore } from '@/stores/useSettingStore';
import type { IChatChunkMerge } from '@/types';

const settingStore = useSettingStore();

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

const conversationId = ref('');
const conversationTitle = ref('');
const errorMessage = ref('');

const currentMessage = ref<ChatMessage>(getLatestMessage(conversationId.value));
const currentMessageList = ref<ChatMessage[]>([]);
const showSessionList = ref(false);
const loading = ref(false);
const prompt = ref('');
const promptCode = ref('');
let abortController: AbortController | null = null;

function toApiMessages(messages: ChatMessage[]): { role: string; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function toStoreMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    model: m.model || undefined,
    provider: m.provider || undefined,
    startTime: m.startTime,
    loadTime: m.loadTime,
    endTime: m.endTime,
    tool_calls: m.toolCalls.length > 0 ? m.toolCalls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    })) : undefined,
  }));
}

function fromStoreMessage(m: any, convId: string): ChatMessage {
  const msg = new ChatMessage(m.role, convId);
  msg.content = m.content || '';
  msg.model = m.model || '';
  msg.provider = m.provider || '';
  msg.startTime = m.startTime;
  msg.loadTime = m.loadTime;
  msg.endTime = m.endTime;
  if (m.tool_calls) {
    msg.toolCalls = m.tool_calls.map((tc: any) => ({
      id: tc.id || tc.function?.name || '',
      name: tc.function?.name || tc.name || '',
      arguments: tc.function?.arguments || tc.arguments || '',
      result: tc.result,
      status: 'completed',
    }));
  }
  return msg;
}

// 加载消息
const loadMessages = async (convId?: string) => {
  const id = convId || conversationId.value;
  if (!id) {currentMessageList.value = []; return;}
  currentMessage.value = getLatestMessage(id);
  const data = await agentClient.getSessionMessages(id);
  currentMessageList.value = data.messages.map((m: any) => fromStoreMessage(m, id));
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

onUnmounted(() => {
  // 不取消请求——让 Agent 在后台继续处理，重开 webview 后通过 session/load 恢复
});

const enqueue = (value: IChatChunkMerge) => {
  switch (value.type) {
    case 'content':
    case 'reasoning':
      handleChating(value);
      break;
    case 'end':
      handleChatEnd(value);
      break;
  }
};

// 等待 AI 回复
const handleChatRequest = async (messages: ChatMessage[]) => {
  loading.value = true;
  abortController = new AbortController();
  const { baseURL, apiKey, model, provider } = settingStore.getModelParams(settingStore.currentModelHash);
  let currentConversationId = conversationId.value;

  if (!currentConversationId && agentClient.sessionId) {
    currentConversationId = agentClient.sessionId;
    conversationId.value = currentConversationId;
    agentClient.setSessionId(currentConversationId);
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
  const currentConvId = currentConversationId;
  const onToolCall = (toolCalls: Array<{ name: string; arguments: string }>) => {
    const botMessage = getLatestMessage(currentConvId);
    for (const tc of toolCalls) {
      botMessage.toolCalls.push({
        id: `${tc.name}_${Date.now()}`,
        name: tc.name,
        arguments: tc.arguments,
        status: 'running',
      });
    }
    currentMessage.value = structuredClone(botMessage);
  };
  const onToolResult = (toolName: string, result: string) => {
    const botMessage = getLatestMessage(currentConvId);
    const tc = botMessage.toolCalls.find(t => t.name === toolName && t.status === 'running');
    if (tc) {
      tc.status = 'completed';
      tc.result = result;
    }
    currentMessage.value = structuredClone(botMessage);
  };
  const promptText = toApiMessages(messages).map(m => m.content).join('\n');
  const config = { baseURL, apiKey, model, provider };
  try {
    await agentClient.sendPrompt(promptText, config, onChunk, abortController.signal, onToolCall, onToolResult);
    const endTime = Date.now();
    if (!conversationId.value && agentClient.sessionId) {
      conversationId.value = agentClient.sessionId;
      agentClient.setSessionId(agentClient.sessionId);
      currentConversationId = agentClient.sessionId;
    }
    enqueue({ conversationId: currentConversationId, type: 'end', startTime, loadTime, endTime });
  } catch (error: any) {
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
  if (result.startTime !== undefined) {botMessage.startTime = result.startTime;}
  if (result.loadTime !== undefined) {botMessage.loadTime = result.loadTime;}
  if (result.endTime !== undefined) {botMessage.endTime = result.endTime;}
  if (currentMessage.value.conversationId === result.conversationId) {
    currentMessage.value = structuredClone(botMessage);
  }
};

// AI 结束回答
const handleChatEnd = async (result: IChatChunkMerge) => {
  const botMessage = getLatestMessage(result.conversationId);
  if (result.startTime !== undefined) {botMessage.startTime = result.startTime;}
  if (result.loadTime !== undefined) {botMessage.loadTime = result.loadTime;}
  if (result.endTime !== undefined) {botMessage.endTime = result.endTime;}
  if (result.conversationId) {
    const msgList = [...currentMessageList.value, botMessage];
    await agentClient.saveSession({
      sessionId: result.conversationId,
      messages: toStoreMessages(msgList),
    });
    if (conversationId.value === result.conversationId) {
      currentMessageList.value = msgList;
    }
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
  const currentConversationId = conversationId.value;
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
  agentClient.saveSession({
    sessionId: currentConversationId,
    messages: toStoreMessages(currentMessageList.value),
  }).catch(() => {});
  handleChatRequest(requestMessages);
};

// 会话变更处理
const handleSessionSelect = async (id: string) => {
  showSessionList.value = false;
  conversationId.value = id;
  agentClient.setSessionId(id);
  currentMessageList.value = [];
  await loadMessages(id);
};

const restoreACPHistoryIfNeeded = async () => {
  const convId = conversationId.value;
  if (!convId) {return;}
  const data = await agentClient.getSessionMessages(convId);
  if (data.messages.length > 0) {
    currentMessageList.value = data.messages.map((m: any) => fromStoreMessage(m, convId));
  }
};

onMounted(async () => {
  window.addEventListener('message', handleWindowMessage);

  await restoreACPHistoryIfNeeded();
  await loadMessages();

  if (conversationId.value) {
    agentClient.setSessionId(conversationId.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('message', handleWindowMessage);
});
</script>

<style>
.chat-container {
  display: flex;
  height: 100%;
  min-width: 400px;
  max-width: 960px;
  margin: 0 auto;
  max-height: 100vh;
  position: relative;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
</style>
