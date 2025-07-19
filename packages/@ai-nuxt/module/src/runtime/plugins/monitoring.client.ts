import { 
  initializeTelemetry, 
  getTelemetry, 
  trackError,
  getMetrics 
} from '@ai-nuxt/core'

/**
 * Client-side monitoring plugin
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig()
  const aiNuxtConfig = config.public.aiNuxt || {}

  // Skip if monitoring is disabled
  if (aiNuxtConfig.monitoring?.enabled === false) {
    return
  }

  try {
    // Initialize client-side telemetry (limited functionality)
    await initializeTelemetry({
      serviceName: aiNuxtConfig.monitoring?.serviceName || 'ai-nuxt-app',
      serviceVersion: aiNuxtConfig.monitoring?.serviceVersion || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enableAutoInstrumentation: false, // Disable auto-instrumentation on client
      enableMetrics: aiNuxtConfig.monitoring?.enableMetrics !== false,
      enableTracing: aiNuxtConfig.monitoring?.enableTracing !== false
    })

    // Track page views
    nuxtApp.hook('page:start', () => {
      const metrics = getMetrics()
      metrics.recordRequest(
        'client',
        'nuxt',
        'page_view',
        0,
        undefined,
        undefined,
        false
      )
    })

    // Track navigation errors
    nuxtApp.hook('vue:error', (error, context) => {
      trackError(error, {
        operation: 'vue.error',
        metadata: {
          context: context.toString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      })
    })

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      trackError(new Error(event.reason), {
        operation: 'unhandled_rejection',
        metadata: {
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      })
    })

    // Track performance metrics
    if ('performance' in window && 'getEntriesByType' in performance) {
      nuxtApp.hook('page:finish', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          if (navigation) {
            const metrics = getMetrics()
            metrics.recordRequest(
              'client',
              'browser',
              'navigation',
              navigation.loadEventEnd - navigation.fetchStart,
              undefined,
              undefined,
              false
            )
          }
        }, 0)
      })
    }

    // Provide monitoring utilities
    nuxtApp.provide('monitoring', {
      trackError: (error: Error, context?: any) => trackError(error, context),
      recordMetric: (provider: string, model: string, operation: string, duration: number) => {
        const metrics = getMetrics()
        metrics.recordRequest(provider, model, operation, duration)
      },
      getTelemetry: () => getTelemetry(),
      getMetrics: () => getMetrics()
    })

    console.log('AI Nuxt client monitoring initialized')
  } catch (error) {
    console.error('Failed to initialize client monitoring:', error)
  }
})