import type { IProviderParams } from './acp-types'
import { chatRpcClient, type ProviderConfig } from './chat-rpc-client'

export type { ProviderConfig }

class ChatService {
  initSession(config: ProviderConfig): Promise<string> {
    return chatRpcClient.initSession(config)
  }

  getCurrentSessionId(): string | null {
    return chatRpcClient.getCurrentSessionId()
  }

  models(params: IProviderParams) {
    return chatRpcClient.models(params)
  }

  chatRaw(params: {
    baseURL: string
    apiKey: string
    model: string
    messages: { role: string; content: string }[]
  }) {
    return chatRpcClient.chatRaw(params)
  }

  sendPrompt(
    sessionId: string,
    text: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ) {
    return chatRpcClient.sendPrompt(sessionId, text, onChunk, signal)
  }

  stop(sessionId?: string) {
    return chatRpcClient.stopChat(sessionId)
  }

  loadAndReplayHistory(config: ProviderConfig) {
    return chatRpcClient.loadAndReplayHistory(config)
  }

  listSessions() {
    return chatRpcClient.listAllSessions()
  }

  updateSessionTitle(sessionId: string, title: string) {
    return chatRpcClient.updateSessionTitle(sessionId, title)
  }

  deleteSession(sessionId: string) {
    return chatRpcClient.deleteSession(sessionId)
  }

  getSessionMessages(sessionId: string) {
    return chatRpcClient.getSessionMessages(sessionId)
  }

  saveSession(data: {
    sessionId: string
    title?: string
    messages?: { role: string; content: string }[]
  }) {
    return chatRpcClient.saveSession(data)
  }

  summarizeSession(sessionId: string, baseURL: string, apiKey: string, model: string) {
    return chatRpcClient.summarizeSession(sessionId, baseURL, apiKey, model)
  }

  listProviders() {
    return chatRpcClient.listProviders()
  }

  saveProviders(providers: unknown[]) {
    return chatRpcClient.saveProviders(providers)
  }

  getSettings(keys: string[]) {
    return chatRpcClient.getSettings(keys)
  }

  setSettings(values: Record<string, unknown>) {
    return chatRpcClient.setSettings(values)
  }
}

export const chatService = new ChatService()
