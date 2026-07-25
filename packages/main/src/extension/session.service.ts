import { SessionManagerService } from '../session/session-manager.service';
import { OpenAIService } from '../openai/openai.service';
import { logger } from '../logger/logger.service';

export class SessionService {
  constructor(
    private sessionManager: SessionManagerService,
    private openaiService: OpenAIService,
  ) {}

  async updateTitle(params: { sessionId: string; title: string }): Promise<Record<string, unknown>> {
    const { sessionId, title } = params;
    await this.sessionManager.getStore().updateTitle(sessionId, title);
    const session = this.sessionManager.get(sessionId);
    if (session) {
      session.data.title = title;
    }
    return {};
  }

  async delete(params: { sessionId: string }): Promise<Record<string, unknown>> {
    await this.sessionManager.delete(params.sessionId);
    return {};
  }

  async getMessages(params: { sessionId: string }): Promise<Record<string, unknown>> {
    const stored = await this.sessionManager.getStore().load(params.sessionId);
    if (!stored) {
      return { messages: [], title: '' };
    }
    return {
      messages: stored.messages,
      title: stored.title,
    };
  }

  async save(params: {
    sessionId: string;
    title?: string;
    messages?: { role: string; content: string; model?: string; provider?: string; startTime?: number; loadTime?: number; endTime?: number }[];
  }): Promise<Record<string, unknown>> {
    const { sessionId } = params;
    const session = this.sessionManager.get(sessionId) ?? await this.sessionManager.loadFromStore(sessionId);
    if (!session) {
      return { error: 'session not found' };
    }
    if (params.title !== undefined) { session.data.title = params.title; }
    if (params.messages !== undefined) {
      session.data.messages = params.messages.map((m) => ({
        role: m.role,
        content: m.content,
        model: m.model || session.config.model,
        provider: m.provider || session.config.provider,
        startTime: m.startTime,
        loadTime: m.loadTime,
        endTime: m.endTime,
      }));
    }
    session.data.updatedAt = Date.now();
    await this.sessionManager.getStore().save(session.data);
    return {};
  }

  async summarize(params: { sessionId: string; baseURL: string; apiKey: string; model: string }): Promise<Record<string, unknown>> {
    const stored = await this.sessionManager.getStore().load(params.sessionId);
    if (!stored || stored.messages.length === 0) {
      return { title: '' };
    }
    try {
      const resp = await this.openaiService.chat({
        baseURL: params.baseURL,
        apiKey: params.apiKey,
        model: params.model,
        messages: [
          ...stored.messages.map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: '请用20字以内总结以上对话主题，作为对话标题直接返回，不需要任何标点和修饰' },
        ],
      });
      const title = ((resp as any)?.choices?.[0]?.message?.content || '').slice(0, 20);
      if (title) {
        await this.sessionManager.getStore().updateTitle(params.sessionId, title);
      }
      return { title };
    } catch (err: unknown) {
      logger.error(`session/summarize error: ${err instanceof Error ? err.message : 'unknown'}`);
      return { title: '' };
    }
  }
}
