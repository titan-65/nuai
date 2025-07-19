/**
 * AI Cache Manager
 * Manages caching for AI responses with intelligent cache key generation
 */

import { Cache, CacheFactory, CacheOptions, CacheStats } from './cache'
import { ChatOptions, CompletionOptions, EmbeddingOptions } from './types'
import { SemanticSimilarityCalculator, SemanticSimilarityFactory } from './semantic-similarity'

export interface CacheConfig {
  enabled: boolean
  layers: {
    memory: {
      enabled: boolean
      maxSize: number
      ttl: number
    }
    semantic: {
      enabled: boolean
      threshold: number
      maxSize: number
      ttl: number
    }
  }
  keyGeneration: {
    includeModel: boolean
    includeProvider: boolean
    includeTemperature: boolean
    includeMaxTokens: boolean
    normalizeWhitespace: boolean
  }
}

export interface CachedResponse<T = any> {
  response: T
  metadata: {
    provider: string
    model: string
    timestamp: number
    tokens?: number
    cost?: number
    cacheHit: boolean
    cacheLayer?: string
  }
}

export interface CacheKeyComponents {
  prompt: string
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  options?: Record<string, any>
}

/**
 * AI Response Cache Manager
 */
export class AICacheManager {
  private cache: Cache<CachedResponse>
  private config: CacheConfig
  private generateEmbedding?: (text: string) => Promise<number[]>

  constructor(
    config: CacheConfig,
    generateEmbedding?: (text: string) => Promise<number[]>
  ) {
    this.config = config
    this.generateEmbedding = generateEmbedding
    this.cache = this.createCache()
  }

  /**
   * Get cached response for chat completion
   */
  async getChatResponse(options: ChatOptions): Promise<CachedResponse | null> {
    if (!this.config.enabled) return null

    const cacheKey = this.generateChatCacheKey(options)
    const cached = await this.cache.get(cacheKey)
    
    if (cached) {
      // Update cache hit metadata
      cached.metadata.cacheHit = true
      cached.metadata.timestamp = Date.now()
    }

    return cached
  }

  /**
   * Cache chat completion response
   */
  async setChatResponse(
    options: ChatOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> {
    if (!this.config.enabled) return

    const cacheKey = this.generateChatCacheKey(options)
    const cachedResponse: CachedResponse = {
      response,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        cacheHit: false
      }
    }

    const ttl = this.config.layers.memory.enabled 
      ? this.config.layers.memory.ttl 
      : this.config.layers.semantic.ttl

    await this.cache.set(cacheKey, cachedResponse, ttl, {
      tokens: metadata.tokens,
      cost: metadata.cost,
      model: metadata.model,
      provider: metadata.provider
    })
  }

  /**
   * Get cached response for text completion
   */
  async getCompletionResponse(options: CompletionOptions): Promise<CachedResponse | null> {
    if (!this.config.enabled) return null

    const cacheKey = this.generateCompletionCacheKey(options)
    const cached = await this.cache.get(cacheKey)
    
    if (cached) {
      cached.metadata.cacheHit = true
      cached.metadata.timestamp = Date.now()
    }

    return cached
  }

  /**
   * Cache text completion response
   */
  async setCompletionResponse(
    options: CompletionOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> {
    if (!this.config.enabled) return

    const cacheKey = this.generateCompletionCacheKey(options)
    const cachedResponse: CachedResponse = {
      response,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        cacheHit: false
      }
    }

    const ttl = this.config.layers.memory.enabled 
      ? this.config.layers.memory.ttl 
      : this.config.layers.semantic.ttl

    await this.cache.set(cacheKey, cachedResponse, ttl, {
      tokens: metadata.tokens,
      cost: metadata.cost,
      model: metadata.model,
      provider: metadata.provider
    })
  }

  /**
   * Get cached response for embeddings
   */
  async getEmbeddingResponse(options: EmbeddingOptions): Promise<CachedResponse | null> {
    if (!this.config.enabled) return null

    const cacheKey = this.generateEmbeddingCacheKey(options)
    return await this.cache.get(cacheKey)
  }

  /**
   * Cache embedding response
   */
  async setEmbeddingResponse(
    options: EmbeddingOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> {
    if (!this.config.enabled) return

    const cacheKey = this.generateEmbeddingCacheKey(options)
    const cachedResponse: CachedResponse = {
      response,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        cacheHit: false
      }
    }

    // Embeddings typically have longer TTL since they're more stable
    const ttl = (this.config.layers.memory.ttl || this.config.layers.semantic.ttl) * 2

    await this.cache.set(cacheKey, cachedResponse, ttl, {
      tokens: metadata.tokens,
      cost: metadata.cost,
      model: metadata.model,
      provider: metadata.provider
    })
  }

  /**
   * Clear all cached responses
   */
  async clear(): Promise<void> {
    await this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    return await this.cache.stats()
  }

  /**
   * Check if a response is cached
   */
  async has(key: string): Promise<boolean> {
    return await this.cache.has(key)
  }

  /**
   * Delete a specific cached response
   */
  async delete(key: string): Promise<boolean> {
    return await this.cache.delete(key)
  }

  /**
   * Get cache size
   */
  async size(): Promise<number> {
    return await this.cache.size()
  }

  /**
   * Generate cache key for chat completion
   */
  private generateChatCacheKey(options: ChatOptions): string {
    const components: CacheKeyComponents = {
      prompt: this.serializeMessages(options.messages || []),
      provider: this.config.keyGeneration.includeProvider ? options.provider : undefined,
      model: this.config.keyGeneration.includeModel ? options.model : undefined,
      temperature: this.config.keyGeneration.includeTemperature ? options.temperature : undefined,
      maxTokens: this.config.keyGeneration.includeMaxTokens ? options.maxTokens : undefined,
      systemPrompt: options.systemPrompt,
      options: {
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stop: options.stop
      }
    }

    return this.generateCacheKey(components)
  }

  /**
   * Generate cache key for text completion
   */
  private generateCompletionCacheKey(options: CompletionOptions): string {
    const components: CacheKeyComponents = {
      prompt: this.normalizeText(options.prompt || ''),
      provider: this.config.keyGeneration.includeProvider ? options.provider : undefined,
      model: this.config.keyGeneration.includeModel ? options.model : undefined,
      temperature: this.config.keyGeneration.includeTemperature ? options.temperature : undefined,
      maxTokens: this.config.keyGeneration.includeMaxTokens ? options.maxTokens : undefined,
      options: {
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stop: options.stop
      }
    }

    return this.generateCacheKey(components)
  }

  /**
   * Generate cache key for embeddings
   */
  private generateEmbeddingCacheKey(options: EmbeddingOptions): string {
    const components: CacheKeyComponents = {
      prompt: Array.isArray(options.input) 
        ? options.input.map(text => this.normalizeText(text)).join('|')
        : this.normalizeText(options.input || ''),
      provider: this.config.keyGeneration.includeProvider ? options.provider : undefined,
      model: this.config.keyGeneration.includeModel ? options.model : undefined
    }

    return this.generateCacheKey(components)
  }

  /**
   * Generate cache key from components
   */
  private generateCacheKey(components: CacheKeyComponents): string {
    const keyParts: string[] = []

    // Add prompt (most important part)
    keyParts.push(components.prompt)

    // Add optional components
    if (components.provider) keyParts.push(`provider:${components.provider}`)
    if (components.model) keyParts.push(`model:${components.model}`)
    if (components.temperature !== undefined) keyParts.push(`temp:${components.temperature}`)
    if (components.maxTokens !== undefined) keyParts.push(`tokens:${components.maxTokens}`)
    if (components.systemPrompt) keyParts.push(`system:${this.normalizeText(components.systemPrompt)}`)
    
    // Add other options
    if (components.options) {
      const optionsStr = Object.entries(components.options)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}:${value}`)
        .sort()
        .join(',')
      if (optionsStr) keyParts.push(`opts:${optionsStr}`)
    }

    return keyParts.join('|')
  }

  /**
   * Serialize messages array to string
   */
  private serializeMessages(messages: any[]): string {
    return messages
      .map(msg => `${msg.role}:${this.normalizeText(msg.content)}`)
      .join('|')
  }

  /**
   * Normalize text for consistent cache keys
   */
  private normalizeText(text: string): string {
    if (!this.config.keyGeneration.normalizeWhitespace) {
      return text
    }

    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase() // Case insensitive
  }

  /**
   * Create cache instance based on configuration
   */
  private createCache(): Cache<CachedResponse> {
    const caches: Cache<CachedResponse>[] = []

    // Add memory cache layer
    if (this.config.layers.memory.enabled) {
      const memoryCache = CacheFactory.createLRUCache<CachedResponse>({
        maxSize: this.config.layers.memory.maxSize,
        defaultTTL: this.config.layers.memory.ttl,
        enableSemanticCache: false,
        cleanupInterval: 300000 // 5 minutes
      })
      caches.push(memoryCache)
    }

    // Add semantic cache layer
    if (this.config.layers.semantic.enabled && this.generateEmbedding) {
      const semanticCache = CacheFactory.createSemanticCache<CachedResponse>(
        this.generateEmbedding,
        {
          maxSize: this.config.layers.semantic.maxSize,
          defaultTTL: this.config.layers.semantic.ttl,
          enableSemanticCache: true,
          semanticThreshold: this.config.layers.semantic.threshold,
          cleanupInterval: 600000 // 10 minutes
        }
      )
      caches.push(semanticCache)
    }

    // If no caches configured, create a simple memory cache
    if (caches.length === 0) {
      caches.push(CacheFactory.createLRUCache<CachedResponse>())
    }

    // Return single cache or multi-layer cache
    return caches.length === 1 
      ? caches[0] 
      : CacheFactory.createMultiLayerCache(caches)
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Recreate cache with new configuration
    if ('destroy' in this.cache && typeof this.cache.destroy === 'function') {
      this.cache.destroy()
    }
    this.cache = this.createCache()
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if ('destroy' in this.cache && typeof this.cache.destroy === 'function') {
      this.cache.destroy()
    }
  }
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  layers: {
    memory: {
      enabled: true,
      maxSize: 100,
      ttl: 3600000 // 1 hour
    },
    semantic: {
      enabled: false,
      threshold: 0.95,
      maxSize: 50,
      ttl: 7200000 // 2 hours
    }
  },
  keyGeneration: {
    includeModel: true,
    includeProvider: true,
    includeTemperature: true,
    includeMaxTokens: false,
    normalizeWhitespace: true
  }
}