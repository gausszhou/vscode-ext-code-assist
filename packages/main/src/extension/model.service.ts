import { OpenAIService } from '../openai/openai.service';

export class ModelService {
  constructor(private openaiService: OpenAIService) {}

  async listModels(config: { baseURL: string; apiKey: string }): Promise<Record<string, unknown>> {
    try {
      const resp = await this.openaiService.models(config);
      return resp as Record<string, unknown>;
    } catch (err: unknown) {
      return { message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
