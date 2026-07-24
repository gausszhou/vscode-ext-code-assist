import OpenAI from 'openai';
import { logger } from './logger.service';
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
  Model,
} from 'openai/resources/index';

export interface ChatConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export class OpenAIService {
  async models(config: ChatConfig): Promise<{ object: string; data: Model[] }> {
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const list = await openai.models.list();
    return list as unknown as { object: string; data: Model[] };
  }

  async chat(config: ChatConfig & { messages: ChatCompletionMessageParam[] }) {
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    return openai.chat.completions.create({
      model: config.model,
      messages: config.messages,
    });
  }

  async chatStream(
    config: ChatConfig & { messages: ChatCompletionMessageParam[] },
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    const openai = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: config.messages,
      stream: true,
    });
    return stream.toReadableStream();
  }
}
