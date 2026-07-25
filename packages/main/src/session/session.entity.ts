import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export type MessageRole = 'user' | 'agent' | 'think' | 'tool' | 'system';

export interface ToolCallData {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

export interface StoredMessage {
  role: MessageRole;
  content: string;
  model?: string;
  provider?: string;
  startTime?: number;
  loadTime?: number;
  endTime?: number;
  tool_call_id?: string;
  tool_calls?: ToolCallData[];
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
      if (m.role === 'agent') {
        const msg: ChatCompletionMessageParam = { role: 'assistant', content: m.content || null };
        if (m.tool_calls && m.tool_calls.length > 0) {
          msg.tool_calls = m.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }));
        }
        result.push(msg);
      } else if (m.role === 'think') {
        result.push({ role: 'assistant', content: m.content });
      } else if (m.role === 'tool') {
        result.push({ role: 'tool', content: m.content, tool_call_id: m.tool_call_id || '' });
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
