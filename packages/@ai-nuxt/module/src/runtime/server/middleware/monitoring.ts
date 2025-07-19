import { 
  initializeTelemetry, 
  getTelemetry, 
  getMetrics, 
  trackError,
  getErrorTracker,
  configureAlerts,
  createCommonAlertRules
} from '@ai-nuxt/core'

/**
 * Monitoring middleware for automatic instrumentation
 */
export default defineEventHandler(async (event) => {
  // Skip monitoring for monitoring endpoints to avoid recursion
  if (event.node.req.url?.startsWith('/api/monitoring')) {
    return
  }

  const startTime = Date.now()
  const requestId = generateRequestId()
  
  // Add request ID to headers
  setHeader(event, 'x-request-id', requestId)

  try {
    // Initialize telemetry if not already done
    await ensureTelemetryInitialized()

    // Create span for the request
    const telemetry = getTelemetry()
    const span = telemetry.createAISpan('http.request', {
      'http.method': event.node.req.method || 'GET',
      'http.url': event.node.req.url || '/',
      'http.user_agent': getHeader(event, 'user-agent') || '',
      'ai.request.id': requestId
    })

    // Add request context to event
    event.context.monitoring = {
      requestId,
      startTime,
      span
    }

    // Continue with request processing
    const result = await $fetch.raw(event.node.req.url || '/', {
      method: event.node.req.method as any,
      headers: event.node.req.headers as any,
      body: event.node.req.body
    }).catch(() => null) // Ignore errors here, they'll be handled elsewhere

    // Record metrics
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode || 200
    const isError = statusCode >= 400

    // Update span
    span.setAttributes({
      'http.status_code': statusCode,
      'http.response_size': getHeader(event, 'content-length') || 0,
      'ai.latency.ms': duration,
      'ai.success': !isError
    })

    // Record request metrics
    const metrics = getMetrics()
    metrics.recordRequest(
      'http',
      'nuxt',
      event.node.req.method || 'GET',
      duration,
      undefined,
      undefined,
      isError
    )

    span.end()

  } catch (error) {
    const duration = Date.now() - startTime
    
    // Track error
    await trackError(error as Error, {
      requestId,
      operation: 'http.request',
      metadata: {
        method: event.node.req.method,
        url: event.node.req.url,
        userAgent: getHeader(event, 'user-agent')
      }
    })

    // Record error metrics
    const metrics = getMetrics()
    metrics.recordRequest(
      'http',
      'nuxt',
      event.node.req.method || 'GET',
      duration,
      undefined,
      undefined,
      true
    )

    // Re-throw error
    throw error
  }
})

/**
 * Ensure telemetry is initialized
 */
let telemetryInitialized = false
async function ensureTelemetryInitialized() {
  if (telemetryInitialized) return

  try {
    const config = useRuntimeConfig()
    const aiNuxtConfig = config.aiNuxt || {}
    
    await initializeTelemetry({
      serviceName: aiNuxtConfig.monitoring?.serviceName || 'ai-nuxt-app',
      serviceVersion: aiNuxtConfig.monitoring?.serviceVersion || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      endpoint: aiNuxtConfig.monitoring?.otlpEndpoint,
      apiKey: aiNuxtConfig.monitoring?.apiKey,
      sampleRate: aiNuxtConfig.monitoring?.sampleRate || 1.0,
      enableAutoInstrumentation: aiNuxtConfig.monitoring?.enableAutoInstrumentation !== false,
      enableMetrics: aiNuxtConfig.monitoring?.enableMetrics !== false,
      enableTracing: aiNuxtConfig.monitoring?.enableTracing !== false
    })

    // Configure alerts if enabled
    if (aiNuxtConfig.monitoring?.enableAlerts !== false) {
      const rules = createCommonAlertRules()
      configureAlerts({
        rules,
        monitoringInterval: aiNuxtConfig.monitoring?.alertCheckInterval || 60000
      })
    }

    telemetryInitialized = true
    console.log('AI Nuxt monitoring initialized')
  } catch (error) {
    console.error('Failed to initialize monitoring:', error)
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}