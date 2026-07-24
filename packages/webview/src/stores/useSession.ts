import { ref } from 'vue';
import { chatService } from '@/acp';

const conversationId = ref<string>('');
const conversationTitle = ref<string>('');

async function setConversationId(id: string) {
  conversationId.value = id;
  await chatService.setSettings({ conversationId: id });
}

function setConversationTitle(title: string) {
  conversationTitle.value = title;
}

/** 用 ACP sessionId 替换当前的本地 conversationId（首次发送消息时调用） */
async function linkSessionId(sessionId: string) {
  await setConversationId(sessionId);
}

async function initSession() {
  const settings = await chatService.getSettings(['conversationId']);
  if (settings.conversationId) {
    conversationId.value = settings.conversationId as string;
  }
}

export function useSession() {
  return {
    conversationId,
    conversationTitle,
    setConversationId,
    setConversationTitle,
    linkSessionId,
    initSession,

    async listSessions() {
      return chatService.listSessions();
    },

    async deleteSession(id: string) {
      await chatService.deleteSession(id);
    },

    async updateTitle(sessionId: string, title: string) {
      setConversationTitle(title);
      await chatService.updateSessionTitle(sessionId, title);
    },
  };
}
