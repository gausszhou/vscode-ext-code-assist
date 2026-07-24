import * as vscode from 'vscode';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type {
  Agent,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  LoadSessionRequest,
  LoadSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  PromptCapabilities,
  SessionCapabilities,
  AgentCapabilities,
} from '@agentclientprotocol/sdk';
import { SessionManagerService } from '../session/session-manager.service';
import { SessionStoreService } from '../session/session-store.service';
import { OpenAIService } from '../openai/openai.service';
import { AgentLoop } from '../agent/agent.loop';
import { TitleGeneratorService } from '../agent/agent.title';
import { ExtensionRouter } from '../extension/extension.router';
import { ModelService } from '../extension/model.service';
import { ProviderService } from '../extension/provider.service';
import { SettingsService } from '../extension/settings.service';
import { SessionService } from '../extension/session.service';
import { logger } from '../logger/logger.service';

export class AcpAgent implements Agent {
  private connection: AgentSideConnection | null = null;

  private sessionManager: SessionManagerService;
  private promptLoop: AgentLoop;
  private extensionRouter: ExtensionRouter;

  constructor(
    storage: vscode.Memento,
    secrets: vscode.SecretStorage,
    globalStorageUri: vscode.Uri,
  ) {
    const sessionStore = new SessionStoreService(storage, globalStorageUri);
    this.sessionManager = new SessionManagerService(sessionStore);

    const openaiService = new OpenAIService();
    const titleGenerator = new TitleGeneratorService(openaiService, this.sessionManager);
    this.promptLoop = new AgentLoop(openaiService, this.sessionManager, titleGenerator);

    const modelService = new ModelService(openaiService);
    const providerService = new ProviderService(secrets);
    const settingsService = new SettingsService(storage);
    const sessionService = new SessionService(this.sessionManager);
    this.extensionRouter = new ExtensionRouter(
      modelService,
      providerService,
      settingsService,
      sessionService,
    );
  }

  setConnection(conn: AgentSideConnection | null): void {
    this.connection = conn;
  }

  initialize(_params: InitializeRequest): Promise<InitializeResponse> {
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
      agentInfo: { name: 'code-assist-agent', version: '1.0.0' },
      authMethods: [],
    });
  }

  authenticate(_params: any): Promise<any> {
    return Promise.resolve({});
  }

  newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    let config: any;
    const metaProvider = (params._meta as any)?.provider;
    if (metaProvider) {
      config = {
        baseURL: metaProvider.baseURL || '',
        apiKey: metaProvider.apiKey || '',
        model: metaProvider.model || '',
        provider: metaProvider.provider || metaProvider.baseURL || '',
      };
    }
    const id = this.sessionManager.create(params.cwd, config);
    logger.info(`session/new: ${id} model=${config?.model || 'none'}`);
    return Promise.resolve({ sessionId: id });
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    logger.info(`session/prompt: ${params.sessionId}`);
    const text = params.prompt
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n');
    if (!text) {
      return { stopReason: 'end_turn' };
    }
    if (!this.connection) {
      return { stopReason: 'end_turn' };
    }
    return this.promptLoop.execute(params.sessionId, text, this.connection);
  }

  cancel(params: CancelNotification): Promise<void> {
    logger.info(`session/cancel: ${params.sessionId}`);
    this.sessionManager.cancel(params.sessionId);
    return Promise.resolve();
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    logger.info(`session/load: ${params.sessionId}`);
    const session = await this.sessionManager.loadFromStore(params.sessionId);
    if (!session) {
      logger.warn(`session/load not found: ${params.sessionId}`);
      return {};
    }
    logger.info(`session/load replaying ${session.data.messages.length} messages`);
    if (this.connection) {
      await this.promptLoop.replay(params.sessionId, this.connection);
    }
    return {};
  }

  listSessions(_params: ListSessionsRequest): Promise<ListSessionsResponse> {
    const sessions = this.sessionManager.list();
    return Promise.resolve({
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        cwd: s.cwd,
        title: s.title,
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
    });
  }

  closeSession(params: CloseSessionRequest): Promise<CloseSessionResponse | void> {
    this.sessionManager.close(params.sessionId);
    return Promise.resolve({});
  }

  extNotification(_method: string, _params: Record<string, unknown>): Promise<void> {
    return Promise.resolve();
  }

  extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.extensionRouter.handle(method, params);
  }

  dispose(): void {
    this.sessionManager.list().forEach((s) => this.sessionManager.close(s.id));
  }
}
