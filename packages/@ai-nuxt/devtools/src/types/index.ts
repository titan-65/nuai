export interface AIRequest {
  id: string
  provider: string
  model: string
  operation: string
  prompt: string
  response: string
  status: 'success' | 'error'
  timestamp: Date
  duration: number
  tokens?: number
  cost?: number
  options?: Record<string, any>
  error?: string
}

export interface Provider {
  id: string
  name: string
  active: boolean
  stats: {
    requests: number
    errors: number
    avgLatency: number
    cost: number
  }
  models: Array<{
    id: string
    name: string
    type: string
  }>
  config: {
    apiKey: string
    baseURL?: string
    organization?: string
  }
}

export interface CacheItem {
  key: string
  type: string
  value: any
  size: number
  created: Date
  expires: Date
  hits: number
  ttl: number
  metadata: Record<string, any>
}

export interface CacheStatistics {
  size: number
  hits: number
  misses: number
  hitRate: number
}

export interface Model {
  id: string
  name: string
  provider: string
  type: string
  active: boolean
  contextLength: number
  maxOutput: number
  pricing: {
    input: number
    output: number
  }
  capabilities: string[]
  stats: {
    requests: number
    avgLatency: number
    successRate: number
    totalCost: number
  }
}

export interface DevToolsSettings {
  devtools: {
    enabled: boolean
    autoRefresh: boolean
    theme: 'auto' | 'light' | 'dark'
  }
  monitoring: {
    enabled: boolean
    maxRequests: number
    includePrompts: boolean
    includeResponses: boolean
  }
  cache: {
    enabled: boolean
    defaultTTL: number
    maxSize: number
  }
  performance: {
    enableMetrics: boolean
    metricsRetention: number
    enableAlerts: boolean
    alertThreshold: number
  }
  debug: {
    enabled: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
}

export interface PlaygroundTemplate {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  config: {
    provider: string
    model: string
    temperature: number
    maxTokens: number
    topP: number
    frequencyPenalty: number
  }
}

export interface CompletionRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  temperature: number
  max_tokens: number
  top_p: number
  frequency_penalty: number
}

export interface CompletionResponse {
  content: string
  usage?: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
  cost?: number
}

export interface TestResult {
  success: boolean
  message: string
  details?: string
  responseTime?: number
  tokensUsed?: number
  cost?: number
  prompt?: string
  response?: string
  error?: string
}