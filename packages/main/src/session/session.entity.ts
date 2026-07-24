import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type MessageRole = 'user' | 'agent' | 'think' | 'tool' | 'system';

export interface StoredMessage {
  role: MessageRole;
  content: string;
  model?: string;
  provider?: string;
  startTime?: number;
  loadTime?: number;
  endTime?: number;
}

export interface SessionData {
  id: string;
  cwd: string;
  messages: StoredMessage[];
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  provider: string;
}

export class SessionEntity {
  data: SessionData;
  config: PromptConfig = { baseURL: '', apiKey: '', model: '', provider: '' };
  activeController: AbortController | null = null;

  constructor(id: string, cwd: string, config?: Partial<PromptConfig>) {
    this.data = {
      id,
      cwd,
      messages: [],
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  static fromData(data: SessionData): SessionEntity {
    const session = new SessionEntity(data.id, data.cwd);
    session.data = { ...data, messages: [...data.messages] };
    return session;
  }

  addMessage(msg: StoredMessage): void {
    this.data.messages.push(msg);
    this.data.updatedAt = Date.now();
  }

  toCompletionMessages(): ChatCompletionMessageParam[] {
    const result: ChatCompletionMessageParam[] = [];
    for (const m of this.data.messages) {
      if (m.role === 'agent' || m.role === 'think') {
        result.push({ role: 'assistant', content: m.content });
      } else if (m.role === 'tool') {
        result.push({ role: 'tool', content: m.content, tool_call_id: '' });
      } else {
        result.push({ role: m.role as 'user' | 'system', content: m.content });
      }
    }
    return result;
  }

  cancel(): void {
    this.activeController?.abort();
    this.activeController = null;
  }
}
