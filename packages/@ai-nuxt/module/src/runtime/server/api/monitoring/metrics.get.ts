import { getDashboard } from '@ai-nuxt/core'

/**
 * Metrics endpoint
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const dashboard = getDashboard()

    // Get time range from query params
    const timeRange = (query.timeRange as string) || '1h'
    const format = (query.format as string) || 'json'

    if (format === 'prometheus') {
      // Return Prometheus format metrics
      const metrics = await dashboard.getOverview()
      const prometheusMetrics = convertToPrometheusFormat(metrics)
      
      setHeader(event, 'content-type', 'text/plain; version=0.0.4; charset=utf-8')
      return prometheusMetrics
    }

    // Return JSON format
    const [overview, historical, realTime] = await Promise.all([
      dashboard.getOverview(),
      dashboard.getHistoricalData(timeRange as any),
      dashboard.getRealTimeData()
    ])

    return {
      overview,
      historical,
      realTime,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
})

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(metrics: any): string {
  const lines: string[] = []
  
  // Add help and type comments
  lines.push('# HELP ai_requests_total Total number of AI requests')
  lines.push('# TYPE ai_requests_total counter')
  lines.push(`ai_requests_total ${metrics.metrics.requests.total}`)
  
  lines.push('# HELP ai_request_errors_total Total number of AI request errors')
  lines.push('# TYPE ai_request_errors_total counter')
  lines.push(`ai_request_errors_total ${metrics.metrics.requests.failed}`)
  
  lines.push('# HELP ai_request_duration_seconds Request duration in seconds')
  lines.push('# TYPE ai_request_duration_seconds histogram')
  lines.push(`ai_request_duration_seconds_sum ${metrics.metrics.latency.average / 1000}`)
  lines.push(`ai_request_duration_seconds_count ${metrics.metrics.requests.total}`)
  
  lines.push('# HELP ai_tokens_used_total Total tokens used')
  lines.push('# TYPE ai_tokens_used_total counter')
  lines.push(`ai_tokens_used_total ${metrics.metrics.tokens.total}`)
  
  lines.push('# HELP ai_cost_usd_total Total cost in USD')
  lines.push('# TYPE ai_cost_usd_total counter')
  lines.push(`ai_cost_usd_total ${metrics.metrics.cost.total}`)
  
  // Add provider-specific metrics
  Object.entries(metrics.metrics.providers).forEach(([provider, data]: [string, any]) => {
    lines.push(`ai_provider_requests_total{provider="${provider}"} ${data.requests}`)
    lines.push(`ai_provider_errors_total{provider="${provider}"} ${data.errors}`)
    lines.push(`ai_provider_latency_seconds{provider="${provider}"} ${data.averageLatency / 1000}`)
  })
  
  return lines.join('\n') + '\n'
}