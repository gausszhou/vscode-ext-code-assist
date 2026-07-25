import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition } from './tool.types';

export const grepTool: ToolDefinition = {
  name: 'grep',
  description: 'Search file contents using regex patterns. Returns matching file paths and line numbers.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description: 'Regex pattern to search for in file contents',
      },
      include: {
        type: 'string',
        description: 'File glob pattern to filter which files to search, e.g. "*.ts"',
      },
      cwd: {
        type: 'string',
        description: 'Working directory. Defaults to the workspace root.',
      },
    },
    required: ['pattern'],
  },

  async execute(args) {
    const pattern = args.pattern as string;
    const include = args.include as string | undefined;
    const cwd = (args.cwd as string) || process.env.VSCODE_CWD || process.cwd();
    const regex = new RegExp(pattern, 'gi');

    const results: string[] = [];
    await searchDir(cwd, regex, include, results, cwd);

    return results.length > 0
      ? results.join('\n')
      : `No matches found for pattern "${pattern}".`;
  },
};

async function searchDir(
  dir: string,
  regex: RegExp,
  include: string | undefined,
  results: string[],
  root: string,
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const includeRegex = include ? globToRegex(include) : null;

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await searchDir(fullPath, regex, include, results, root);
    } else if (entry.isFile()) {
      if (includeRegex && !includeRegex.test(entry.name)) {continue;}

      try {
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        const relPath = path.relative(root, fullPath);

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
          }
          regex.lastIndex = 0;
        }
      } catch {
        // skip files that can't be read as text
      }
    }
  }
}

function globToRegex(glob: string): RegExp {
  let regexStr = '^';
  for (const c of glob) {
    if (c === '*') {regexStr += '.*';}
    else if (c === '.') {regexStr += '\\.';}
    else if (c === '?') {regexStr += '.';}
    else {regexStr += c;}
  }
  regexStr += '$';
  return new RegExp(regexStr);
}
