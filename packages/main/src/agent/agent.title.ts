import { OpenAIService } from '../openai/openai.service';
import { SessionManagerService } from '../session/session-manager.service';
import { logger } from '../logger/logger.service';

export class TitleGeneratorService {
  constructor(
    private openaiService: OpenAIService,
    private sessionManager: SessionManagerService,
  ) {}

  async generate(sessionId: string, baseURL: string, apiKey: string, model: string): Promise<void> {
    logger.info(`TitleGenerator start: ${sessionId}`);
    try {
      const stored = await this.sessionManager.getStore().load(sessionId);
      if (!stored || stored.messages.length === 0) {
        logger.warn(`TitleGenerator: no messages for ${sessionId}`);
        return;
      }

      const resp = await this.openaiService.chat({
        baseURL,
        apiKey,
        model,
        messages: [
          ...stored.messages.map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: '请用20字以内总结以上对话主题，作为对话标题直接返回，不需要任何标点和修饰' },
        ],
      });

      const title = ((resp as any)?.choices?.[0]?.message?.content || '').slice(0, 20);
      if (title) {
        await this.sessionManager.getStore().updateTitle(sessionId, title);
        logger.info(`TitleGenerator done: ${sessionId} "${title}"`);
      } else {
        logger.warn(`TitleGenerator: empty title for ${sessionId}`);
      }
    } catch (err: unknown) {
      logger.error(`TitleGenerator error: ${sessionId} ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}
