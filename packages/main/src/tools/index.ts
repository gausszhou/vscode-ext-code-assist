import type { ToolDefinition } from './tool.types';
import { globTool } from './glob.tool';
import { grepTool } from './grep.tool';
import { readDirTool } from './read-dir.tool';
import { readFileTool } from './read-file.tool';
import { webSearchTool } from './web-search.tool';
import { webFetchTool } from './web-fetch.tool';

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  toolRegistry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

export function getOpenAITools() {
  return getAllTools().map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

registerTool(globTool);
registerTool(grepTool);
registerTool(readDirTool);
registerTool(readFileTool);
registerTool(webSearchTool);
registerTool(webFetchTool);
