import { getMetrics } from './metrics'
import { getErrorTracker } from './error-tracking'
import { getAlertManager } from './alerts'
import { getCurrentTraceContext } from './tracing'

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  requests: {
    total: number
    successful: number
    failed: number
    errorRate: number
  }
  latency: {
    average: number
    p50: number
    p95: number
    p99: number
  }
  tokens: {
    total: number
    input: number
    output: number
    averagePerRequest: number
  }
  cost: {
    total: number
    averagePerRequest: number
    hourlyRate: number
  }
  providers: {
    [provider: string]: {
      requests: number
      errors: number
      averageLatency: number
    }
  }
  models: {
    [model: string]: {
      requests: number
      tokens: number
      cost: number
    }
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
    size: number
  }
  agents: {
    [agent: string]: {
      executions: number
      failures: number
      averageDuration: number
    }
  }
}

/**
 * System health status
 */
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    [component: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      message?: string
      lastCheck: Date
    }
  }
  uptime: number
  version: string
}

/**
 * Real-time metrics
 */
export interface RealTimeMetrics {
  timestamp: Date
  requestsPerSecond: number
  errorsPerSecond: number
  averageLatency: number
  activeConnections: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  cpuUsage: number
}

/**
 * Dashboard data provider
 */
export class DashboardDataProvider {
  private startTime = Date.now()
  private metricsHistory: RealTimeMetrics[] = []
  private maxHistorySize = 1000

  /**
   * Get current dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // In a real implementation, this would query actual metrics storage
    // For now, we'll return mock data based on the metrics structure
    
    return {
      requests: {
        total: 1250,
        successful: 1180,
        failed: 70,
        errorRate: 5.6
      },
      latency: {
        average: 450,
        p50: 320,
        p95: 850,
        p99: 1200
      },
      tokens: {
        total: 125000,
        input: 75000,
        output: 50000,
        averagePerRequest: 100
      },
      cost: {
        total: 25.50,
        averagePerRequest: 0.02,
        hourlyRate: 2.15
      },
      providers: {
        openai: {
          requests: 800,
          errors: 40,
          averageLatency: 420
        },
        anthropic: {
          requests: 350,
          errors: 20,
          averageLatency: 380
        },
        ollama: {
          requests: 100,
          errors: 10,
          averageLatency: 650
        }
      },
      models: {
        'gpt-4': {
          requests: 500,
          tokens: 75000,
          cost: 18.50
        },
        'gpt-3.5-turbo': {
          requests: 300,
          tokens: 30000,
          cost: 4.50
        },
        'claude-3-opus': {
          requests: 250,
          tokens: 15000,
          cost: 2.25
        },
        'claude-3-sonnet': {
          requests: 100,
          tokens: 5000,
          cost: 0.25
        }
      },
      cache: {
        hits: 450,
        misses: 800,
        hitRate: 36.0,
        size: 1024
      },
      agents: {
        'AssistantAgent': {
          executions: 150,
          failures: 5,
          averageDuration: 2500
        },
        'ResearchAgent': {
          executions: 75,
          failures: 8,
          averageDuration: 4200
        },
        'CoderAgent': {
          executions: 50,
          failures: 2,
          averageDuration: 3800
        }
      }
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const uptime = Date.now() - this.startTime
    
    // Check component health
    const components = {
      'ai-providers': await this.checkProviderHealth(),
      'cache': await this.checkCacheHealth(),
      'database': await this.checkDatabaseHealth(),
      'vector-store': await this.checkVectorStoreHealth(),
      'monitoring': await this.checkMonitoringHealth()
    }

    // Determine overall health
    const componentStatuses = Object.values(components).map(c => c.status)
    let overall: SystemHealth['overall'] = 'healthy'
    
    if (componentStatuses.includes('unhealthy')) {
      overall = 'unhealthy'
    } else if (componentStatuses.includes('degraded')) {
      overall = 'degraded'
    }

    return {
      overall,
      components,
      uptime,
      version: '1.0.0'
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const metrics: RealTimeMetrics = {
      timestamp: new Date(),
      requestsPerSecond: Math.random() * 10 + 5,
      errorsPerSecond: Math.random() * 2,
      averageLatency: Math.random() * 200 + 300,
      activeConnections: Math.floor(Math.random() * 50 + 10),
      memoryUsage: {
        used: Math.floor(Math.random() * 500 + 200),
        total: 1024,
        percentage: 0
      },
      cpuUsage: Math.random() * 30 + 10
    }

    metrics.memoryUsage.percentage = (metrics.memoryUsage.used / metrics.memoryUsage.total) * 100

    // Store in history
    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize)
    }

    return metrics
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes = 60): RealTimeMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    return this.metricsHistory.filter(m => m.timestamp >= cutoff)
  }

  /**
   * Get error summary
   */
  async getErrorSummary() {
    const errorTracker = getErrorTracker()
    return errorTracker.getErrorStats()
  }

  /**
   * Get alert summary
   */
  async getAlertSummary() {
    const alertManager = getAlertManager()
    const history = alertManager.getAlertHistory(50)
    
    return {
      recentAlerts: history.slice(0, 10),
      totalAlerts: history.length,
      criticalAlerts: history.filter(a => a.severity === 'critical').length,
      warningAlerts: history.filter(a => a.severity === 'warning').length,
      activeRules: alertManager.listRules().filter(r => r.enabled).length
    }
  }

  /**
   * Get trace information
   */
  getCurrentTrace() {
    return getCurrentTraceContext()
  }

  // Health check methods
  private async checkProviderHealth() {
    // Mock provider health check
    const isHealthy = Math.random() > 0.1
    return {
      status: isHealthy ? 'healthy' as const : 'degraded' as const,
      message: isHealthy ? 'All providers responding' : 'Some providers experiencing delays',
      lastCheck: new Date()
    }
  }

  private async checkCacheHealth() {
    const isHealthy = Math.random() > 0.05
    return {
      status: isHealthy ? 'healthy' as const : 'degraded' as const,
      message: isHealthy ? 'Cache operating normally' : 'Cache hit rate below optimal',
      lastCheck: new Date()
    }
  }

  private async checkDatabaseHealth() {
    const isHealthy = Math.random() > 0.02
    return {
      status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
      message: isHealthy ? 'Database connections stable' : 'Database connection issues',
      lastCheck: new Date()
    }
  }

  private async checkVectorStoreHealth() {
    const isHealthy = Math.random() > 0.03
    return {
      status: isHealthy ? 'healthy' as const : 'degraded' as const,
      message: isHealthy ? 'Vector operations normal' : 'Vector search latency elevated',
      lastCheck: new Date()
    }
  }

  private async checkMonitoringHealth() {
    return {
      status: 'healthy' as const,
      message: 'Monitoring systems operational',
      lastCheck: new Date()
    }
  }
}

/**
 * Dashboard API
 */
export class DashboardAPI {
  private dataProvider = new DashboardDataProvider()

  /**
   * Get dashboard overview
   */
  async getOverview() {
    const [metrics, health, errors, alerts] = await Promise.all([
      this.dataProvider.getDashboardMetrics(),
      this.dataProvider.getSystemHealth(),
      this.dataProvider.getErrorSummary(),
      this.dataProvider.getAlertSummary()
    ])

    return {
      metrics,
      health,
      errors,
      alerts,
      timestamp: new Date()
    }
  }

  /**
   * Get real-time data
   */
  async getRealTimeData() {
    const realTimeMetrics = await this.dataProvider.getRealTimeMetrics()
    const trace = this.dataProvider.getCurrentTrace()

    return {
      metrics: realTimeMetrics,
      trace,
      timestamp: new Date()
    }
  }

  /**
   * Get historical data
   */
  async getHistoricalData(timeRange: '1h' | '6h' | '24h' | '7d' = '1h') {
    const minutes = {
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '7d': 10080
    }[timeRange]

    const history = this.dataProvider.getMetricsHistory(minutes)
    
    return {
      timeRange,
      data: history,
      summary: this.calculateHistoricalSummary(history)
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats() {
    const metrics = await this.dataProvider.getDashboardMetrics()
    return {
      providers: metrics.providers,
      models: metrics.models,
      totalRequests: metrics.requests.total,
      totalCost: metrics.cost.total
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const metrics = await this.dataProvider.getDashboardMetrics()
    return {
      latency: metrics.latency,
      cache: metrics.cache,
      agents: metrics.agents,
      requestRate: metrics.requests.total / 3600 // requests per second (assuming 1 hour window)
    }
  }

  /**
   * Export metrics data
   */
  async exportMetrics(format: 'json' | 'csv' = 'json') {
    const overview = await this.getOverview()
    const historical = await this.getHistoricalData('24h')

    const exportData = {
      overview,
      historical,
      exportedAt: new Date().toISOString(),
      format
    }

    if (format === 'csv') {
      return this.convertToCSV(exportData)
    }

    return exportData
  }

  private calculateHistoricalSummary(history: RealTimeMetrics[]) {
    if (history.length === 0) return null

    const requestsPerSecond = history.map(h => h.requestsPerSecond)
    const latencies = history.map(h => h.averageLatency)
    const cpuUsages = history.map(h => h.cpuUsage)

    return {
      requests: {
        min: Math.min(...requestsPerSecond),
        max: Math.max(...requestsPerSecond),
        avg: requestsPerSecond.reduce((a, b) => a + b, 0) / requestsPerSecond.length
      },
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
      },
      cpu: {
        min: Math.min(...cpuUsages),
        max: Math.max(...cpuUsages),
        avg: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length
      }
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for metrics data
    const headers = ['timestamp', 'requests_per_second', 'errors_per_second', 'average_latency', 'cpu_usage']
    const rows = data.historical.data.map((metric: RealTimeMetrics) => [
      metric.timestamp.toISOString(),
      metric.requestsPerSecond,
      metric.errorsPerSecond,
      metric.averageLatency,
      metric.cpuUsage
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }
}

/**
 * Global dashboard instance
 */
let globalDashboard: DashboardAPI | null = null

/**
 * Get global dashboard
 */
export function getDashboard(): DashboardAPI {
  if (!globalDashboard) {
    globalDashboard = new DashboardAPI()
  }
  return globalDashboard
}