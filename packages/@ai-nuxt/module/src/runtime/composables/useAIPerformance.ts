import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNuxtApp } from '#app'
import type { BundleStats, PerformanceMetrics } from '@ai-nuxt/core/performance'

export interface PerformanceState {
  bundleStats: BundleStats | null
  metrics: PerformanceMetrics | null
  loadingStats: Record<string, number>
  isAnalyzing: boolean
  recommendations: string[]
}

/**
 * Composable for monitoring AI Nuxt performance and bundle optimization
 */
export function useAIPerformance() {
  const { $aiPerformance } = useNuxtApp()
  
  const state = ref<PerformanceState>({
    bundleStats: null,
    metrics: null,
    loadingStats: {},
    isAnalyzing: false,
    recommendations: []
  })

  const bundleSize = computed(() => {
    if (!state.value.bundleStats) return null
    return {
      total: formatBytes(state.value.bundleStats.totalSize),
      gzipped: formatBytes(state.value.bundleStats.gzippedSize),
      compressionRatio: state.value.bundleStats.totalSize > 0 
        ? (state.value.bundleStats.gzippedSize / state.value.bundleStats.totalSize * 100).toFixed(1) + '%'
        : '0%'
    }
  })

  const providerStats = computed(() => {
    if (!state.value.bundleStats) return []
    return state.value.bundleStats.providers.map(provider => ({
      ...provider,
      sizeFormatted: formatBytes(provider.size),
      efficiency: provider.usage > 0 ? (provider.usage / provider.size * 1000).toFixed(2) : '0'
    }))
  })

  const featureStats = computed(() => {
    if (!state.value.bundleStats) return []
    return state.value.bundleStats.features.map(feature => ({
      ...feature,
      sizeFormatted: formatBytes(feature.size),
      wastedSize: !feature.enabled && feature.size > 0 ? formatBytes(feature.size) : null
    }))
  })

  const memoryUsage = computed(() => {
    if (!state.value.metrics?.memoryUsage) return null
    const usage = state.value.metrics.memoryUsage * 100
    return {
      percentage: usage.toFixed(1) + '%',
      status: usage > 80 ? 'critical' : usage > 60 ? 'warning' : 'good'
    }
  })

  const loadingPerformance = computed(() => {
    const stats = state.value.loadingStats
    const entries = Object.entries(stats)
    
    if (entries.length === 0) return null
    
    const avgLoadTime = entries.reduce((sum, [, time]) => sum + time, 0) / entries.length
    const slowestLoad = Math.max(...entries.map(([, time]) => time))
    const fastestLoad = Math.min(...entries.map(([, time]) => time))
    
    return {
      average: avgLoadTime.toFixed(2) + 'ms',
      slowest: slowestLoad.toFixed(2) + 'ms',
      fastest: fastestLoad.toFixed(2) + 'ms',
      totalModules: entries.length
    }
  })

  /**
   * Analyze current bundle size and performance
   */
  async function analyzeBundleSize(): Promise<BundleStats | null> {
    if (!$aiPerformance) {
      console.warn('Performance monitoring not available')
      return null
    }

    state.value.isAnalyzing = true
    
    try {
      const stats = await $aiPerformance.analyzeBundle()
      state.value.bundleStats = stats
      state.value.recommendations = $aiPerformance.bundleAnalyzer.generateRecommendations()
      return stats
    } catch (error) {
      console.error('Failed to analyze bundle:', error)
      return null
    } finally {
      state.value.isAnalyzing = false
    }
  }

  /**
   * Get current performance metrics
   */
  function getMetrics(): PerformanceMetrics | null {
    if (!$aiPerformance) return null
    
    const metrics = $aiPerformance.getMetrics()
    state.value.metrics = metrics
    return metrics
  }

  /**
   * Get loading statistics for dynamic imports
   */
  function getLoadingStats(): Record<string, number> {
    if (!$aiPerformance) return {}
    
    const stats = $aiPerformance.getLoadingStats()
    state.value.loadingStats = stats
    return stats
  }

  /**
   * Track memory usage
   */
  function trackMemoryUsage(): number {
    if (!$aiPerformance?.bundleAnalyzer) return 0
    
    const usage = $aiPerformance.bundleAnalyzer.trackMemoryUsage()
    if (state.value.metrics) {
      state.value.metrics.memoryUsage = usage
    }
    return usage
  }

  /**
   * Generate optimization recommendations
   */
  function generateRecommendations(): string[] {
    if (!$aiPerformance?.bundleAnalyzer) return []
    
    const recommendations = $aiPerformance.bundleAnalyzer.generateRecommendations()
    state.value.recommendations = recommendations
    return recommendations
  }

  /**
   * Clear performance cache
   */
  function clearCache(): void {
    if ($aiPerformance?.dynamicImportManager) {
      $aiPerformance.dynamicImportManager.clearCache()
    }
    state.value.loadingStats = {}
  }

  /**
   * Start continuous monitoring
   */
  function startMonitoring(interval = 30000): void {
    const monitoringInterval = setInterval(() => {
      getMetrics()
      getLoadingStats()
      trackMemoryUsage()
    }, interval)

    onUnmounted(() => {
      clearInterval(monitoringInterval)
    })
  }

  // Initialize on mount
  onMounted(() => {
    if (process.client) {
      // Initial data load
      getMetrics()
      getLoadingStats()
      
      // Auto-analyze in development mode
      if (process.dev) {
        setTimeout(() => {
          analyzeBundleSize()
        }, 2000)
      }
    }
  })

  return {
    // State
    state: readonly(state),
    
    // Computed
    bundleSize,
    providerStats,
    featureStats,
    memoryUsage,
    loadingPerformance,
    
    // Methods
    analyzeBundleSize,
    getMetrics,
    getLoadingStats,
    trackMemoryUsage,
    generateRecommendations,
    clearCache,
    startMonitoring
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}