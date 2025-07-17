import type {
  ChatOptions,
  ChatResponse,
  ChatChunk,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
  EmbeddingOptions,
  EmbeddingResponse,
  ProviderConfig
} from '../types'

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

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly models: string[]
  abstract readonly defaultModel: string
  
  protected config?: ProviderConfig
  protected initialized = false
  
  abstract initialize(config: ProviderConfig): Promise<void>
  
  abstract readonly chat: ChatInterface
  abstract readonly completion: CompletionInterface
  abstract readonly embedding: EmbeddingInterface
  readonly vision?: VisionInterface
  readonly audio?: AudioInterface
  
  protected validateConfig(config: ProviderConfig): void {
    if (!config.apiKey && this.requiresApiKey()) {
      throw new Error(`API key is required for ${this.name} provider`)
    }
  }
  
  protected requiresApiKey(): boolean {
    return true
  }
  
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Provider ${this.name} is not initialized`)
    }
  }
}