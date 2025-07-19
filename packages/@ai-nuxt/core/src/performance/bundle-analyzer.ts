/**
 * Bundle size analyzer and performance monitoring utilities
 */

export interface BundleStats {
  totalSize: number
  gzippedSize: number
  chunks: ChunkInfo[]
  providers: ProviderStats[]
  features: FeatureStats[]
}

export interface ChunkInfo {
  name: string
  size: number
  gzippedSize: number
  modules: string[]
  isAsync: boolean
}

export interface ProviderStats {
  name: string
  size: number
  loaded: boolean
  usage: number
}

export interface FeatureStats {
  name: string
  size: number
  enabled: boolean
  usage: number
}

export interface PerformanceMetrics {
  bundleLoadTime: number
  providerInitTime: number
  firstInteractionTime: number
  memoryUsage: number
  cacheHitRate: number
}

export class BundleAnalyzer {
  private stats: BundleStats | null = null
  private metrics: PerformanceMetrics | null = null
  private observers: PerformanceObserver[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializePerformanceMonitoring()
    }
  }

  private initializePerformanceMonitoring() {
    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('ai-nuxt')) {
            this.trackResourceLoad(entry as PerformanceResourceTiming)
          }
        }
      })
      
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)

      // Monitor navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackNavigationTiming(entry as PerformanceNavigationTiming)
        }
      })
      
      navigationObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navigationObserver)
    }
  }

  private trackResourceLoad(entry: PerformanceResourceTiming) {
    const loadTime = entry.responseEnd - entry.requestStart
    
    // Track bundle loading performance
    if (entry.name.includes('chunk') || entry.name.includes('bundle')) {
      console.debug(`Bundle loaded: ${entry.name} in ${loadTime}ms`)
    }
  }

  private trackNavigationTiming(entry: PerformanceNavigationTiming) {
    const metrics: Partial<PerformanceMetrics> = {
      bundleLoadTime: entry.loadEventEnd - entry.loadEventStart,
      firstInteractionTime: entry.domInteractive - entry.navigationStart
    }
    
    this.updateMetrics(metrics)
  }

  /**
   * Analyze current bundle composition and size
   */
  async analyzeBundleSize(): Promise<BundleStats> {
    const chunks = await this.getChunkInfo()
    const providers = await this.getProviderStats()
    const features = await this.getFeatureStats()
    
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
    const gzippedSize = chunks.reduce((sum, chunk) => sum + chunk.gzippedSize, 0)
    
    this.stats = {
      totalSize,
      gzippedSize,
      chunks,
      providers,
      features
    }
    
    return this.stats
  }

  private async getChunkInfo(): Promise<ChunkInfo[]> {
    // In a real implementation, this would analyze webpack/vite chunks
    // For now, we'll simulate the data structure
    const chunks: ChunkInfo[] = []
    
    if (typeof window !== 'undefined' && 'performance' in window) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      
      for (const resource of resources) {
        if (resource.name.includes('chunk') || resource.name.includes('ai-nuxt')) {
          chunks.push({
            name: this.extractChunkName(resource.name),
            size: resource.transferSize || 0,
            gzippedSize: resource.encodedBodySize || 0,
            modules: [], // Would be populated by build analyzer
            isAsync: resource.name.includes('async') || resource.name.includes('lazy')
          })
        }
      }
    }
    
    return chunks
  }

  private async getProviderStats(): Promise<ProviderStats[]> {
    // Track which providers are loaded and their usage
    const providers: ProviderStats[] = [
      { name: 'openai', size: 0, loaded: false, usage: 0 },
      { name: 'anthropic', size: 0, loaded: false, usage: 0 },
      { name: 'ollama', size: 0, loaded: false, usage: 0 }
    ]
    
    // Check if providers are loaded in global scope
    if (typeof window !== 'undefined') {
      const aiNuxt = (window as any).__AI_NUXT__
      if (aiNuxt?.providers) {
        for (const provider of providers) {
          provider.loaded = provider.name in aiNuxt.providers
          provider.usage = aiNuxt.usage?.[provider.name] || 0
        }
      }
    }
    
    return providers
  }

  private async getFeatureStats(): Promise<FeatureStats[]> {
    // Track which features are enabled and their bundle impact
    return [
      { name: 'streaming', size: 15000, enabled: true, usage: 0 },
      { name: 'caching', size: 8000, enabled: true, usage: 0 },
      { name: 'vectorStore', size: 25000, enabled: false, usage: 0 },
      { name: 'agents', size: 35000, enabled: false, usage: 0 },
      { name: 'monitoring', size: 12000, enabled: true, usage: 0 },
      { name: 'security', size: 10000, enabled: false, usage: 0 }
    ]
  }

  private extractChunkName(url: string): string {
    const parts = url.split('/')
    return parts[parts.length - 1].split('?')[0]
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    return this.metrics
  }

  /**
   * Update performance metrics
   */
  updateMetrics(newMetrics: Partial<PerformanceMetrics>) {
    this.metrics = {
      ...this.metrics,
      ...newMetrics
    } as PerformanceMetrics
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      const usage = memory.usedJSHeapSize / memory.totalJSHeapSize
      this.updateMetrics({ memoryUsage: usage })
      return usage
    }
    return 0
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    if (!this.stats) {
      return ['Run bundle analysis first']
    }
    
    // Check for unused providers
    const unusedProviders = this.stats.providers.filter(p => p.loaded && p.usage === 0)
    if (unusedProviders.length > 0) {
      recommendations.push(`Consider removing unused providers: ${unusedProviders.map(p => p.name).join(', ')}`)
    }
    
    // Check for large chunks
    const largeChunks = this.stats.chunks.filter(c => c.size > 100000) // 100KB
    if (largeChunks.length > 0) {
      recommendations.push(`Large chunks detected: ${largeChunks.map(c => c.name).join(', ')}. Consider code splitting.`)
    }
    
    // Check for disabled features taking up space
    const disabledFeatures = this.stats.features.filter(f => !f.enabled && f.size > 0)
    if (disabledFeatures.length > 0) {
      recommendations.push(`Disabled features still bundled: ${disabledFeatures.map(f => f.name).join(', ')}`)
    }
    
    // Memory usage check
    if (this.metrics?.memoryUsage && this.metrics.memoryUsage > 0.8) {
      recommendations.push('High memory usage detected. Consider implementing lazy loading.')
    }
    
    return recommendations
  }

  /**
   * Clean up performance observers
   */
  destroy() {
    for (const observer of this.observers) {
      observer.disconnect()
    }
    this.observers = []
  }
}

// Global instance for easy access
export const bundleAnalyzer = new BundleAnalyzer()