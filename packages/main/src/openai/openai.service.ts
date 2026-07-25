import OpenAI from 'openai';
import { logger } from '../logger/logger.service';
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
  ChatCompletionTool,
  Model,
} from 'openai/resources/index';

export interface ChatConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class OpenAIService {
  async models(config: ChatConfig): Promise<{ object: string; data: Model[] }> {
    logger.info(`OpenAI models: ${config.baseURL}`);
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const list = await openai.models.list();
    return list as unknown as { object: string; data: Model[] };
  }

  async chat(config: ChatConfig & { messages: ChatCompletionMessageParam[] }) {
    logger.info(`OpenAI chat: ${config.model} ${config.messages.length} msgs`);
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    return openai.chat.completions.create({
      model: config.model,
      messages: config.messages,
    });
  }

  async chatWithTools(
    config: ChatConfig & { messages: ChatCompletionMessageParam[]; tools?: ChatCompletionTool[] },
  ) {
    logger.info(`OpenAI chatWithTools: ${config.model} ${config.messages.length} msgs tools=${config.tools?.length ?? 0}`);
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    return openai.chat.completions.create({
      model: config.model,
      messages: config.messages,
      tools: config.tools,
    });
  }

  async chatStream(
    config: ChatConfig & { messages: ChatCompletionMessageParam[]; tools?: ChatCompletionTool[] },
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    logger.info(`OpenAI chatStream: ${config.model} ${config.messages.length} msgs`);
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: config.messages,
      stream: true,
      tools: config.tools,
    });
    return stream.toReadableStream();
  }
}
