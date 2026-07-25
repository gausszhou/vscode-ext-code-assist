import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import { OpenAIService } from '../openai/openai.service';
import { SessionManagerService } from '../session/session-manager.service';
import { TitleGeneratorService } from './agent.title';
import { getTool, getOpenAITools } from '../tools';
import { logger } from '../logger/logger.service';
import type { ChatCompletionChunk } from 'openai/resources/index';

const MAX_TOOL_ITERATIONS = 10;

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

    const { baseURL, apiKey, model } = session.config;
    if (!baseURL || !apiKey || !model) {
      session.addMessage({
        role: 'agent',
        content: 'Error: Provider not configured. Please set up API provider first.',
        model,
        provider: session.config.provider,
      });
      await this.sessionManager.getStore().save(session.data);
      return { stopReason: 'end_turn' };
    }

    try {
      let toolIterations = 0;
      let finalContent = '';
      let finalReasoning = '';

      while (!controller.signal.aborted && toolIterations < MAX_TOOL_ITERATIONS) {
        toolIterations++;

        const stream = await this.openaiService.chatStream({
          baseURL,
          apiKey,
          model,
          messages: session.toCompletionMessages(),
          tools: getOpenAITools(),
        });

        const { content, reasoning, toolCalls } = await this.readStream(
          stream, controller, connection, sessionId,
        );

        if (controller.signal.aborted) {
          if (content) {finalContent += content;}
          if (reasoning) {finalReasoning += reasoning;}
          break;
        }

        if (toolCalls && toolCalls.length > 0) {
          await this.sendToolCallNotification(connection, sessionId, toolCalls);

          session.addMessage({
            role: 'agent',
            content: '',
            model,
            provider: session.config.provider,
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            const tool = getTool(tc.function.name);
            let result: string;
            if (tool) {
              try {
                const args = JSON.parse(tc.function.arguments);
                result = await tool.execute(args);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                result = `Error executing tool '${tc.function.name}': ${msg}`;
              }
            } else {
              result = `Error: Unknown tool '${tc.function.name}'`;
            }

            session.addMessage({
              role: 'tool',
              content: result,
              tool_call_id: tc.id,
            });

            await this.sendToolResultNotification(connection, sessionId, tc.function.name, result);
          }

          await this.sessionManager.getStore().save(session.data);
          continue;
        }

        if (content) {finalContent += content;}
        if (reasoning) {finalReasoning += reasoning;}
        break;
      }

      if (controller.signal.aborted) {
        logger.info(`AgentLoop cancelled: ${sessionId}`);
        if (finalContent) {
          session.addMessage({ role: 'agent', content: finalContent, model, provider: session.config.provider });
        }
        if (finalReasoning) {
          session.addMessage({ role: 'think', content: finalReasoning, model, provider: session.config.provider });
        }
        await this.sessionManager.getStore().save(session.data);
        return { stopReason: 'cancelled' };
      }

      if (toolIterations >= MAX_TOOL_ITERATIONS) {
        logger.warn(`AgentLoop max tool iterations reached: ${sessionId}`);
      }

      if (finalContent || !toolIterations) {
        session.addMessage({ role: 'agent', content: finalContent, model, provider: session.config.provider });
      }
      if (finalReasoning) {
        session.addMessage({ role: 'think', content: finalReasoning, model, provider: session.config.provider });
      }
      await this.sessionManager.getStore().save(session.data);
      logger.info(`AgentLoop complete: ${sessionId} content=${finalContent.length} reasoning=${finalReasoning.length}`);

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

  private async readStream(
    stream: ReadableStream<ChatCompletionChunk>,
    controller: AbortController,
    connection: AgentSideConnection,
    sessionId: string,
  ): Promise<{ content: string; reasoning: string; toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> | null }> {
    let content = '';
    let reasoning = '';
    const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();

    if (!(stream instanceof ReadableStream)) {
      return { content, reasoning, toolCalls: null };
    }

    const reader = stream.getReader();
    let lastFinishReason: string | null = null;

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

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            let entry = toolCallAccum.get(idx);
            if (!entry) {
              entry = { id: '', name: '', args: '' };
              toolCallAccum.set(idx, entry);
            }
            if (tc.id) {entry.id = tc.id;}
            if (tc.function?.name) {entry.name += tc.function.name;}
            if (tc.function?.arguments) {entry.args += tc.function.arguments;}
          }
        }
      }

      lastFinishReason = value.choices?.[0]?.finish_reason ?? null;
    }

    if (lastFinishReason === 'tool_calls' && toolCallAccum.size > 0) {
      const toolCalls = Array.from(toolCallAccum.values()).map((e) => ({
        id: e.id,
        type: 'function' as const,
        function: { name: e.name, arguments: e.args },
      }));
      return { content, reasoning, toolCalls };
    }

    return { content, reasoning, toolCalls: null };
  }

  private async sendToolCallNotification(
    connection: AgentSideConnection,
    sessionId: string,
    toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>,
  ): Promise<void> {
    try {
      await connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_call' as any,
          content: { type: 'tool_call', toolCalls: toolCalls.map(tc => ({ name: tc.function.name, arguments: tc.function.arguments })) } as any,
        },
      });
    } catch (err) {
      logger.warn(`AgentLoop sendToolCallNotification failed: ${sessionId} ${err}`);
    }
  }

  private async sendToolResultNotification(
    connection: AgentSideConnection,
    sessionId: string,
    toolName: string,
    result: string,
  ): Promise<void> {
    try {
      await connection.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_result' as any,
          content: { type: 'tool_result', toolName, result } as any,
        },
      });
    } catch (err) {
      logger.warn(`AgentLoop sendToolResultNotification failed: ${sessionId} ${err}`);
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
      if (msg.role === 'tool') {
        const updateType = 'agent_message_chunk' as const;
        const toolLabel = `[Tool Result: ${msg.tool_call_id || ''}]\n${msg.content}`;
        await this.sendChunk(connection, sessionId, toolLabel, updateType);
      } else {
        const updateType = msg.role === 'user'
          ? 'user_message_chunk' as const
          : 'agent_message_chunk' as const;
        await this.sendChunk(connection, sessionId, msg.content, updateType);
      }
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