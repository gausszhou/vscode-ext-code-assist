import * as vscode from 'vscode';

export class SettingsService {
  constructor(private storage: vscode.Memento) {}

  async get(params: { keys: string[] }): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const key of params.keys) {
      result[key] = this.storage.get<string>(key, '');
    }
    return result;
  }

  async set(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    for (const [key, value] of Object.entries(params)) {
      await this.storage.update(key, value);
    }
    return {};
  }
}
