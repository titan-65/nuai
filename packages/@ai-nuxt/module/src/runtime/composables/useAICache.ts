import { ref, computed } from 'vue'
import { AICacheManager, DEFAULT_CACHE_CONFIG } from '@ai-nuxt/core'
import type { CacheConfig, CacheStats, CachedResponse } from '@ai-nuxt/core'
import type { ChatOptions, CompletionOptions, EmbeddingOptions } from '@ai-nuxt/core'

/**
 * AI Cache composable for managing AI response caching in Nuxt applications
 */
export const useAICache = () => {
  // Cache manager instance
  let cacheManager: AICacheManager | null = null
  
  // Reactive state
  const isEnabled = ref(true)
  const stats = ref<CacheStats>({
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
    memoryUsage: 0
  })

  // Configuration
  const config = ref<CacheConfig>({
    ...DEFAULT_CACHE_CONFIG,
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
    }
  })

  // Initialize cache manager
  const initializeCache = (
    cacheConfig?: Partial<CacheConfig>,
    generateEmbedding?: (text: string) => Promise<number[]>
  ) => {
    if (cacheManager) {
      cacheManager.destroy()
    }

    const finalConfig = { ...config.value, ...cacheConfig }
    config.value = finalConfig
    
    cacheManager = new AICacheManager(finalConfig, generateEmbedding)
    isEnabled.value = finalConfig.enabled
  }

  // Ensure cache manager is initialized
  const ensureCacheManager = () => {
    if (!cacheManager) {
      initializeCache()
    }
    return cacheManager!
  }

  // Chat caching methods
  const getCachedChatResponse = async (options: ChatOptions): Promise<CachedResponse | null> => {
    if (!isEnabled.value) return null
    
    const manager = ensureCacheManager()
    const result = await manager.getChatResponse(options)
    await updateStats()
    return result
  }

  const setCachedChatResponse = async (
    options: ChatOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> => {
    if (!isEnabled.value) return
    
    const manager = ensureCacheManager()
    await manager.setChatResponse(options, response, metadata)
    await updateStats()
  }

  // Completion caching methods
  const getCachedCompletionResponse = async (options: CompletionOptions): Promise<CachedResponse | null> => {
    if (!isEnabled.value) return null
    
    const manager = ensureCacheManager()
    const result = await manager.getCompletionResponse(options)
    await updateStats()
    return result
  }

  const setCachedCompletionResponse = async (
    options: CompletionOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> => {
    if (!isEnabled.value) return
    
    const manager = ensureCacheManager()
    await manager.setCompletionResponse(options, response, metadata)
    await updateStats()
  }

  // Embedding caching methods
  const getCachedEmbeddingResponse = async (options: EmbeddingOptions): Promise<CachedResponse | null> => {
    if (!isEnabled.value) return null
    
    const manager = ensureCacheManager()
    const result = await manager.getEmbeddingResponse(options)
    await updateStats()
    return result
  }

  const setCachedEmbeddingResponse = async (
    options: EmbeddingOptions,
    response: any,
    metadata: {
      provider: string
      model: string
      tokens?: number
      cost?: number
    }
  ): Promise<void> => {
    if (!isEnabled.value) return
    
    const manager = ensureCacheManager()
    await manager.setEmbeddingResponse(options, response, metadata)
    await updateStats()
  }

  // Cache management methods
  const clearCache = async (): Promise<void> => {
    if (!cacheManager) return
    
    await cacheManager.clear()
    await updateStats()
  }

  const getCacheSize = async (): Promise<number> => {
    if (!cacheManager) return 0
    
    return await cacheManager.size()
  }

  const deleteCacheEntry = async (key: string): Promise<boolean> => {
    if (!cacheManager) return false
    
    const result = await cacheManager.delete(key)
    await updateStats()
    return result
  }

  const hasCacheEntry = async (key: string): Promise<boolean> => {
    if (!cacheManager) return false
    
    return await cacheManager.has(key)
  }

  // Configuration methods
  const updateCacheConfig = (newConfig: Partial<CacheConfig>): void => {
    config.value = { ...config.value, ...newConfig }
    
    if (cacheManager) {
      cacheManager.updateConfig(newConfig)
    }
    
    isEnabled.value = config.value.enabled
  }

  const enableCache = (): void => {
    updateCacheConfig({ enabled: true })
  }

  const disableCache = (): void => {
    updateCacheConfig({ enabled: false })
  }

  const enableSemanticCache = (threshold: number = 0.95): void => {
    updateCacheConfig({
      layers: {
        ...config.value.layers,
        semantic: {
          ...config.value.layers.semantic,
          enabled: true,
          threshold
        }
      }
    })
  }

  const disableSemanticCache = (): void => {
    updateCacheConfig({
      layers: {
        ...config.value.layers,
        semantic: {
          ...config.value.layers.semantic,
          enabled: false
        }
      }
    })
  }

  const setCacheSize = (memorySize: number, semanticSize?: number): void => {
    updateCacheConfig({
      layers: {
        memory: {
          ...config.value.layers.memory,
          maxSize: memorySize
        },
        semantic: {
          ...config.value.layers.semantic,
          maxSize: semanticSize || config.value.layers.semantic.maxSize
        }
      }
    })
  }

  const setCacheTTL = (memoryTTL: number, semanticTTL?: number): void => {
    updateCacheConfig({
      layers: {
        memory: {
          ...config.value.layers.memory,
          ttl: memoryTTL
        },
        semantic: {
          ...config.value.layers.semantic,
          ttl: semanticTTL || config.value.layers.semantic.ttl
        }
      }
    })
  }

  // Statistics methods
  const updateStats = async (): Promise<void> => {
    if (!cacheManager) return
    
    const currentStats = await cacheManager.getStats()
    stats.value = currentStats
  }

  const getStats = async (): Promise<CacheStats> => {
    await updateStats()
    return stats.value
  }

  // Computed properties
  const hitRate = computed(() => stats.value.hitRate)
  const cacheSize = computed(() => stats.value.size)
  const memoryUsage = computed(() => stats.value.memoryUsage)
  const totalHits = computed(() => stats.value.hits)
  const totalMisses = computed(() => stats.value.misses)
  const totalEvictions = computed(() => stats.value.evictions)

  // Utility methods
  const getCacheEfficiency = computed(() => {
    const total = stats.value.hits + stats.value.misses
    if (total === 0) return 0
    
    return {
      hitRate: stats.value.hitRate,
      totalRequests: total,
      savedRequests: stats.value.hits,
      efficiency: stats.value.hits / total
    }
  })

  const getCacheHealth = computed(() => {
    const maxSize = config.value.layers.memory.maxSize
    const currentSize = stats.value.size
    const utilizationRate = maxSize > 0 ? currentSize / maxSize : 0
    
    return {
      utilizationRate,
      evictionRate: stats.value.evictions / Math.max(1, stats.value.hits + stats.value.misses),
      memoryPressure: utilizationRate > 0.8 ? 'high' : utilizationRate > 0.6 ? 'medium' : 'low',
      isHealthy: utilizationRate < 0.9 && stats.value.hitRate > 0.1
    }
  })

  // Cleanup
  const destroyCache = (): void => {
    if (cacheManager) {
      cacheManager.destroy()
      cacheManager = null
    }
  }

  // Initialize with default config
  if (process.client) {
    initializeCache()
  }

  return {
    // State
    isEnabled,
    config,
    stats,

    // Computed
    hitRate,
    cacheSize,
    memoryUsage,
    totalHits,
    totalMisses,
    totalEvictions,
    getCacheEfficiency,
    getCacheHealth,

    // Initialization
    initializeCache,

    // Chat caching
    getCachedChatResponse,
    setCachedChatResponse,

    // Completion caching
    getCachedCompletionResponse,
    setCachedCompletionResponse,

    // Embedding caching
    getCachedEmbeddingResponse,
    setCachedEmbeddingResponse,

    // Cache management
    clearCache,
    getCacheSize,
    deleteCacheEntry,
    hasCacheEntry,

    // Configuration
    updateCacheConfig,
    enableCache,
    disableCache,
    enableSemanticCache,
    disableSemanticCache,
    setCacheSize,
    setCacheTTL,

    // Statistics
    getStats,
    updateStats,

    // Cleanup
    destroyCache
  }
}

// Export types for convenience
export type { CacheConfig, CacheStats, CachedResponse } from '@ai-nuxt/core'