import * as UUID from 'uuid';

type MessageRole = 'system' | 'user' | 'agent' | 'think' | 'tool';

export interface IToolCallDisplay {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: 'running' | 'completed' | 'error';
}

export class ChatMessage {
  id: string = UUID.v4();
  conversationId: string = UUID.v4();
  role: MessageRole = 'system';
  model: string = '';
  provider: string = '';
  content: string = '';
  reasoning?: string = '';
  toolCalls: IToolCallDisplay[] = [];
  startTime?: number = Date.now();
  loadTime?: number = Date.now();
  endTime?: number = Date.now();
  constructor(role: MessageRole, conversationId: string) {
    this.role = role;
    this.conversationId = conversationId;
  }
}