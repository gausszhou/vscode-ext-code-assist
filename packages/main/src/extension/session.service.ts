import { SessionManagerService } from '../session/session-manager.service';

export class SessionService {
  constructor(private sessionManager: SessionManagerService) {}

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
    messages?: { role: string; content: string }[];
  }): Promise<Record<string, unknown>> {
    const { sessionId } = params;
    const session = this.sessionManager.get(sessionId) ?? await this.sessionManager.loadFromStore(sessionId);
    if (!session) {
      return { error: 'session not found' };
    }
    if (params.title !== undefined) { session.data.title = params.title; }
    if (params.messages !== undefined) {
      session.data.messages = params.messages.map((m) => ({
        ...m,
        model: m.model || session.config.model,
        provider: m.provider || session.config.provider,
      }));
    }
    session.data.updatedAt = Date.now();
    await this.sessionManager.getStore().save(session.data);
    return {};
  }
}
