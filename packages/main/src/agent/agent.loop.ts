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
      logger.warn(`AgentLoop execute: session not found ${sessionId}`);
      return { stopReason: 'end_turn' };
    }

    logger.info(`AgentLoop execute start: ${sessionId} model=${session.config.model}`);

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

      logger.info(`AgentLoop chatStream: ${sessionId} model=${model}`);
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
          if (done) {
            logger.info(`AgentLoop stream done: ${sessionId}`);
            break;
          }

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
        logger.info(`AgentLoop cancelled: ${sessionId}`);
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
      logger.info(`AgentLoop complete: ${sessionId} content=${content.length} reasoning=${reasoning.length}`);

      this.titleGenerator.generate(sessionId, baseURL, apiKey, model).catch(() => {});

      return { stopReason: 'end_turn' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.info(`AgentLoop aborted: ${sessionId}`);
        return { stopReason: 'cancelled' };
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`AgentLoop error: ${sessionId} ${msg}`);
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
    if (!session) {
      logger.warn(`AgentLoop replay: session not found ${sessionId}`);
      return;
    }

    logger.info(`AgentLoop replay: ${sessionId} ${session.data.messages.length} msgs`);
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
    } catch (err) {
      logger.warn(`AgentLoop sendChunk failed: ${sessionId} ${err}`);
    }
  }
}
