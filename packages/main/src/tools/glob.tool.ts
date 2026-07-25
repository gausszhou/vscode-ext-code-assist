import * as fs from 'fs';
import * as path from 'path';
import type { ToolDefinition } from './tool.types';

export const globTool: ToolDefinition = {
  name: 'glob',
  description: 'Find files matching a glob pattern. Returns matching file paths.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern, e.g. "src/**/*.ts", "*.json"',
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
    const cwd = (args.cwd as string) || process.env.VSCODE_CWD || process.cwd();

    const files = await glob(pattern, cwd);
    return files.join('\n') || 'No files found.';
  },
};

async function glob(pattern: string, cwd: string): Promise<string[]> {
  const results: string[] = [];
  const isNegated = pattern.startsWith('!');
  const cleanPattern = isNegated ? pattern.slice(1) : pattern;
  const parts = cleanPattern.split('/');

  await walk(cwd, parts, 0, results);

  if (isNegated) {
    const negated = await glob(pattern.slice(1), cwd);
    return results.filter((f) => !negated.includes(f));
  }

  return results;
}

async function walk(dir: string, patternParts: string[], depth: number, results: string[]): Promise<void> {
  if (depth >= patternParts.length) {return;}

  const part = patternParts[depth];
  const isLast = depth === patternParts.length - 1;

  if (part.includes('*') || part.includes('{') || part.includes('[')) {
    const entries = await readDirSafe(dir);
    const regex = globToRegex(part);

    for (const entry of entries) {
      if (!regex.test(entry.name)) {continue;}

      const fullPath = path.join(dir, entry.name);

      if (isLast) {
        if (entry.isFile()) {
          results.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        await walk(fullPath, patternParts, depth + 1, results);
      }
    }
  } else {
    const fullPath = path.join(dir, part);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (isLast) {
        if (stat.isFile()) {
          results.push(fullPath);
        }
      } else if (stat.isDirectory()) {
        await walk(fullPath, patternParts, depth + 1, results);
      }
    } catch {
      // path doesn't exist, skip
    }
  }
}

function readDirSafe(dir: string): Promise<fs.Dirent[]> {
  return fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
}

function globToRegex(glob: string): RegExp {
  let regexStr = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      regexStr += '.*';
    } else if (c === '?') {
      regexStr += '.';
    } else if (c === '.') {
      regexStr += '\\.';
    } else {
      regexStr += c;
    }
  }
  regexStr += '$';
  return new RegExp(regexStr);
}
