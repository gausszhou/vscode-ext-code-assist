import type { ToolDefinition } from './tool.types';

const MAX_CONTENT_LENGTH = 50 * 1024; // 50KB limit

export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch the content of a web page. Returns the text content of the page.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
    },
    required: ['url'],
  },

  async execute(args) {
    const url = args.url as string;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('application/json')) {
        const json = JSON.parse(text);
        return JSON.stringify(json, null, 2);
      }

      // Strip HTML tags for text content
      const plain = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (plain.length > MAX_CONTENT_LENGTH) {
        return plain.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated]';
      }

      return plain || 'Empty response.';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return `Fetch error: ${msg}`;
    }
  },
};
