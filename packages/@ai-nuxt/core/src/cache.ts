/**
 * Multi-layer caching system for AI responses
 * Implements LRU memory cache and semantic similarity caching
 */

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  metadata?: {
    tokens?: number
    cost?: number
    model?: string
    provider?: string
    embedding?: number[]
  }
}

export interface CacheOptions {
  maxSize: number
  defaultTTL: number
  enableSemanticCache: boolean
  semanticThreshold: number
  cleanupInterval: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
  hitRate: number
  memoryUsage: number
}

export interface Cache<T = any> {
  get(key: string): Promise<T | null>
  set(key: string, value: T, ttl?: number, metadata?: CacheEntry['metadata']): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  size(): Promise<number>
  stats(): Promise<CacheStats>
}

/**
 * LRU (Least Recently Used) Memory Cache Implementation
 */
export class LRUCache<T = any> implements Cache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private accessOrder: string[] = []
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    memoryUsage: 0
  }
  private cleanupTimer?: NodeJS.Timeout

  constructor(private options: CacheOptions) {
    this.startCleanupTimer()
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Update access information
    entry.accessCount++
    entry.lastAccessed = Date.now()
    
    // Move to end of access order (most recently used)
    this.moveToEnd(key)
    
    this.stats.hits++
    this.updateHitRate()
    
    return entry.value
  }

  async set(key: string, value: T, ttl?: number, metadata?: CacheEntry['metadata']): Promise<void> {
    const now = Date.now()
    const entryTTL = ttl || this.options.defaultTTL

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 1,
      lastAccessed: now,
      metadata
    }

    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, entry)
      this.moveToEnd(key)
      return
    }

    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize) {
      await this.evictLRU()
    }

    this.cache.set(key, entry)
    this.accessOrder.push(key)
    this.stats.size = this.cache.size
    this.updateMemoryUsage()
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    return entry !== undefined && !this.isExpired(entry)
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.removeFromAccessOrder(key)
      this.stats.size = this.cache.size
      this.updateMemoryUsage()
    }
    return deleted
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.accessOrder = []
    this.stats.size = 0
    this.stats.evictions = 0
    this.updateMemoryUsage()
  }

  async size(): Promise<number> {
    return this.cache.size
  }

  async stats(): Promise<CacheStats> {
    return { ...this.stats }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private moveToEnd(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  private async evictLRU(): Promise<void> {
    // Remove expired entries first
    await this.cleanupExpired()
    
    // If still at capacity, remove least recently used
    if (this.cache.size >= this.options.maxSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0]
      this.cache.delete(lruKey)
      this.accessOrder.shift()
      this.stats.evictions++
      this.stats.size = this.cache.size
    }
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    }

    this.stats.size = this.cache.size
    this.updateMemoryUsage()
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  private updateMemoryUsage(): void {
    // Rough estimation of memory usage
    let usage = 0
    for (const entry of this.cache.values()) {
      usage += JSON.stringify(entry).length * 2 // Rough byte estimation
    }
    this.stats.memoryUsage = usage
  }

  private startCleanupTimer(): void {
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired()
      }, this.options.cleanupInterval)
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
  }
}

/**
 * Semantic Cache Implementation
 * Uses embedding similarity to find cached responses for similar prompts
 */
export class SemanticCache<T = any> implements Cache<T> {
  private embeddings = new Map<string, number[]>()
  private lruCache: LRUCache<T>

  constructor(
    private options: CacheOptions,
    private generateEmbedding: (text: string) => Promise<number[]>
  ) {
    this.lruCache = new LRUCache<T>(options)
  }

  async get(key: string): Promise<T | null> {
    // First try exact key match
    const exactMatch = await this.lruCache.get(key)
    if (exactMatch !== null) {
      return exactMatch
    }

    // If semantic cache is disabled, return null
    if (!this.options.enableSemanticCache) {
      return null
    }

    // Try semantic similarity search
    const queryEmbedding = await this.generateEmbedding(key)
    const similarKey = await this.findSimilarKey(queryEmbedding)
    
    if (similarKey) {
      return await this.lruCache.get(similarKey)
    }

    return null
  }

  async set(key: string, value: T, ttl?: number, metadata?: CacheEntry['metadata']): Promise<void> {
    // Store in LRU cache
    await this.lruCache.set(key, value, ttl, metadata)

    // Generate and store embedding for semantic search
    if (this.options.enableSemanticCache) {
      try {
        const embedding = await this.generateEmbedding(key)
        this.embeddings.set(key, embedding)
      } catch (error) {
        console.warn('Failed to generate embedding for cache key:', error)
      }
    }
  }

  async has(key: string): Promise<boolean> {
    // Check exact match first
    if (await this.lruCache.has(key)) {
      return true
    }

    // Check semantic similarity if enabled
    if (this.options.enableSemanticCache) {
      const queryEmbedding = await this.generateEmbedding(key)
      const similarKey = await this.findSimilarKey(queryEmbedding)
      return similarKey !== null
    }

    return false
  }

  async delete(key: string): Promise<boolean> {
    this.embeddings.delete(key)
    return await this.lruCache.delete(key)
  }

  async clear(): Promise<void> {
    this.embeddings.clear()
    await this.lruCache.clear()
  }

  async size(): Promise<number> {
    return await this.lruCache.size()
  }

  async stats(): Promise<CacheStats> {
    return await this.lruCache.stats()
  }

  private async findSimilarKey(queryEmbedding: number[]): Promise<string | null> {
    let bestMatch: string | null = null
    let bestSimilarity = 0

    for (const [key, embedding] of this.embeddings.entries()) {
      // Check if the cached entry still exists and is valid
      if (!(await this.lruCache.has(key))) {
        this.embeddings.delete(key)
        continue
      }

      const similarity = this.cosineSimilarity(queryEmbedding, embedding)
      
      if (similarity > this.options.semanticThreshold && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = key
      }
    }

    return bestMatch
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  destroy(): void {
    this.embeddings.clear()
    this.lruCache.destroy()
  }
}

/**
 * Multi-layer Cache Manager
 * Combines multiple cache layers for optimal performance
 */
export class MultiLayerCache<T = any> implements Cache<T> {
  private caches: Cache<T>[] = []
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    memoryUsage: 0
  }

  constructor(caches: Cache<T>[]) {
    this.caches = caches
  }

  async get(key: string): Promise<T | null> {
    // Try each cache layer in order
    for (let i = 0; i < this.caches.length; i++) {
      const cache = this.caches[i]
      const value = await cache.get(key)
      
      if (value !== null) {
        // Cache hit - promote to higher layers
        await this.promoteToHigherLayers(key, value, i)
        this.stats.hits++
        this.updateHitRate()
        return value
      }
    }

    this.stats.misses++
    this.updateHitRate()
    return null
  }

  async set(key: string, value: T, ttl?: number, metadata?: CacheEntry['metadata']): Promise<void> {
    // Set in all cache layers
    await Promise.all(
      this.caches.map(cache => cache.set(key, value, ttl, metadata))
    )
    await this.updateStats()
  }

  async has(key: string): Promise<boolean> {
    // Check if any cache layer has the key
    for (const cache of this.caches) {
      if (await cache.has(key)) {
        return true
      }
    }
    return false
  }

  async delete(key: string): Promise<boolean> {
    // Delete from all cache layers
    const results = await Promise.all(
      this.caches.map(cache => cache.delete(key))
    )
    
    await this.updateStats()
    return results.some(result => result)
  }

  async clear(): Promise<void> {
    await Promise.all(this.caches.map(cache => cache.clear()))
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      hitRate: 0,
      memoryUsage: 0
    }
  }

  async size(): Promise<number> {
    // Return size of the first (primary) cache
    return this.caches.length > 0 ? await this.caches[0].size() : 0
  }

  async stats(): Promise<CacheStats> {
    await this.updateStats()
    return { ...this.stats }
  }

  private async promoteToHigherLayers(key: string, value: T, foundAtLayer: number): Promise<void> {
    // Promote the value to all higher-priority cache layers
    for (let i = 0; i < foundAtLayer; i++) {
      await this.caches[i].set(key, value)
    }
  }

  private async updateStats(): Promise<void> {
    if (this.caches.length === 0) return

    // Aggregate stats from all cache layers
    const allStats = await Promise.all(
      this.caches.map(cache => cache.stats())
    )

    // Use stats from primary cache and add our own hit/miss tracking
    const primaryStats = allStats[0]
    this.stats.size = primaryStats.size
    this.stats.evictions = allStats.reduce((sum, stats) => sum + stats.evictions, 0)
    this.stats.memoryUsage = allStats.reduce((sum, stats) => sum + stats.memoryUsage, 0)
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  destroy(): void {
    this.caches.forEach(cache => {
      if ('destroy' in cache && typeof cache.destroy === 'function') {
        cache.destroy()
      }
    })
  }
}

/**
 * Cache Factory for creating configured cache instances
 */
export class CacheFactory {
  static createLRUCache<T = any>(options: Partial<CacheOptions> = {}): LRUCache<T> {
    const defaultOptions: CacheOptions = {
      maxSize: 100,
      defaultTTL: 3600000, // 1 hour
      enableSemanticCache: false,
      semanticThreshold: 0.95,
      cleanupInterval: 300000 // 5 minutes
    }

    return new LRUCache<T>({ ...defaultOptions, ...options })
  }

  static createSemanticCache<T = any>(
    generateEmbedding: (text: string) => Promise<number[]>,
    options: Partial<CacheOptions> = {}
  ): SemanticCache<T> {
    const defaultOptions: CacheOptions = {
      maxSize: 100,
      defaultTTL: 3600000, // 1 hour
      enableSemanticCache: true,
      semanticThreshold: 0.95,
      cleanupInterval: 300000 // 5 minutes
    }

    return new SemanticCache<T>({ ...defaultOptions, ...options }, generateEmbedding)
  }

  static createMultiLayerCache<T = any>(
    caches: Cache<T>[]
  ): MultiLayerCache<T> {
    return new MultiLayerCache<T>(caches)
  }
}

// Default cache configuration
export const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  maxSize: 100,
  defaultTTL: 3600000, // 1 hour
  enableSemanticCache: false,
  semanticThreshold: 0.95,
  cleanupInterval: 300000 // 5 minutes
}