import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition } from './tool.types';

export const readDirTool: ToolDefinition = {
  name: 'read_dir',
  description: 'List files and subdirectories in a directory.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the directory',
      },
    },
    required: ['path'],
  },

  async execute(args) {
    const dirPath = args.path as string;

    try {
      const stat = await fs.promises.stat(dirPath);
      if (!stat.isDirectory()) {
        return `Error: "${dirPath}" is not a directory.`;
      }
    } catch {
      return `Error: Directory "${dirPath}" does not exist.`;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const lines = entries.map((e) => {
        const type = e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'link' : 'file';
        return `${e.name}/`;
      });
      return lines.length > 0 ? lines.join('\n') : 'Directory is empty.';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return `Error reading directory: ${msg}`;
    }
  },
};
