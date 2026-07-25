export interface IProviderParams {
  baseURL: string
  apiKey: string
}

export interface ProviderData {
  id: string
  baseURL: string
  apiKey: string
  enabled: boolean
  models: { id: string; hash: string }[]
}

export interface ProviderConfig {
  baseURL: string
  apiKey: string
  model: string
  provider: string
}
