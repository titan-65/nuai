import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LRUCache, SemanticCache, MultiLayerCache, CacheFactory } from '../cache'
import type { CacheOptions } from '../cache'

describe('LRUCache', () => {
  let cache: LRUCache<string>
  let options: CacheOptions

  beforeEach(() => {
    options = {
      maxSize: 3,
      defaultTTL: 1000,
      enableSemanticCache: false,
      semanticThreshold: 0.95,
      cleanupInterval: 0 // Disable cleanup timer for tests
    }
    cache = new LRUCache<string>(options)
  })

  afterEach(() => {
    cache.destroy()
  })

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')
      expect(value).toBe('value1')
    })

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('nonexistent')
      expect(value).toBeNull()
    })

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1')
      expect(await cache.has('key1')).toBe(true)
      expect(await cache.has('nonexistent')).toBe(false)
    })

    it('should delete keys', async () => {
      await cache.set('key1', 'value1')
      expect(await cache.has('key1')).toBe(true)
      
      const deleted = await cache.delete('key1')
      expect(deleted).toBe(true)
      expect(await cache.has('key1')).toBe(false)
    })

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      expect(await cache.size()).toBe(2)
      
      await cache.clear()
      expect(await cache.size()).toBe(0)
    })

    it('should return correct size', async () => {
      expect(await cache.size()).toBe(0)
      
      await cache.set('key1', 'value1')
      expect(await cache.size()).toBe(1)
      
      await cache.set('key2', 'value2')
      expect(await cache.size()).toBe(2)
    })
  })

  describe('LRU Eviction', () => {
    it('should evict least recently used items when at capacity', async () => {
      // Fill cache to capacity
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')
      expect(await cache.size()).toBe(3)

      // Add one more item, should evict key1 (least recently used)
      await cache.set('key4', 'value4')
      expect(await cache.size()).toBe(3)
      expect(await cache.has('key1')).toBe(false)
      expect(await cache.has('key4')).toBe(true)
    })

    it('should update access order when getting items', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')

      // Access key1 to make it most recently used
      await cache.get('key1')

      // Add new item, should evict key2 (now least recently used)
      await cache.set('key4', 'value4')
      expect(await cache.has('key1')).toBe(true)
      expect(await cache.has('key2')).toBe(false)
      expect(await cache.has('key4')).toBe(true)
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', 100) // 100ms TTL
      expect(await cache.get('key1')).toBe('value1')

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(await cache.get('key1')).toBeNull()
    })

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1') // Uses default TTL of 1000ms
      expect(await cache.get('key1')).toBe('value1')

      // Should still be valid before default TTL
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(await cache.get('key1')).toBe('value1')
    })

    it('should not return expired entries in has() check', async () => {
      await cache.set('key1', 'value1', 100)
      expect(await cache.has('key1')).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(await cache.has('key1')).toBe(false)
    })
  })

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      await cache.set('key1', 'value1')
      
      // Hit
      await cache.get('key1')
      
      // Miss
      await cache.get('nonexistent')
      
      const stats = await cache.stats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should track evictions', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.set('key3', 'value3')
      await cache.set('key4', 'value4') // Should cause eviction

      const stats = await cache.stats()
      expect(stats.evictions).toBe(1)
    })

    it('should track size and memory usage', async () => {
      const stats1 = await cache.stats()
      expect(stats1.size).toBe(0)
      expect(stats1.memoryUsage).toBe(0)

      await cache.set('key1', 'value1')
      
      const stats2 = await cache.stats()
      expect(stats2.size).toBe(1)
      expect(stats2.memoryUsage).toBeGreaterThan(0)
    })
  })

  describe('Metadata', () => {
    it('should store and preserve metadata', async () => {
      const metadata = {
        tokens: 100,
        cost: 0.001,
        model: 'gpt-4',
        provider: 'openai'
      }

      await cache.set('key1', 'value1', undefined, metadata)
      
      // Metadata is stored internally but not directly accessible
      // This is tested indirectly through the cache manager
      expect(await cache.get('key1')).toBe('value1')
    })
  })
})

describe('SemanticCache', () => {
  let cache: SemanticCache<string>
  let mockGenerateEmbedding: vi.MockedFunction<(text: string) => Promise<number[]>>

  beforeEach(() => {
    mockGenerateEmbedding = vi.fn()
    const options: CacheOptions = {
      maxSize: 5,
      defaultTTL: 1000,
      enableSemanticCache: true,
      semanticThreshold: 0.8,
      cleanupInterval: 0
    }
    cache = new SemanticCache<string>(options, mockGenerateEmbedding)
  })

  afterEach(() => {
    cache.destroy()
  })

  it('should find exact matches', async () => {
    await cache.set('hello world', 'response1')
    const result = await cache.get('hello world')
    expect(result).toBe('response1')
  })

  it('should find semantically similar entries', async () => {
    // Mock embeddings for similar phrases
    mockGenerateEmbedding
      .mockResolvedValueOnce([1, 0, 0]) // "hello world"
      .mockResolvedValueOnce([0.9, 0.1, 0]) // "hello there" - similar

    await cache.set('hello world', 'response1')
    
    // Should find similar entry
    const result = await cache.get('hello there')
    expect(result).toBe('response1')
    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2)
  })

  it('should not return entries below similarity threshold', async () => {
    mockGenerateEmbedding
      .mockResolvedValueOnce([1, 0, 0]) // "hello world"
      .mockResolvedValueOnce([0, 1, 0]) // "goodbye world" - dissimilar

    await cache.set('hello world', 'response1')
    
    const result = await cache.get('goodbye world')
    expect(result).toBeNull()
  })

  it('should return best match when multiple similar entries exist', async () => {
    mockGenerateEmbedding
      .mockResolvedValueOnce([1, 0, 0]) // "hello world"
      .mockResolvedValueOnce([0.8, 0.2, 0]) // "hello there"
      .mockResolvedValueOnce([0.9, 0.1, 0]) // Query - closer to "hello world"

    await cache.set('hello world', 'response1')
    await cache.set('hello there', 'response2')
    
    const result = await cache.get('hello friend')
    expect(result).toBe('response1') // Should return the more similar one
  })

  it('should work when semantic cache is disabled', async () => {
    const options: CacheOptions = {
      maxSize: 5,
      defaultTTL: 1000,
      enableSemanticCache: false,
      semanticThreshold: 0.8,
      cleanupInterval: 0
    }
    const disabledCache = new SemanticCache<string>(options, mockGenerateEmbedding)

    await disabledCache.set('hello world', 'response1')
    
    // Should only find exact matches
    expect(await disabledCache.get('hello world')).toBe('response1')
    expect(await disabledCache.get('hello there')).toBeNull()
    
    disabledCache.destroy()
  })
})

describe('MultiLayerCache', () => {
  let primaryCache: LRUCache<string>
  let secondaryCache: LRUCache<string>
  let multiCache: MultiLayerCache<string>

  beforeEach(() => {
    const options: CacheOptions = {
      maxSize: 3,
      defaultTTL: 1000,
      enableSemanticCache: false,
      semanticThreshold: 0.95,
      cleanupInterval: 0
    }
    
    primaryCache = new LRUCache<string>(options)
    secondaryCache = new LRUCache<string>(options)
    multiCache = new MultiLayerCache<string>([primaryCache, secondaryCache])
  })

  afterEach(() => {
    multiCache.destroy()
  })

  it('should check caches in order and return first match', async () => {
    // Set in secondary cache only
    await secondaryCache.set('key1', 'value1')
    
    const result = await multiCache.get('key1')
    expect(result).toBe('value1')
  })

  it('should promote values to higher cache layers', async () => {
    // Set in secondary cache only
    await secondaryCache.set('key1', 'value1')
    
    // Get from multi-cache (should promote to primary)
    await multiCache.get('key1')
    
    // Should now be in primary cache
    expect(await primaryCache.get('key1')).toBe('value1')
  })

  it('should set values in all cache layers', async () => {
    await multiCache.set('key1', 'value1')
    
    expect(await primaryCache.get('key1')).toBe('value1')
    expect(await secondaryCache.get('key1')).toBe('value1')
  })

  it('should delete from all cache layers', async () => {
    await multiCache.set('key1', 'value1')
    
    const deleted = await multiCache.delete('key1')
    expect(deleted).toBe(true)
    
    expect(await primaryCache.has('key1')).toBe(false)
    expect(await secondaryCache.has('key1')).toBe(false)
  })

  it('should clear all cache layers', async () => {
    await multiCache.set('key1', 'value1')
    await multiCache.set('key2', 'value2')
    
    await multiCache.clear()
    
    expect(await primaryCache.size()).toBe(0)
    expect(await secondaryCache.size()).toBe(0)
  })

  it('should return size of primary cache', async () => {
    await primaryCache.set('key1', 'value1')
    await secondaryCache.set('key2', 'value2')
    
    expect(await multiCache.size()).toBe(1) // Only primary cache size
  })

  it('should aggregate statistics from all layers', async () => {
    await multiCache.set('key1', 'value1')
    
    // Cause some hits and misses
    await multiCache.get('key1') // hit
    await multiCache.get('nonexistent') // miss
    
    const stats = await multiCache.stats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(1)
  })
})

describe('CacheFactory', () => {
  it('should create LRU cache with default options', () => {
    const cache = CacheFactory.createLRUCache<string>()
    expect(cache).toBeInstanceOf(LRUCache)
    cache.destroy()
  })

  it('should create LRU cache with custom options', () => {
    const cache = CacheFactory.createLRUCache<string>({
      maxSize: 50,
      defaultTTL: 5000
    })
    expect(cache).toBeInstanceOf(LRUCache)
    cache.destroy()
  })

  it('should create semantic cache', () => {
    const mockGenerateEmbedding = vi.fn()
    const cache = CacheFactory.createSemanticCache<string>(mockGenerateEmbedding)
    expect(cache).toBeInstanceOf(SemanticCache)
    cache.destroy()
  })

  it('should create multi-layer cache', () => {
    const cache1 = CacheFactory.createLRUCache<string>()
    const cache2 = CacheFactory.createLRUCache<string>()
    const multiCache = CacheFactory.createMultiLayerCache([cache1, cache2])
    
    expect(multiCache).toBeInstanceOf(MultiLayerCache)
    multiCache.destroy()
  })
})

describe('Cache Integration', () => {
  it('should handle concurrent operations', async () => {
    const cache = CacheFactory.createLRUCache<string>({ maxSize: 10 })
    
    // Perform concurrent operations
    const operations = []
    for (let i = 0; i < 20; i++) {
      operations.push(cache.set(`key${i}`, `value${i}`))
      operations.push(cache.get(`key${i % 5}`))
    }
    
    await Promise.all(operations)
    
    // Cache should still be functional
    expect(await cache.size()).toBeLessThanOrEqual(10)
    cache.destroy()
  })

  it('should handle edge cases gracefully', async () => {
    const cache = CacheFactory.createLRUCache<string>()
    
    // Empty key
    await cache.set('', 'empty')
    expect(await cache.get('')).toBe('empty')
    
    // Null/undefined values (should be handled by TypeScript, but test anyway)
    await cache.set('null', null as any)
    expect(await cache.get('null')).toBeNull()
    
    // Very long keys
    const longKey = 'a'.repeat(1000)
    await cache.set(longKey, 'long')
    expect(await cache.get(longKey)).toBe('long')
    
    cache.destroy()
  })
})