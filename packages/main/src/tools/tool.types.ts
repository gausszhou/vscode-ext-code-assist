import type { ChatCompletionTool } from 'openai/resources/index';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ChatCompletionTool['function']['parameters'];
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export const TOOL_KIND_MAP: Record<string, string> = {
  glob: 'search',
  grep: 'search',
  read_dir: 'read',
  read_file: 'read',
  web_search: 'fetch',
  web_fetch: 'fetch',
};
