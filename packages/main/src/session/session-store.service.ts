import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { SessionData } from './session.entity';
import { logger } from '../logger/logger.service';

const INDEX_KEY = 'session-index';

export interface SessionIndex {
  id: string;
  cwd: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export class SessionStoreService {
  private sessionsDir: string;

  constructor(
    private storage: vscode.Memento,
    globalStorageUri: vscode.Uri,
  ) {
    this.sessionsDir = path.join(globalStorageUri.fsPath, 'data', 'sessions');
    fs.mkdirSync(this.sessionsDir, { recursive: true });
    logger.info(`SessionStore initialized: ${this.sessionsDir}`);
  }

  async save(data: SessionData): Promise<void> {
    const file = path.join(this.sessionsDir, `${data.id}.json`);
    await fs.promises.writeFile(file, JSON.stringify(data, null, 0), 'utf-8');
    await this.updateIndex(data);
    logger.info(`SessionStore saved: ${data.id} (${data.messages.length} msgs)`);
  }

  async load(sessionId: string): Promise<SessionData | null> {
    const file = path.join(this.sessionsDir, `${sessionId}.json`);
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const data: SessionData = JSON.parse(raw);
      logger.info(`SessionStore loaded: ${sessionId} (${data.messages.length} msgs)`);
      return data;
    } catch {
      logger.warn(`SessionStore load failed: ${sessionId}`);
      return null;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const file = path.join(this.sessionsDir, `${sessionId}.json`);
    try {
      await fs.promises.unlink(file);
      logger.info(`SessionStore deleted: ${sessionId}`);
    } catch {
      logger.warn(`SessionStore delete file not found: ${sessionId}`);
    }
    await this.removeFromIndex(sessionId);
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    const data = await this.load(sessionId);
    if (!data) {
      logger.warn(`SessionStore updateTitle not found: ${sessionId}`);
      return;
    }
    data.title = title;
    data.updatedAt = Date.now();
    await this.save(data);
    logger.info(`SessionStore updateTitle: ${sessionId} "${title}"`);
  }

  list(): SessionIndex[] {
    const index = this.storage.get<SessionIndex[]>(INDEX_KEY, []);
    logger.info(`SessionStore list: ${index.length} sessions`);
    return index;
  }

  private async updateIndex(data: SessionData): Promise<void> {
    let index = this.list().filter((i) => i.id !== data.id);
    index.unshift({
      id: data.id,
      cwd: data.cwd,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    await this.storage.update(INDEX_KEY, index);
  }

  private async removeFromIndex(sessionId: string): Promise<void> {
    const index = this.list().filter((i) => i.id !== sessionId);
    await this.storage.update(INDEX_KEY, index);
  }
}
