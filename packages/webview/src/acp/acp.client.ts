import {
  ClientSideConnection,
  type Client,
  type SessionNotification,
  type TextContent,
} from '@agentclientprotocol/sdk'
import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
import { createWebviewClientStream } from './acp.transport'

const prefix = '[ACP Client]'

export interface ToolCallChunk {
  toolCalls: Array<{ name: string; arguments: string }>
}

export interface ToolResultChunk {
  toolName: string
  result: string
}

export type SessionUpdateCallback = (chunk: {
  type: 'user_message_chunk' | 'agent_message_chunk' | 'tool_call' | 'tool_result'
  text: string
  toolCalls?: Array<{ name: string; arguments: string }>
  toolName?: string
  result?: string
}) => void

export type SessionInfoCallback = (info: { title?: string }) => void

export interface SessionInfo {
  id: string
  title: string
  updatedAt: string
}

export class AcpClient implements Client {
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
    if (this._initialized) {
      console.log(`${prefix} initialize: already initialized`)
      return
    }
    if (this.initPromise) return this.initPromise
    if (typeof (globalThis as any).acquireVsCodeApi === 'undefined') {
      this._initialized = true
      return
    }

    this.initPromise = (async () => {
      console.log(`${prefix} initialize: starting`)
      const stream = createWebviewClientStream()

      this.connection = new ClientSideConnection(() => this, stream)

      await this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: 'code-assist-webview', version: '1.0.0' },
      })

      this._initialized = true
      this.initPromise = null
      console.log(`${prefix} initialize: done`)
    })()

    return this.initPromise
  }

  sessionUpdate(params: SessionNotification): Promise<void> {
    const update = params.update as any
    const updateType = update.sessionUpdate as string
    if (updateType === 'agent_message_chunk' || updateType === 'user_message_chunk') {
      const content = update.content as TextContent & { type: 'text' }
      if (content?.text) {
        this.updateCallbacks.forEach((cb) =>
          cb({ type: updateType as 'agent_message_chunk' | 'user_message_chunk', text: content.text }),
        )
      }
    } else if (updateType === 'session_info_update') {
      if (update.title !== undefined) {
        this.infoCallbacks.forEach((cb) => cb({ title: update.title }))
      }
    } else if (updateType === 'tool_call') {
      if (update.content?.toolCalls) {
        this.updateCallbacks.forEach((cb) =>
          cb({ type: 'tool_call', text: '', toolCalls: update.content.toolCalls }),
        )
      }
    } else if (updateType === 'tool_result') {
      if (update.content?.toolName !== undefined) {
        this.updateCallbacks.forEach((cb) =>
          cb({ type: 'tool_result', text: '', toolName: update.content.toolName, result: update.content.result }),
        )
      }
    }
    return Promise.resolve()
  }

  requestPermission(_params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return Promise.resolve({ outcome: 'cancelled' } as any)
  }

  onUpdate(callback: SessionUpdateCallback): () => void {
    this.updateCallbacks.add(callback)
    return () => this.updateCallbacks.delete(callback)
  }

  onInfo(callback: SessionInfoCallback): () => void {
    this.infoCallbacks.add(callback)
    return () => this.infoCallbacks.delete(callback)
  }

  async createSession(cwd = '', providerConfig?: any): Promise<string> {
    if (!this.connection) throw new Error('ACP Client not initialized')
    console.log(`${prefix} createSession`)
    const result = await this.connection.newSession({
      cwd,
      mcpServers: [],
      _meta: providerConfig ? { provider: providerConfig } : undefined,
    })
    this._sessionId = result.sessionId
    console.log(`${prefix} createSession: ${result.sessionId}`)
    return result.sessionId
  }

  async loadSession(sessionId: string): Promise<void> {
    if (!this.connection) throw new Error('ACP Client not initialized')
    console.log(`${prefix} loadSession: ${sessionId}`)
    await this.connection.loadSession({ sessionId, cwd: '', mcpServers: [] })
    this._sessionId = sessionId
  }

  async closeSession(): Promise<void> {
    if (!this._sessionId || !this.connection) return
    console.log(`${prefix} closeSession: ${this._sessionId}`)
    await this.connection.closeSession({ sessionId: this._sessionId }).catch(() => {})
    this._sessionId = null
  }

  async loadSessionHistory(
    sessionId: string,
  ): Promise<{ type: 'user_message_chunk' | 'agent_message_chunk' | 'tool_call' | 'tool_result'; text: string; toolCalls?: Array<{ name: string; arguments: string }>; toolName?: string; result?: string }[]> {
    const history: { type: 'user_message_chunk' | 'agent_message_chunk' | 'tool_call' | 'tool_result'; text: string; toolCalls?: Array<{ name: string; arguments: string }>; toolName?: string; result?: string }[] = []
    const cleanup = this.onUpdate((chunk) => {
      if (chunk.type === 'agent_message_chunk' || chunk.type === 'user_message_chunk') {
        history.push(chunk)
      }
    })
    console.log(`${prefix} loadSessionHistory: ${sessionId}`)
    await this.loadSession(sessionId)
    cleanup()
    return history
  }

  async prompt(text: string): Promise<void> {
    if (!this.connection || !this._sessionId) throw new Error('ACP Client not initialized')
    console.log(`${prefix} prompt: ${this._sessionId}`)
    await this.connection.prompt({
      sessionId: this._sessionId,
      prompt: [{ type: 'text', text }],
    })
  }

  cancel(): void {
    if (!this._sessionId) return
    console.log(`${prefix} cancel: ${this._sessionId}`)
    this.connection?.cancel({ sessionId: this._sessionId }).catch(() => {})
  }

  cancelSession(sessionId: string): void {
    console.log(`${prefix} cancelSession: ${sessionId}`)
    this.connection?.cancel({ sessionId }).catch(() => {})
  }

  async listSessions(): Promise<SessionInfo[]> {
    if (!this.connection) return []
    const result = await this.connection.listSessions({})
    console.log(`${prefix} listSessions: ${result.sessions.length}`)
    return result.sessions.map((s) => ({
      id: s.sessionId,
      title: s.title ?? '',
      updatedAt: s.updatedAt ?? '',
    }))
  }

  async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.connection) return {}
    console.log(`${prefix} extMethod: ${method}`)
    return this.connection.extMethod(method, params)
  }

  dispose(): void {
    console.log(`${prefix} dispose`)
    this.updateCallbacks.clear()
    this.connection = null
    this._sessionId = null
    this._initialized = false
  }
}
