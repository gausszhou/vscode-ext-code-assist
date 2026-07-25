export interface IStandardItem<T> {
  value: T;
  label: string;
}

export interface IChatChunk {
  type: 'content' | 'reasoning' | 'error';
  data: string;
}

export interface IChatChunkMerge {
  conversationId: string;
  type: 'content' | 'reasoning'  | 'error' |  'end';
  data?: string;
  startTime?: number;
  loadTime?: number;
  endTime?: number;
}

export interface IToolCallInfo {
  name: string;
  arguments: string;
}

export interface IToolResult {
  toolName: string;
  result: string;
}

