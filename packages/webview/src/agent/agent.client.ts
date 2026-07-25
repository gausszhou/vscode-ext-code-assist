import type { IProviderParams, ProviderConfig } from './agent.types'
import { AcpClient } from '../acp/acp.client'

const prefix = '[Agent Client]'
const SESSION_KEY_PREFIX = 'acp_session_'

class AgentClient {
  private acpClient: AcpClient
  private sessionIdByConfig: { [key: string]: string } = {}
  private _sessionId: string | null = null

  constructor() {
    this.acpClient = new AcpClient()
  }

  private async ready(): Promise<void> {
    await this.acpClient.initialize()
  }

  get sessionId(): string | null {
    return this._sessionId
  }

  setSessionId(id: string | null): void {
    this._sessionId = id
  }

  /** 确保 ACP session 存在，返回 sessionId */
  async ensureSession(config: ProviderConfig): Promise<string> {
    if (this._sessionId) {
      console.log(`${prefix} ensureSession: cached ${this._sessionId}`)
      return this._sessionId
    }
    await this.acpClient.initialize()

    const key = this.configKey(config)
    const inMem = this.sessionIdByConfig[key]
    if (inMem) {
      this._sessionId = inMem
      return inMem
    }

    const stored = await this.loadSessionId(key)
    if (stored) {
      console.log(`${prefix} ensureSession: restored ${stored}`)
      this.sessionIdByConfig[key] = stored
      this._sessionId = stored
      ;(this.acpClient as any)['_sessionId'] = stored
      await this.acpClient.loadSession(stored).catch(() => {})
      return stored
    }

    const sessionId = await this.acpClient.createSession('', config)
    this.sessionIdByConfig[key] = sessionId
    this._sessionId = sessionId
    await this.saveSessionId(key, sessionId)
    console.log(`${prefix} ensureSession: created ${sessionId}`)
    return sessionId
  }

  async sendPrompt(
    text: string,
    config: ProviderConfig,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
    onToolCall?: (toolCalls: Array<{ name: string; arguments: string }>) => void,
    onToolResult?: (toolName: string, result: string) => void,
  ): Promise<void> {
    if (!config.baseURL || !config.apiKey || !config.model) {
      throw new Error('Provider not configured. Please set up API provider first.')
    }
    const sessionId = await this.ensureSession(config)
    console.log(`${prefix} sendPrompt: ${sessionId}`)
    ;(this.acpClient as any)['_sessionId'] = sessionId

    const cleanup = this.acpClient.onUpdate((chunk) => {
      if (chunk.type === 'agent_message_chunk') {
        onChunk?.(chunk.text)
      } else if (chunk.type === 'tool_call' && chunk.toolCalls) {
        onToolCall?.(chunk.toolCalls)
      } else if (chunk.type === 'tool_result' && chunk.toolName) {
        onToolResult?.(chunk.toolName, chunk.result || '')
      }
    })

    if (signal) {
      signal.addEventListener('abort', () => {
        console.log(`${prefix} sendPrompt: aborted ${sessionId}`)
        this.acpClient.cancel()
        cleanup()
      }, { once: true })
    }

    try {
      await this.acpClient.prompt(text)
    } finally {
      cleanup()
    }
  }

  async loadAndReplayHistory(config: ProviderConfig): Promise<{ role: string; content: string }[]> {
    const stored = await this.loadSessionId(this.configKey(config))
    if (!stored) {
      console.log(`${prefix} loadAndReplayHistory: no stored session`)
      return []
    }

    await this.acpClient.initialize()

    const rawHistory = await this.acpClient.loadSessionHistory(stored)
    const history = rawHistory.filter(
      (h): h is { type: 'user_message_chunk' | 'agent_message_chunk'; text: string } =>
        h.type === 'user_message_chunk' || h.type === 'agent_message_chunk',
    )
    const cfgKey = this.configKey(config)
    this.sessionIdByConfig[cfgKey] = stored
    this._sessionId = stored
    ;(this.acpClient as any)['_sessionId'] = stored

    const messages = this.mergeHistory(history)
    console.log(`${prefix} loadAndReplayHistory: ${stored} ${messages.length} msgs`)
    return messages
  }

  async stopChat(sessionId?: string): Promise<any> {
    console.log(`${prefix} stopChat: ${sessionId || 'current'}`)
    await this.acpClient.initialize()
    if (sessionId) {
      this.acpClient.cancelSession(sessionId)
    } else {
      this.acpClient.cancel()
    }
    return { message: 'stopped' }
  }

  async chatRaw(params: {
    baseURL: string
    apiKey: string
    model: string
    messages: { role: string; content: string }[]
  }): Promise<any> {
    console.log(`${prefix} chatRaw: ${params.model}`)
    await this.acpClient.initialize()
    const sessionId = await this.acpClient.createSession('', {
      baseURL: params.baseURL,
      apiKey: params.apiKey,
      model: params.model,
      provider: params.baseURL,
    })
    await this.extMethod('code-assist/session/save', {
      sessionId,
      messages: params.messages,
    })

    let fullContent = ''
    return new Promise((resolve, reject) => {
      const cleanup = this.acpClient.onUpdate((chunk) => {
        if (chunk.type === 'agent_message_chunk') {
          fullContent += chunk.text
        }
      })
      ;(this.acpClient as any)['_sessionId'] = sessionId
      this.acpClient.prompt(params.messages.map(m => m.content).join('\n'))
        .then(() => {
          cleanup()
          resolve({ choices: [{ message: { content: fullContent } }] })
        })
        .catch((err) => {
          cleanup()
          reject(err)
        })
    })
  }

  // ---- Session CRUD ----

  async listSessions(): Promise<{ id: string; title: string; updatedAt: string }[]> {
    await this.acpClient.initialize()
    return this.acpClient.listSessions()
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    console.log(`${prefix} updateSessionTitle: ${sessionId} "${title}"`)
    await this.acpClient.initialize()
    await this.extMethod('code-assist/session/updateTitle', { sessionId, title })
  }

  async deleteSession(sessionId: string): Promise<void> {
    console.log(`${prefix} deleteSession: ${sessionId}`)
    await this.acpClient.initialize()
    await this.extMethod('code-assist/session/delete', { sessionId })
  }

  async getSessionMessages(sessionId: string): Promise<{ messages: { role: string; content: string }[]; model: string; provider: string; title: string }> {
    console.log(`${prefix} getSessionMessages: ${sessionId}`)
    await this.acpClient.initialize()
    return this.extMethod('code-assist/session/messages', { sessionId }) as any
  }

  async saveSession(data: { sessionId: string; title?: string; messages?: { role: string; content: string }[] }): Promise<void> {
    console.log(`${prefix} saveSession: ${data.sessionId}`)
    await this.acpClient.initialize()
    await this.extMethod('code-assist/session/save', data as any)
  }

  async summarizeSession(sessionId: string, baseURL: string, apiKey: string, model: string): Promise<string> {
    console.log(`${prefix} summarizeSession: ${sessionId}`)
    await this.acpClient.initialize()
    const result = await this.extMethod('code-assist/session/summarize', { sessionId, baseURL, apiKey, model })
    return ((result as any)?.title as string) ?? ''
  }

  // ---- Provider & Settings ----

  async listProviders(): Promise<unknown[]> {
    await this.acpClient.initialize()
    const result = await this.extMethod('code-assist/providers/list', {})
    return (result as any)?.providers ?? []
  }

  async saveProviders(providers: unknown[]): Promise<void> {
    console.log(`${prefix} saveProviders: ${providers.length}`)
    await this.acpClient.initialize()
    await this.extMethod('code-assist/providers/save', { providers })
  }

  async getSettings(keys: string[]): Promise<Record<string, unknown>> {
    await this.acpClient.initialize()
    return this.extMethod('code-assist/settings/get', { keys })
  }

  async setSettings(values: Record<string, unknown>): Promise<void> {
    await this.acpClient.initialize()
    await this.extMethod('code-assist/settings/set', values)
  }

  async listModels(baseURL: string, apiKey: string): Promise<any> {
    return this.extMethod('code-assist/models', { baseURL, apiKey })
  }

  async models(params: IProviderParams): Promise<any> {
    if (typeof (globalThis as any).acquireVsCodeApi === 'undefined') {
      return { object: 'list', data: [] }
    }
    await this.acpClient.initialize()
    return this.listModels(params.baseURL, params.apiKey)
  }

  onUpdate(callback: (chunk: { type: 'user_message_chunk' | 'agent_message_chunk' | 'tool_call' | 'tool_result'; text: string; toolCalls?: Array<{ name: string; arguments: string }>; toolName?: string; result?: string }) => void): () => void {
    return this.acpClient.onUpdate(callback)
  }

  onInfo(callback: (info: { title?: string }) => void): () => void {
    return this.acpClient.onInfo(callback)
  }

  // ---- Private ----

  private configKey(config: ProviderConfig): string {
    return `${config.baseURL}|${config.model}`
  }

  private async loadSessionId(key: string): Promise<string | null> {
    const result = await this.getSettings([SESSION_KEY_PREFIX + key])
    return (result[SESSION_KEY_PREFIX + key] as string) || null
  }

  private async saveSessionId(key: string, sessionId: string): Promise<void> {
    await this.setSettings({ [SESSION_KEY_PREFIX + key]: sessionId })
  }

  private mergeHistory(
    history: { type: 'user_message_chunk' | 'agent_message_chunk'; text: string }[],
  ): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = []
    let cur: { role: string; content: string } | null = null
    for (const chunk of history) {
      const role = chunk.type === 'user_message_chunk' ? 'user' : 'agent'
      if (cur && cur.role === role) {
        cur.content += chunk.text
      } else {
        if (cur) messages.push(cur)
        cur = { role, content: chunk.text }
      }
    }
    if (cur) messages.push(cur)
    return messages
  }

  private async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.acpClient.extMethod(method, params)
  }
}

export type { ProviderConfig } from './agent.types'
export const agentClient = new AgentClient()
