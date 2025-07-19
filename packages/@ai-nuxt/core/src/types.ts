// Core type definitions for AI Nuxt framework

export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    tokens?: number
    model?: string
    provider?: string
    cost?: number
  }
}

export interface ChatOptions {
  messages: Message[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  systemPrompt?: string
}

export interface ChatResponse {
  message: Message
  usage: TokenUsage
  model: string
  provider: string
}

export interface ChatChunk {
  content: string
  delta: string
  finished: boolean
}

export interface CompletionOptions {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface CompletionResponse {
  text: string
  usage: TokenUsage
  model: string
  provider: string
}

export interface CompletionChunk {
  text: string
  delta: string
  finished: boolean
}

export interface EmbeddingOptions {
  input: string | string[]
  model?: string
}

export interface EmbeddingResponse {
  embeddings: number[][]
  usage: TokenUsage
  model: string
  provider: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ProviderConfig {
  id: string
  name: string
  apiKey?: string
  baseURL?: string
  models?: string[]
  defaultModel?: string
  options?: Record<string, any>
}

export interface AIProvider {
  readonly id: string
  readonly name: string
  readonly models: string[]
  readonly defaultModel: string
  
  initialize(config: ProviderConfig): Promise<void>
  
  readonly chat: ChatInterface
  readonly completion: CompletionInterface
  readonly embedding: EmbeddingInterface
  readonly vision?: VisionInterface
  readonly audio?: AudioInterface
}

export interface ChatInterface {
  create(options: ChatOptions): Promise<ChatResponse>
  stream(options: ChatOptions): AsyncIterator<ChatChunk>
}

export interface CompletionInterface {
  create(options: CompletionOptions): Promise<CompletionResponse>
  stream(options: CompletionOptions): AsyncIterator<CompletionChunk>
}

export interface EmbeddingInterface {
  create(options: EmbeddingOptions): Promise<EmbeddingResponse>
}

export interface VisionInterface {
  analyze(options: { image: string; prompt?: string }): Promise<ChatResponse>
}

export interface AudioInterface {
  transcribe(options: { audio: Blob; model?: string }): Promise<{ text: string }>
  synthesize(options: { text: string; voice?: string }): Promise<{ audio: Blob }>
}

export interface ModuleOptions {
  providers: ProviderConfig[]
  defaultProvider: string
  streaming: {
    enabled: boolean
    transport: 'sse' | 'websocket'
  }
  caching: {
    enabled: boolean
    semantic: boolean
    ttl: number
    maxSize: number
    semanticThreshold: number
  }
  vectorStore: {
    provider: 'memory' | 'pinecone' | 'weaviate'
    config: Record<string, any>
  }
  security: {
    promptInjectionDetection: boolean
    piiScrubbing: boolean
    contentFiltering: boolean
    rateLimit?: {
      enabled: boolean
      maxRequests: number
      windowMs: number
    }
  }
  debug: boolean
}