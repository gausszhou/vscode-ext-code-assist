import {
  ClientSideConnection,
  type Client,
  type SessionNotification,
  type TextContent,
} from '@agentclientprotocol/sdk'
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
import { createWebviewClientStream } from './acp-transport'

export interface ProviderConfig {
  baseURL: string
  apiKey: string
  model: string
  provider: string
}

export type SessionUpdateCallback = (chunk: {
  type: 'user_message_chunk' | 'agent_message_chunk'
  text: string
}) => void

export type SessionInfoCallback = (info: { title?: string }) => void

export interface SessionInfo {
  id: string
  title: string
  updatedAt: string
}

export class AcpClient {
  private connection: ClientSideConnection | null = null
  private _sessionId: string | null = null
  private updateCallbacks: Set<SessionUpdateCallback> = new Set()
  private infoCallbacks: Set<SessionInfoCallback> = new Set()
  private _initialized = false
  private initPromise: Promise<void> | null = null

  get sessionId(): string | null {
    return this._sessionId
  }

  get initialized(): boolean {
    return this._initialized
  }

  async initialize(): Promise<void> {
    if (this._initialized) return
    if (this.initPromise) return this.initPromise
    if (typeof (globalThis as any).acquireVsCodeApi === 'undefined') {
      return
    }

    this.initPromise = (async () => {
      const stream = createWebviewClientStream()

      this.connection = new ClientSideConnection(() => this.createClientHandler(), stream)

      await this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: 'code-assist-webview', version: '1.0.0' },
      })

      this._initialized = true
      this.initPromise = null
    })()

    return this.initPromise
  }

  private createClientHandler(): Client {
    const self = this
    return {
      sessionUpdate(params: SessionNotification): Promise<void> {
        const update = params.update
        if (update.sessionUpdate === 'agent_message_chunk' || update.sessionUpdate === 'user_message_chunk') {
          const content = update.content as TextContent & { type: 'text' }
          if (content?.text) {
            self.updateCallbacks.forEach((cb) =>
              cb({ type: update.sessionUpdate, text: content.text }),
            )
          }
        } else if (update.sessionUpdate === 'session_info_update') {
          const info = update as any
          if (info.title !== undefined) {
            self.infoCallbacks.forEach((cb) => cb({ title: info.title }))
          }
        }
        return Promise.resolve()
      },

      requestPermission(_params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
        return Promise.resolve({ outcome: 'cancelled' } as any)
      },
    }
  }

  onUpdate(callback: SessionUpdateCallback): () => void {
    this.updateCallbacks.add(callback)
    return () => this.updateCallbacks.delete(callback)
  }

  onInfo(callback: SessionInfoCallback): () => void {
    this.infoCallbacks.add(callback)
    return () => this.infoCallbacks.delete(callback)
  }

  async createSession(cwd = '', providerConfig?: ProviderConfig): Promise<string> {
    if (!this.connection) throw new Error('ACP Client not initialized')
    const result = await this.connection.newSession({
      cwd,
      mcpServers: [],
      _meta: providerConfig ? { provider: providerConfig } : undefined,
    })
    this._sessionId = result.sessionId
    return result.sessionId
  }

  async loadSession(sessionId: string): Promise<void> {
    if (!this.connection) throw new Error('ACP Client not initialized')
    await this.connection.loadSession({ sessionId, cwd: '', mcpServers: [] })
    this._sessionId = sessionId
  }

  async closeSession(): Promise<void> {
    if (!this._sessionId || !this.connection) return
    await this.connection.closeSession({ sessionId: this._sessionId }).catch(() => {})
    this._sessionId = null
  }

  async loadSessionHistory(
    sessionId: string,
  ): Promise<{ type: 'user_message_chunk' | 'agent_message_chunk'; text: string }[]> {
    const history: { type: 'user_message_chunk' | 'agent_message_chunk'; text: string }[] = []
    const cleanup = this.onUpdate((chunk) => {
      history.push(chunk)
    })
    await this.loadSession(sessionId)
    cleanup()
    return history
  }

  async prompt(text: string): Promise<void> {
    if (!this.connection || !this._sessionId) throw new Error('ACP Client not initialized')
    await this.connection.prompt({
      sessionId: this._sessionId,
      prompt: [{ type: 'text', text }],
    })
  }

  cancel(): void {
    if (!this._sessionId) return
    this.connection?.cancel({ sessionId: this._sessionId }).catch(() => {})
  }

  cancelSession(sessionId: string): void {
    this.connection?.cancel({ sessionId }).catch(() => {})
  }

  // ---- Session CRUD ----

  async listSessions(): Promise<SessionInfo[]> {
    if (!this.connection) return []
    const result = await this.connection.listSessions({})
    return result.sessions.map((s) => ({
      id: s.sessionId,
      title: s.title ?? '',
      updatedAt: s.updatedAt ?? '',
    }))
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    if (!this.connection) return
    await this.connection.extMethod('code-assist/session/updateTitle', { sessionId, title })
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.connection) return
    await this.connection.extMethod('code-assist/session/delete', { sessionId })
  }

  async getSessionMessages(
    sessionId: string,
  ): Promise<{ messages: { role: string; content: string }[]; model: string; provider: string; title: string }> {
    if (!this.connection) return { messages: [], model: '', provider: '', title: '' }
    const result = await this.connection.extMethod('code-assist/session/messages', { sessionId })
    return result as any
  }

  async summarizeSession(sessionId: string, baseURL: string, apiKey: string, model: string): Promise<string> {
    if (!this.connection) return ''
    const result = await this.connection.extMethod('code-assist/session/summarize', { sessionId, baseURL, apiKey, model })
    return ((result as any)?.title as string) ?? ''
  }

  async saveSession(data: {
    sessionId: string
    title?: string
    messages?: { role: string; content: string }[]
    model?: string
    provider?: string
  }): Promise<void> {
    if (!this.connection) return
    await this.connection.extMethod('code-assist/session/save', data)
  }

  // ---- Provider & Settings storage ----

  async listProviders(): Promise<any> {
    if (!this.connection) return { providers: [] }
    try {
      return await this.connection.extMethod('code-assist/providers/list', {})
    } catch {
      return { providers: [] }
    }
  }

  async saveProviders(providers: unknown[]): Promise<void> {
    if (!this.connection) return
    await this.connection.extMethod('code-assist/providers/save', { providers })
  }

  async getSettings(keys: string[]): Promise<Record<string, unknown>> {
    if (!this.connection) return {}
    try {
      return (await this.connection.extMethod('code-assist/settings/get', { keys })) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  async setSettings(values: Record<string, unknown>): Promise<void> {
    if (!this.connection) return
    await this.connection.extMethod('code-assist/settings/set', values)
  }

  async listModels(baseURL: string, apiKey: string): Promise<any> {
    if (!this.connection) return { object: 'list', data: [] }
    try {
      return await this.connection.extMethod('code-assist/models', { baseURL, apiKey })
    } catch {
      return { object: 'list', data: [] }
    }
  }

  dispose(): void {
    this.updateCallbacks.clear()
    this.connection = null
    this._sessionId = null
    this._initialized = false
  }
}
