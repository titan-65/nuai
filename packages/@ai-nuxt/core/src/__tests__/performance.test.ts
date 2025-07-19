import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BundleAnalyzer, dynamicImportManager } from '../performance/bundle-analyzer'
import { DynamicImportManager } from '../performance/dynamic-imports'

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  getEntriesByType: vi.fn(() => []),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000
  }
}

// Mock PerformanceObserver
class MockPerformanceObserver {
  callback: (list: any) => void
  
  constructor(callback: (list: any) => void) {
    this.callback = callback
  }
  
  observe() {}
  disconnect() {}
}

global.PerformanceObserver = MockPerformanceObserver as any
global.performance = mockPerformance as any

describe('BundleAnalyzer', () => {
  let analyzer: BundleAnalyzer

  beforeEach(() => {
    analyzer = new BundleAnalyzer()
    vi.clearAllMocks()
  })

  afterEach(() => {
    analyzer.destroy()
  })

  describe('analyzeBundleSize', () => {
    it('should analyze bundle composition', async () => {
      mockPerformance.getEntriesByType.mockReturnValue([
        {
          name: 'https://example.com/chunk-ai-nuxt.js',
          transferSize: 50000,
          encodedBodySize: 25000
        },
        {
          name: 'https://example.com/chunk-providers.js',
          transferSize: 30000,
          encodedBodySize: 15000
        }
      ])

      const stats = await analyzer.analyzeBundleSize()

      expect(stats).toBeDefined()
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.gzippedSize).toBeGreaterThan(0)
      expect(stats.chunks).toHaveLength(2)
      expect(stats.providers).toBeDefined()
      expect(stats.features).toBeDefined()
    })

    it('should track provider statistics', async () => {
      // Mock global AI Nuxt state
      global.window = {
        __AI_NUXT__: {
          providers: {
            openai: true,
            anthropic: false
          },
          usage: {
            openai: 5,
            anthropic: 0
          }
        }
      } as any

      const stats = await analyzer.analyzeBundleSize()
      const openaiProvider = stats.providers.find(p => p.name === 'openai')
      const anthropicProvider = stats.providers.find(p => p.name === 'anthropic')

      expect(openaiProvider?.loaded).toBe(true)
      expect(openaiProvider?.usage).toBe(5)
      expect(anthropicProvider?.loaded).toBe(false)
      expect(anthropicProvider?.usage).toBe(0)
    })

    it('should generate optimization recommendations', async () => {
      // Setup scenario with unused providers
      global.window = {
        __AI_NUXT__: {
          providers: {
            openai: true,
            anthropic: true,
            ollama: true
          },
          usage: {
            openai: 10,
            anthropic: 0,
            ollama: 0
          }
        }
      } as any

      await analyzer.analyzeBundleSize()
      const recommendations = analyzer.generateRecommendations()

      expect(recommendations).toContain(
        expect.stringContaining('unused providers')
      )
    })
  })

  describe('trackMemoryUsage', () => {
    it('should track memory usage', () => {
      const usage = analyzer.trackMemoryUsage()
      
      expect(usage).toBe(0.5) // 1MB / 2MB = 0.5
      expect(mockPerformance.memory).toBeDefined()
    })

    it('should return 0 when memory API is not available', () => {
      const originalMemory = mockPerformance.memory
      delete (mockPerformance as any).memory

      const usage = analyzer.trackMemoryUsage()
      
      expect(usage).toBe(0)
      
      mockPerformance.memory = originalMemory
    })
  })

  describe('generateRecommendations', () => {
    it('should recommend removing unused providers', async () => {
      // Mock stats with unused providers
      await analyzer.analyzeBundleSize()
      
      // Manually set stats for testing
      ;(analyzer as any).stats = {
        providers: [
          { name: 'openai', loaded: true, usage: 0, size: 50000 },
          { name: 'anthropic', loaded: true, usage: 5, size: 40000 }
        ],
        chunks: [],
        features: [],
        totalSize: 90000,
        gzippedSize: 45000
      }

      const recommendations = analyzer.generateRecommendations()
      
      expect(recommendations).toContain(
        expect.stringContaining('unused providers: openai')
      )
    })

    it('should recommend code splitting for large chunks', async () => {
      await analyzer.analyzeBundleSize()
      
      // Mock large chunks
      ;(analyzer as any).stats = {
        providers: [],
        chunks: [
          { name: 'large-chunk.js', size: 150000, gzippedSize: 75000 }
        ],
        features: [],
        totalSize: 150000,
        gzippedSize: 75000
      }

      const recommendations = analyzer.generateRecommendations()
      
      expect(recommendations).toContain(
        expect.stringContaining('Large chunks detected')
      )
    })

    it('should warn about high memory usage', async () => {
      await analyzer.analyzeBundleSize()
      
      // Mock high memory usage
      analyzer.updateMetrics({ memoryUsage: 0.9 })

      const recommendations = analyzer.generateRecommendations()
      
      expect(recommendations).toContain(
        expect.stringContaining('High memory usage detected')
      )
    })
  })
})

describe('DynamicImportManager', () => {
  let manager: DynamicImportManager

  beforeEach(() => {
    manager = new DynamicImportManager()
    vi.clearAllMocks()
  })

  describe('loadProvider', () => {
    it('should load provider dynamically', async () => {
      // Mock dynamic import
      const mockModule = { OpenAIProvider: class {} }
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockModule)

      const result = await manager.loadProvider('openai')

      expect(result.module).toBeDefined()
      expect(result.loadTime).toBeGreaterThan(0)
    })

    it('should cache loaded providers', async () => {
      const mockModule = { OpenAIProvider: class {} }
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockModule)

      const result1 = await manager.loadProvider('openai')
      const result2 = await manager.loadProvider('openai')

      expect(result1).toBe(result2)
      expect(manager.isLoaded('provider:openai')).toBe(true)
    })

    it('should handle load failures with retries', async () => {
      let attempts = 0
      vi.doMock('@ai-nuxt/core/providers/unknown', () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Load failed')
        }
        return { UnknownProvider: class {} }
      })

      const result = await manager.loadProvider('unknown', { retries: 3 })
      
      expect(result.module).toBeDefined()
      expect(attempts).toBe(3)
    })

    it('should use fallback on repeated failures', async () => {
      const fallback = () => ({ FallbackProvider: class {} })
      
      vi.doMock('@ai-nuxt/core/providers/failing', () => {
        throw new Error('Always fails')
      })

      const result = await manager.loadProvider('failing', { 
        retries: 1, 
        fallback 
      })
      
      expect(result.FallbackProvider).toBeDefined()
    })
  })

  describe('loadComponent', () => {
    it('should load component dynamically', async () => {
      const mockComponent = { default: {} }
      vi.doMock('@ai-nuxt/module/runtime/components/AIChat.vue', () => mockComponent)

      const result = await manager.loadComponent('AIChat')

      expect(result.module).toBeDefined()
      expect(result.loadTime).toBeGreaterThan(0)
    })
  })

  describe('loadFeature', () => {
    it('should load feature module dynamically', async () => {
      const mockFeature = { CacheManager: class {} }
      vi.doMock('@ai-nuxt/core/cache', () => mockFeature)

      const result = await manager.loadFeature('cache')

      expect(result.module).toBeDefined()
      expect(result.loadTime).toBeGreaterThan(0)
    })
  })

  describe('preloadModules', () => {
    it('should preload multiple modules', async () => {
      const mockProvider = { OpenAIProvider: class {} }
      const mockComponent = { default: {} }
      
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockProvider)
      vi.doMock('@ai-nuxt/module/runtime/components/AIChat.vue', () => mockComponent)

      await manager.preloadModules(['provider:openai', 'component:AIChat'])

      expect(manager.isLoaded('provider:openai')).toBe(true)
      expect(manager.isLoaded('component:AIChat')).toBe(true)
    })

    it('should handle preload failures gracefully', async () => {
      vi.doMock('@ai-nuxt/core/providers/failing', () => {
        throw new Error('Preload failed')
      })

      // Should not throw
      await expect(
        manager.preloadModules(['provider:failing'])
      ).resolves.toBeUndefined()
    })
  })

  describe('cache management', () => {
    it('should track loading statistics', async () => {
      const mockModule = { TestProvider: class {} }
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockModule)

      await manager.loadProvider('openai')
      const stats = manager.getLoadingStats()

      expect(stats['provider:openai']).toBeGreaterThan(0)
    })

    it('should clear cache', async () => {
      const mockModule = { TestProvider: class {} }
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockModule)

      await manager.loadProvider('openai')
      expect(manager.isLoaded('provider:openai')).toBe(true)

      manager.clearCache('provider:openai')
      expect(manager.isLoaded('provider:openai')).toBe(false)
    })

    it('should clear all cache', async () => {
      const mockModule = { TestProvider: class {} }
      vi.doMock('@ai-nuxt/core/providers/openai', () => mockModule)

      await manager.loadProvider('openai')
      expect(manager.getCacheSize()).toBe(1)

      manager.clearCache()
      expect(manager.getCacheSize()).toBe(0)
    })
  })
})