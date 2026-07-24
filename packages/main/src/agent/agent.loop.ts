import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import { OpenAIService } from '../openai/openai.service';
import { SessionManagerService } from '../session/session-manager.service';
import { TitleGeneratorService } from './agent.title';
import { logger } from '../logger/logger.service';

export class AgentLoop {
  constructor(
    private openaiService: OpenAIService,
    private sessionManager: SessionManagerService,
    private titleGenerator: TitleGeneratorService,
  ) {}

  async execute(
    sessionId: string,
    text: string,
    connection: AgentSideConnection,
  ): Promise<{ stopReason: string }> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      logger.warn(`session/prompt: session not found ${sessionId}`);
      return { stopReason: 'end_turn' };
    }

    session.addMessage({
      role: 'user',
      content: text,
      model: session.config.model,
      provider: session.config.provider,
    });

    const controller = new AbortController();
    session.activeController = controller;

    try {
      const { baseURL, apiKey, model } = session.config;
      if (!baseURL || !apiKey || !model) {
        throw new Error('Provider not configured. Please set up API provider first.');
      }

      const stream = await this.openaiService.chatStream({
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
              await this.sendChunk(connection, sessionId, text);
            }
            if (reason) {
              reasoning += reason;
              await this.sendChunk(connection, sessionId, reason);
            }
          }
        }
      }

      if (controller.signal.aborted) {
        logger.info(`session/prompt cancelled: ${sessionId}`);
        if (content) {
          session.addMessage({ role: 'agent', content, model, provider: session.config.provider });
        }
        if (reasoning) {
          session.addMessage({ role: 'think', content: reasoning, model, provider: session.config.provider });
        }
        await this.sessionManager.getStore().save(session.data);
        return { stopReason: 'cancelled' };
      }

      session.addMessage({ role: 'agent', content, model, provider: session.config.provider });
      if (reasoning) {
        session.addMessage({ role: 'think', content: reasoning, model, provider: session.config.provider });
      }
      await this.sessionManager.getStore().save(session.data);
      logger.info(`session/prompt complete: ${sessionId} tokens=${content.length}`);

      this.titleGenerator.generate(sessionId, baseURL, apiKey, model).catch(() => {});

      return { stopReason: 'end_turn' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.info(`session/prompt aborted: ${sessionId}`);
        return { stopReason: 'cancelled' };
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`session/prompt error: ${sessionId} ${msg}`);
      session.addMessage({
        role: 'agent',
        content: `Error: ${msg}`,
        model: session.config.model,
        provider: session.config.provider,
      });
      await this.sessionManager.getStore().save(session.data);
      return { stopReason: 'end_turn' };
    } finally {
      session.activeController = null;
    }
  }

  async replay(
    sessionId: string,
    connection: AgentSideConnection,
  ): Promise<void> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {return;}

    for (const msg of session.data.messages) {
      const updateType = msg.role === 'user'
        ? 'user_message_chunk' as const
        : 'agent_message_chunk' as const;
      await this.sendChunk(connection, sessionId, msg.content, updateType);
    }
  }

  private async sendChunk(
    connection: AgentSideConnection,
    sessionId: string,
    text: string,
    type: 'agent_message_chunk' | 'user_message_chunk' = 'agent_message_chunk',
  ): Promise<void> {
    try {
      await connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: type,
          content: { type: 'text' as const, text },
        },
      });
    } catch {
      // connection closed
    }
  }
}
