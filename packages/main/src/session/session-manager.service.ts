import { SessionEntity, type PromptConfig } from './session.entity';
import { SessionStoreService } from './session-store.service';
import type { SessionIndex } from './session-store.service';
import { logger } from '../logger/logger.service';

export class SessionManagerService {
  private sessions = new Map<string, SessionEntity>();

  constructor(private sessionStore: SessionStoreService) {}

  create(cwd: string, config?: Partial<PromptConfig>): string {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = new SessionEntity(id, cwd, config);
    this.sessions.set(id, session);
    logger.info(`SessionManager create: ${id} model=${config?.model || 'none'}`);
    return id;
  }

  get(sessionId: string): SessionEntity | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`SessionManager get not found: ${sessionId}`);
    }
    return session;
  }

  async loadFromStore(sessionId: string): Promise<SessionEntity | null> {
    logger.info(`SessionManager loadFromStore: ${sessionId}`);
    const stored = await this.sessionStore.load(sessionId);
    if (!stored) {
      logger.warn(`SessionManager loadFromStore not found: ${sessionId}`);
      return null;
    }
    const session = SessionEntity.fromData(stored);
    this.sessions.set(sessionId, session);
    return session;
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cancel();
      logger.info(`SessionManager cancel: ${sessionId}`);
    } else {
      logger.warn(`SessionManager cancel not found: ${sessionId}`);
    }
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cancel();
      this.sessions.delete(sessionId);
      logger.info(`SessionManager close: ${sessionId}`);
    } else {
      logger.warn(`SessionManager close not found: ${sessionId}`);
    }
  }

  async delete(sessionId: string): Promise<void> {
    logger.info(`SessionManager delete: ${sessionId}`);
    this.sessions.get(sessionId)?.cancel();
    this.sessions.delete(sessionId);
    await this.sessionStore.delete(sessionId);
  }

  list(): SessionIndex[] {
    return this.sessionStore.list();
  }

  getStore(): SessionStoreService {
    return this.sessionStore;
  }
}
