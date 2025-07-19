import { defineNuxtPlugin } from '#app'
import { bundleAnalyzer, dynamicImportManager } from '@ai-nuxt/core/performance'

export default defineNuxtPlugin({
  name: 'ai-nuxt-performance',
  async setup() {
    // Initialize performance monitoring in development mode
    if (process.dev) {
      console.log('🚀 AI Nuxt Performance Monitoring initialized')
      
      // Start bundle analysis
      setTimeout(async () => {
        try {
          const stats = await bundleAnalyzer.analyzeBundleSize()
          console.log('📊 Bundle Analysis:', stats)
          
          const recommendations = bundleAnalyzer.generateRecommendations()
          if (recommendations.length > 0) {
            console.log('💡 Optimization Recommendations:', recommendations)
          }
        } catch (error) {
          console.warn('Failed to analyze bundle:', error)
        }
      }, 2000)
      
      // Track memory usage periodically
      setInterval(() => {
        const memoryUsage = bundleAnalyzer.trackMemoryUsage()
        if (memoryUsage > 0.8) {
          console.warn(`⚠️ High memory usage detected: ${(memoryUsage * 100).toFixed(1)}%`)
        }
      }, 30000)
    }
    
    // Expose performance utilities globally
    return {
      provide: {
        aiPerformance: {
          bundleAnalyzer,
          dynamicImportManager,
          async analyzeBundle() {
            return bundleAnalyzer.analyzeBundleSize()
          },
          getMetrics() {
            return bundleAnalyzer.getPerformanceMetrics()
          },
          getLoadingStats() {
            return dynamicImportManager.getLoadingStats()
          }
        }
      }
    }
  }
})