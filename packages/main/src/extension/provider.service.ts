import * as vscode from 'vscode';

export class ProviderService {
  constructor(private secrets: vscode.SecretStorage) {}

  async list(): Promise<Record<string, unknown>> {
    const raw = await this.secrets.get('providers');
    if (!raw) {return { providers: [] };}
    try { return { providers: JSON.parse(raw) }; }
    catch { return { providers: [] }; }
  }

  async save(params: { providers: unknown[] }): Promise<Record<string, unknown>> {
    await this.secrets.store('providers', JSON.stringify(params.providers));
    return {};
  }
}
