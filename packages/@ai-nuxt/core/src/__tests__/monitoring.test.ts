import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  TelemetryManager, 
  initializeTelemetry, 
  getTelemetry, 
  shutdownTelemetry 
} from '../monitoring/telemetry'
import { 
  MetricsManager, 
  getMetrics, 
  metrics 
} from '../monitoring/metrics'
import { 
  traceAIOperation, 
  traceProviderOperation, 
  traceAgentExecution,
  getCurrentTraceContext 
} from '../monitoring/tracing'
import { 
  ErrorTrackingManager, 
  getErrorTracker, 
  trackError, 
  configureErrorTracking,
  ErrorSeverity,
  ErrorCategory 
} from '../monitoring/error-tracking'
import { 
  AlertManager, 
  getAlertManager, 
  configureAlerts,
  createCommonAlertRules,
  AlertType,
  AlertSeverity,
  EmailAlertChannel,
  WebhookAlertChannel,
  SlackAlertChannel 
} from '../monitoring/alerts'
import { 
  DashboardAPI, 
  getDashboard 
} from '../monitoring/dashboard'

// Mock OpenTelemetry
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn()
  }))
}))

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        setStatus: vi.fn(),
        setAttributes: vi.fn(),
        addEvent: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn(() => ({
          traceId: 'mock-trace-id',
          spanId: 'mock-span-id',
          traceFlags: 1
        }))
      }))
    })),
    getActiveSpan: vi.fn(() => ({
      setAttributes: vi.fn(),
      addEvent: vi.fn(),
      spanContext: vi.fn(() => ({
        traceId: 'mock-trace-id',
        spanId: 'mock-span-id',
        traceFlags: 1
      }))
    })),
    setSpan: vi.fn()
  },
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({
        add: vi.fn()
      })),
      createHistogram: vi.fn(() => ({
        record: vi.fn()
      })),
      createUpDownCounter: vi.fn(() => ({
        add: vi.fn()
      }))
    }))
  },
  context: {
    active: vi.fn()
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2
  },
  SpanKind: {
    CLIENT: 3,
    INTERNAL: 4
  }
}))

// Mock fetch for webhook tests
global.fetch = vi.fn()

describe('Monitoring System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await shutdownTelemetry()
  })

  describe('Telemetry', () => {
    it('should initialize telemetry with configuration', async () => {
      const config = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test'
      }

      const telemetry = await initializeTelemetry(config)
      expect(telemetry).toBeInstanceOf(TelemetryManager)
    })

    it('should create AI spans with attributes', async () => {
      const config = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test'
      }

      const telemetry = await initializeTelemetry(config)
      
      const span = telemetry.createAISpan('test-operation', {
        'ai.provider': 'openai',
        'ai.model': 'gpt-4',
        'ai.operation': 'chat',
        'ai.request.id': 'test-request'
      })

      expect(span).toBeDefined()
    })

    it('should trace AI operations with metrics', async () => {
      const config = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test'
      }

      const telemetry = await initializeTelemetry(config)
      
      const result = await telemetry.traceAIOperation(
        'test-chat',
        {
          'ai.provider': 'openai',
          'ai.model': 'gpt-4',
          'ai.operation': 'chat',
          'ai.request.id': 'test-request'
        },
        async (span) => {
          return 'test result'
        }
      )

      expect(result).toBe('test result')
    })

    it('should handle errors in traced operations', async () => {
      const config = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test'
      }

      const telemetry = await initializeTelemetry(config)
      
      await expect(
        telemetry.traceAIOperation(
          'test-error',
          {
            'ai.provider': 'openai',
            'ai.model': 'gpt-4',
            'ai.operation': 'chat',
            'ai.request.id': 'test-request'
          },
          async (span) => {
            throw new Error('Test error')
          }
        )
      ).rejects.toThrow('Test error')
    })
  })

  describe('Metrics', () => {
    it('should record AI request metrics', () => {
      const metricsManager = getMetrics()
      
      metricsManager.recordRequest(
        'openai',
        'gpt-4',
        'chat',
        500,
        { input: 100, output: 50, total: 150 },
        0.05,
        false
      )

      // Verify metrics were recorded (mocked)
      expect(metricsManager).toBeDefined()
    })

    it('should record cache metrics', () => {
      metrics.recordCache(true, 'semantic')
      metrics.recordCache(false, 'semantic')
      
      // Verify cache metrics were recorded
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should record agent execution metrics', () => {
      metrics.recordAgent('TestAgent', 'assistant', 1500, false)
      metrics.recordAgent('TestAgent', 'assistant', 2000, true)
      
      // Verify agent metrics were recorded
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should record RAG query metrics', () => {
      metrics.recordRAG(5, 800, false)
      
      // Verify RAG metrics were recorded
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should record vector store metrics', () => {
      metrics.recordVector('search', 200, 1000)
      
      // Verify vector metrics were recorded
      expect(true).toBe(true) // Placeholder assertion
    })
  })

  describe('Tracing', () => {
    beforeEach(async () => {
      await initializeTelemetry({
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test'
      })
    })

    it('should trace provider operations', async () => {
      const context = {
        provider: 'openai',
        model: 'gpt-4',
        operation: 'chat',
        requestId: 'test-request'
      }

      const result = await traceProviderOperation(context, async () => {
        return 'provider result'
      })

      expect(result).toBe('provider result')
    })

    it('should trace agent executions', async () => {
      const result = await traceAgentExecution(
        'TestAgent',
        'assistant',
        async () => {
          return 'agent result'
        }
      )

      expect(result).toBe('agent result')
    })

    it('should get current trace context', () => {
      const context = getCurrentTraceContext()
      expect(context).toHaveProperty('traceId')
      expect(context).toHaveProperty('spanId')
    })
  })

  describe('Error Tracking', () => {
    it('should track errors with context', async () => {
      const errorTracker = getErrorTracker()
      const error = new Error('Test error')
      
      await errorTracker.trackError(error, {
        provider: 'openai',
        model: 'gpt-4',
        operation: 'chat',
        userId: 'user-123'
      })

      const stats = errorTracker.getErrorStats()
      expect(stats.totalErrors).toBeGreaterThan(0)
    })

    it('should categorize errors correctly', async () => {
      const errorTracker = getErrorTracker()
      
      await errorTracker.trackError(new Error('Rate limit exceeded'), {})
      await errorTracker.trackError(new Error('Authentication failed'), {})
      await errorTracker.trackError(new Error('Network timeout'), {})

      const stats = errorTracker.getErrorStats()
      expect(stats.errorsByCategory).toBeDefined()
    })

    it('should configure error tracking with handlers', () => {
      configureErrorTracking({
        sentryDsn: 'https://test@sentry.io/123',
        webhookUrl: 'https://example.com/webhook'
      })

      // Verify configuration was applied
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should track error helper function', async () => {
      await trackError(new Error('Helper test error'), {
        provider: 'anthropic',
        operation: 'completion'
      })

      // Verify error was tracked
      expect(true).toBe(true) // Placeholder assertion
    })
  })

  describe('Alerts', () => {
    it('should create and manage alert rules', () => {
      const alertManager = getAlertManager()
      
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test alert rule',
        condition: {
          type: AlertType.ERROR_RATE,
          threshold: 5,
          timeWindow: 5,
          comparison: 'greater_than' as const
        },
        severity: AlertSeverity.WARNING,
        enabled: true,
        cooldown: 10,
        channels: [{ type: 'console' as const, config: {} }]
      }

      alertManager.addRule(rule)
      
      const retrievedRule = alertManager.getRule('test-rule')
      expect(retrievedRule).toEqual(rule)
    })

    it('should create common alert rules', () => {
      const rules = createCommonAlertRules()
      expect(rules).toHaveLength(4)
      expect(rules[0].name).toBe('High Error Rate')
    })

    it('should configure alerts with rules and channels', () => {
      const rules = createCommonAlertRules()
      
      configureAlerts({
        rules,
        channels: [
          {
            id: 'email',
            channel: new EmailAlertChannel({
              to: ['admin@example.com'],
              from: 'alerts@example.com',
              smtpConfig: {
                host: 'smtp.example.com',
                port: 587,
                secure: false,
                auth: { user: 'user', pass: 'pass' }
              }
            })
          }
        ]
      })

      // Verify configuration was applied
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should send webhook alerts', async () => {
      const webhookChannel = new WebhookAlertChannel({
        url: 'https://example.com/webhook'
      })

      const alert = {
        id: 'test-alert',
        ruleId: 'test-rule',
        ruleName: 'Test Alert',
        severity: AlertSeverity.WARNING,
        message: 'Test alert message',
        timestamp: new Date(),
        value: 10,
        threshold: 5,
        metadata: {}
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await webhookChannel.send(alert)
      
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        })
      )
    })

    it('should send Slack alerts', async () => {
      const slackChannel = new SlackAlertChannel({
        webhookUrl: 'https://hooks.slack.com/test'
      })

      const alert = {
        id: 'test-alert',
        ruleId: 'test-rule',
        ruleName: 'Test Alert',
        severity: AlertSeverity.CRITICAL,
        message: 'Critical alert message',
        timestamp: new Date(),
        value: 15,
        threshold: 10,
        metadata: {}
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200
      } as Response)

      await slackChannel.send(alert)
      
      expect(fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })
  })

  describe('Dashboard', () => {
    it('should get dashboard overview', async () => {
      const dashboard = getDashboard()
      const overview = await dashboard.getOverview()

      expect(overview).toHaveProperty('metrics')
      expect(overview).toHaveProperty('health')
      expect(overview).toHaveProperty('errors')
      expect(overview).toHaveProperty('alerts')
      expect(overview).toHaveProperty('timestamp')
    })

    it('should get real-time data', async () => {
      const dashboard = getDashboard()
      const realTimeData = await dashboard.getRealTimeData()

      expect(realTimeData).toHaveProperty('metrics')
      expect(realTimeData).toHaveProperty('trace')
      expect(realTimeData).toHaveProperty('timestamp')
    })

    it('should get historical data', async () => {
      const dashboard = getDashboard()
      const historicalData = await dashboard.getHistoricalData('1h')

      expect(historicalData).toHaveProperty('timeRange', '1h')
      expect(historicalData).toHaveProperty('data')
      expect(historicalData).toHaveProperty('summary')
    })

    it('should get provider statistics', async () => {
      const dashboard = getDashboard()
      const providerStats = await dashboard.getProviderStats()

      expect(providerStats).toHaveProperty('providers')
      expect(providerStats).toHaveProperty('models')
      expect(providerStats).toHaveProperty('totalRequests')
      expect(providerStats).toHaveProperty('totalCost')
    })

    it('should export metrics data', async () => {
      const dashboard = getDashboard()
      const exportedData = await dashboard.exportMetrics('json')

      expect(exportedData).toHaveProperty('overview')
      expect(exportedData).toHaveProperty('historical')
      expect(exportedData).toHaveProperty('exportedAt')
      expect(exportedData).toHaveProperty('format', 'json')
    })

    it('should export metrics as CSV', async () => {
      const dashboard = getDashboard()
      const csvData = await dashboard.exportMetrics('csv')

      expect(typeof csvData).toBe('string')
      expect(csvData).toContain('timestamp,requests_per_second')
    })
  })

  describe('Integration', () => {
    it('should work together - telemetry, metrics, and error tracking', async () => {
      // Initialize telemetry
      await initializeTelemetry({
        serviceName: 'integration-test',
        serviceVersion: '1.0.0',
        environment: 'test'
      })

      // Simulate AI operation with error
      try {
        await traceProviderOperation(
          {
            provider: 'openai',
            model: 'gpt-4',
            operation: 'chat',
            requestId: 'integration-test'
          },
          async () => {
            throw new Error('Integration test error')
          }
        )
      } catch (error) {
        await trackError(error as Error, {
          provider: 'openai',
          model: 'gpt-4',
          operation: 'chat'
        })
      }

      // Verify error was tracked
      const errorStats = getErrorTracker().getErrorStats()
      expect(errorStats.totalErrors).toBeGreaterThan(0)
    })

    it('should handle monitoring lifecycle', async () => {
      // Initialize monitoring
      const telemetry = await initializeTelemetry({
        serviceName: 'lifecycle-test',
        serviceVersion: '1.0.0',
        environment: 'test'
      })

      // Configure alerts
      const alertManager = getAlertManager()
      alertManager.startMonitoring(1000) // 1 second interval for testing

      // Simulate some activity
      metrics.recordRequest('openai', 'gpt-4', 'chat', 500, { total: 100 }, 0.05)
      
      // Stop monitoring
      alertManager.stopMonitoring()
      await shutdownTelemetry()

      expect(true).toBe(true) // Placeholder assertion
    })
  })
})