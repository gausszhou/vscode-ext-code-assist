import * as vscode from 'vscode';
import {
  AgentSideConnection,
  type Stream,
  type Agent,
  type InitializeRequest,
  type InitializeResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type CancelNotification,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type CloseSessionRequest,
  type CloseSessionResponse,
  type PromptCapabilities,
  type SessionCapabilities,
  type AgentCapabilities,
} from '@agentclientprotocol/sdk';
import { OpenAIService } from '../services/OpenAIService';
import type { StoredMessage } from './SessionStore';
import { SessionStore } from './SessionStore';
import { ACPSession, type PromptConfig } from './ACPSession';
import { logger } from '../lib/Logger';



export class AgentServer {
  private sessions = new Map<string, ACPSession>();
  private connection: AgentSideConnection | null = null;
  private sessionStore: SessionStore;
  private openaiService: OpenAIService;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private storage: vscode.Memento,
    private secrets: vscode.SecretStorage,
    globalStorageUri: vscode.Uri,
  ) {
    this.sessionStore = new SessionStore(storage, globalStorageUri);
    this.openaiService = new OpenAIService();
  }

  connect(stream: Stream): void {
    logger.info('ACP Agent connect');
    this.connection = new AgentSideConnection(() => this.createAgentHandler(), stream);

    this.connection.signal.addEventListener('abort', () => {
      logger.info('ACP Agent disconnected');
    });

    this.disposables.push({
      dispose: () => {
        stream.writable.close();
      },
    });
  }

  private createAgentHandler(): Agent {
    const self = this;
    return {
      initialize(_params: InitializeRequest): Promise<InitializeResponse> {
        logger.info('ACP initialize');
        logger.info('ACP initialize');
        const caps: AgentCapabilities = {
          loadSession: true,
          sessionCapabilities: { list: {}, close: {} } as SessionCapabilities,
          promptCapabilities: {
            image: false,
            audio: false,
            embeddedContext: true,
          } as PromptCapabilities,
          mcpCapabilities: { http: false, sse: false },
        };
        return Promise.resolve({
          protocolVersion: 1,
          agentCapabilities: caps,
          agentInfo: {
            name: 'code-assist-agent',
            version: '1.0.0',
          },
          authMethods: [],
        });
      },

      authenticate(_params: any): Promise<any> {
        return Promise.resolve({});
      },

      newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
        const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        let config: PromptConfig | undefined;
        const metaProvider = (params._meta as any)?.provider;
        if (metaProvider) {
          config = {
            baseURL: metaProvider.baseURL || '',
            apiKey: metaProvider.apiKey || '',
            model: metaProvider.model || '',
            provider: metaProvider.provider || metaProvider.baseURL || '',
          };
        }

        const session = new ACPSession(id, params.cwd, config);
        self.sessions.set(id, session);
        logger.info(`session/new: ${id} model=${config?.model || 'none'}`);
        return Promise.resolve({ sessionId: id });
      },

      async prompt(params: PromptRequest): Promise<PromptResponse> {
        const session = self.sessions.get(params.sessionId);
        logger.info(`session/prompt: ${params.sessionId}`);
        if (!session) {
          logger.warn(`session/prompt: session not found ${params.sessionId}`);
          return { stopReason: 'end_turn' };
        }

        const userText = params.prompt
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('\n');

        if (!userText) {
          return { stopReason: 'end_turn' };
        }

        session.addMessage({ role: 'user', content: userText, model: session.config.model, provider: session.config.provider });

        const controller = new AbortController();
        session.activeController = controller;

        try {
          const { baseURL, apiKey, model } = session.config;
          if (!baseURL || !apiKey || !model) {
            throw new Error('Provider not configured. Please set up API provider first.');
          }

          const stream = await self.openaiService.chatStream({
            baseURL,
            apiKey,
            model,
            messages: session.toCompletionMessages(),
          });

          let content = '';
          let reasoning = '';

          if (stream instanceof ReadableStream) {
            const reader = stream.getReader();
            while (!controller.signal.aborted) {
              const { done, value } = await reader.read();
              if (done) {break;}

              const delta = value.choices?.[0]?.delta;
              if (delta) {
                const text = delta.content || '';
                const reason = delta.reasoning || delta.reasoning_content || '';

                if (text) {
                  content += text;
                  await self.sendChunk(params.sessionId, text);
                }
                if (reason) {
                  reasoning += reason;
                  await self.sendChunk(params.sessionId, reason);
                }
              }
            }
          }

          if (controller.signal.aborted) {
            logger.info(`session/prompt cancelled: ${params.sessionId}`);
            if (content) {
              session.addMessage({ role: 'agent', content, model, provider: session.config.provider });
            }
            if (reasoning) {
              session.addMessage({ role: 'think', content: reasoning, model, provider: session.config.provider });
            }
            await self.sessionStore.save(session.data);
            return { stopReason: 'cancelled' };
          }

          session.addMessage({ role: 'agent', content, model, provider: session.config.provider });
          if (reasoning) {
            session.addMessage({ role: 'think', content: reasoning, model, provider: session.config.provider });
          }
          await self.sessionStore.save(session.data);
          logger.info(`session/prompt complete: ${params.sessionId} tokens=${content.length}`);

          // 自动生成标题
          self.generateTitle(params.sessionId, baseURL, apiKey, model).catch(() => {});

          return { stopReason: 'end_turn' };
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            logger.info(`session/prompt aborted: ${params.sessionId}`);
            return { stopReason: 'cancelled' };
          }
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`session/prompt error: ${params.sessionId} ${msg}`);
          session.addMessage({ role: 'agent', content: `Error: ${msg}`, model: session.config.model, provider: session.config.provider });
          await self.sessionStore.save(session.data);
          return { stopReason: 'end_turn' };
        } finally {
          session.activeController = null;
        }
      },

      cancel(params: CancelNotification): Promise<void> {
        logger.info(`session/cancel: ${params.sessionId}`);
        const session = self.sessions.get(params.sessionId);
        session?.cancel();
        return Promise.resolve();
      },

      async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
        logger.info(`session/load: ${params.sessionId}`);
        const stored = await self.sessionStore.load(params.sessionId);
        if (!stored) {
          logger.warn(`session/load not found: ${params.sessionId}`);
          return {};
        }
        const session = ACPSession.fromData(stored);
        self.sessions.set(params.sessionId, session);
        logger.info(`session/load replaying ${session.data.messages.length} messages`);

        for (const msg of session.data.messages) {
          const updateType = msg.role === 'user'
            ? 'user_message_chunk' as const
            : 'agent_message_chunk' as const;
          await self.sendChunk(params.sessionId, msg.content, updateType);
        }

        return {};
      },

      listSessions(_params: ListSessionsRequest): Promise<ListSessionsResponse> {
        const sessions = self.sessionStore.list();
        return Promise.resolve({
          sessions: sessions.map((s) => ({
            sessionId: s.id,
            cwd: s.cwd,
            title: s.title,
            updatedAt: new Date(s.updatedAt).toISOString(),
          })),
        });
      },

      closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse | void> {
        const session = self.sessions.get(params.sessionId);
        session?.cancel();
        self.sessions.delete(params.sessionId);
        return Promise.resolve({});
      },

      extNotification(method: string, params: Record<string, unknown>): Promise<void> {
        return Promise.resolve();
      },

      extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
        switch (method) {
          case 'code-assist/models':
            return self.handleListModels(params as any);
          case 'code-assist/session/updateTitle':
            return self.handleUpdateTitle(params as any);
          case 'code-assist/session/delete':
            return self.handleDeleteSession(params as any);
          case 'code-assist/session/messages':
            return self.handleGetSessionMessages(params as any);
          case 'code-assist/session/save':
            return self.handleSaveSession(params as any);
          case 'code-assist/session/summarize':
            return self.handleSummarizeSession(params as any);
          case 'code-assist/providers/list':
            return self.handleListProviders();
          case 'code-assist/providers/save':
            return self.handleSaveProviders(params as any);
          case 'code-assist/settings/get':
            return self.handleGetSettings(params as any);
          case 'code-assist/settings/set':
            return self.handleSetSettings(params as any);
          default:
            return Promise.resolve({});
        }
      },
    };
  }

  private async handleListModels(config: { baseURL: string; apiKey: string }): Promise<Record<string, unknown>> {
    try {
      const resp = await this.openaiService.models(config);
      return resp as Record<string, unknown>;
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  private async generateTitle(sessionId: string, baseURL: string, apiKey: string, model: string): Promise<void> {
    try {
      const result = await this.handleSummarizeSession({ sessionId, baseURL, apiKey, model });
      const title = result.title as string;
      if (title && this.connection) {
        await this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'session_info_update' as any,
            title,
          } as any,
        }).catch(() => {});
      }
    } catch {}
  }

  private async sendChunk(
    sessionId: string,
    text: string,
    type: 'agent_message_chunk' | 'user_message_chunk' = 'agent_message_chunk',
  ): Promise<void> {
    if (!this.connection) {return;}
    try {
      await this.connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: type,
          content: { type: 'text' as const, text },
        },
      });
    } catch {
    }
  }

  private async handleUpdateTitle(params: { sessionId: string; title: string }): Promise<Record<string, unknown>> {
    const { sessionId, title } = params;
    logger.info(`session/updateTitle: ${sessionId} "${title}"`);
    await this.sessionStore.updateTitle(sessionId, title);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.data.title = title;
    }
    return {};
  }

  private async handleDeleteSession(params: { sessionId: string }): Promise<Record<string, unknown>> {
    logger.info(`session/delete: ${params.sessionId}`);
    const session = this.sessions.get(params.sessionId);
    session?.cancel();
    this.sessions.delete(params.sessionId);
    await this.sessionStore.delete(params.sessionId);
    return {};
  }

  private async handleGetSessionMessages(params: { sessionId: string }): Promise<Record<string, unknown>> {
    const stored = await this.sessionStore.load(params.sessionId);
    if (!stored) {
      return { messages: [], title: '' };
    }
    return {
      messages: stored.messages,
      title: stored.title,
    };
  }

  private async handleSummarizeSession(params: {
    sessionId: string;
    baseURL: string;
    apiKey: string;
    model: string;
  }): Promise<Record<string, unknown>> {
    const stored = await this.sessionStore.load(params.sessionId);
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
        await this.sessionStore.updateTitle(params.sessionId, title);
      }
      return { title };
    } catch (err: unknown) {
      logger.error(`session/summarize error: ${err instanceof Error ? err.message : 'unknown'}`);
      return { title: '' };
    }
  }

  private async handleSaveSession(params: {
    sessionId: string;
    title?: string;
    messages?: { role: string; content: string }[];
  }): Promise<Record<string, unknown>> {
    const { sessionId } = params;
    let session = this.sessions.get(sessionId);
    if (!session) {
      const stored = await this.sessionStore.load(sessionId);
      if (stored) {
        session = ACPSession.fromData(stored);
        this.sessions.set(sessionId, session);
      }
    }
    if (!session) {
      return { error: 'session not found' };
    }
    if (params.title !== undefined) {session.data.title = params.title;}
    if (params.messages !== undefined) {
      session.data.messages = (params.messages as any[]).map((m: any) => ({
        ...m,
        model: m.model || session.config.model || undefined,
        provider: m.provider || session.config.provider || undefined,
      }));
    }
    session.data.updatedAt = Date.now();
    await this.sessionStore.save(session.data);
    return {};
  }

  private async handleListProviders(): Promise<Record<string, unknown>> {
    const raw = await this.secrets.get('providers');
    if (!raw) { return { providers: [] }; }
    try { return { providers: JSON.parse(raw) }; }
    catch { return { providers: [] }; }
  }

  private async handleSaveProviders(params: { providers: unknown[] }): Promise<Record<string, unknown>> {
    await this.secrets.store('providers', JSON.stringify(params.providers));
    return {};
  }

  private async handleGetSettings(params: { keys: string[] }): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const key of params.keys) {
      result[key] = this.storage.get<string>(key, '');
    }
    return result;
  }

  private async handleSetSettings(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    for (const [key, value] of Object.entries(params)) {
      await this.storage.update(key, value);
    }
    return {};
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.cancel();
    }
    this.sessions.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
