import { ModelService } from './model.service';
import { ProviderService } from './provider.service';
import { SettingsService } from './settings.service';
import { SessionService } from './session.service';
import { logger } from '../logger/logger.service';

export class ExtensionRouter {
  constructor(
    private modelService: ModelService,
    private providerService: ProviderService,
    private settingsService: SettingsService,
    private sessionService: SessionService,
  ) {}

  async handle(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info(`ExtensionRouter: ${method}`);
    switch (method) {
      case 'code-assist/models':
        return this.modelService.listModels(params as any);
      case 'code-assist/session/updateTitle':
        return this.sessionService.updateTitle(params as any);
      case 'code-assist/session/delete':
        return this.sessionService.delete(params as any);
      case 'code-assist/session/messages':
        return this.sessionService.getMessages(params as any);
      case 'code-assist/session/save':
        return this.sessionService.save(params as any);
      case 'code-assist/session/summarize':
        return this.sessionService.summarize(params as any);
      case 'code-assist/providers/list':
        return this.providerService.list();
      case 'code-assist/providers/save':
        return this.providerService.save(params as any);
      case 'code-assist/settings/get':
        return this.settingsService.get(params as any);
      case 'code-assist/settings/set':
        return this.settingsService.set(params as any);
      default:
        logger.warn(`ExtensionRouter unknown method: ${method}`);
        return Promise.resolve({});
    }
  }
}
