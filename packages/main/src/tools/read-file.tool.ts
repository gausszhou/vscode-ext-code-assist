import * as fs from 'fs';
import type { ToolDefinition } from './tool.types';

const MAX_FILE_SIZE = 100 * 1024; // 100KB limit

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file. Returns the full text content.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed). Default is 1.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read. Default is 2000.',
      },
    },
    required: ['path'],
  },

  async execute(args) {
    const filePath = args.path as string;
    const offset = (args.offset as number) || 1;
    const limit = (args.limit as number) || 2000;

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        return `Error: "${filePath}" is not a file.`;
      }

      if (stat.size > MAX_FILE_SIZE) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const selected = lines.slice(offset - 1, offset - 1 + limit);
        return selected.join('\n') + '\n\n[File truncated - showing ' + selected.length + ' of ' + lines.length + ' lines]';
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const selected = lines.slice(offset - 1, offset - 1 + limit);
      return selected.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return `Error reading file: ${msg}`;
    }
  },
};
