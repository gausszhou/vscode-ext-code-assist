import type { ToolDefinition } from './tool.types';

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information. Returns relevant results for the query.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },

  async execute(args) {
    const query = args.query as string;

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' },
      });
      const data = await response.json() as any;

      const results: string[] = [];

      if (data.AbstractText) {
        results.push(data.AbstractText);
      }

      if (data.AbstractURL) {
        results.push(`Source: ${data.AbstractURL}`);
      }

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text) {
            results.push(`- ${topic.Text}`);
          }
        }
      }

      if (results.length === 0) {
        return `No results found for "${query}".`;
      }

      return results.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return `Search error: ${msg}`;
    }
  },
};
