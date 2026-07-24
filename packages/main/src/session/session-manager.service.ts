import { SessionEntity, type PromptConfig } from './session.entity';
import { SessionStoreService } from './session-store.service';
import type { SessionIndex } from './session-store.service';

export class SessionManagerService {
  private sessions = new Map<string, SessionEntity>();

  constructor(private sessionStore: SessionStoreService) {}

  create(cwd: string, config?: Partial<PromptConfig>): string {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = new SessionEntity(id, cwd, config);
    this.sessions.set(id, session);
    return id;
  }

  get(sessionId: string): SessionEntity | undefined {
    return this.sessions.get(sessionId);
  }

  async loadFromStore(sessionId: string): Promise<SessionEntity | null> {
    const stored = await this.sessionStore.load(sessionId);
    if (!stored) {return null;}
    const session = SessionEntity.fromData(stored);
    this.sessions.set(sessionId, session);
    return session;
  }

  cancel(sessionId: string): void {
    this.sessions.get(sessionId)?.cancel();
  }

  close(sessionId: string): void {
    this.sessions.get(sessionId)?.cancel();
    this.sessions.delete(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
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
