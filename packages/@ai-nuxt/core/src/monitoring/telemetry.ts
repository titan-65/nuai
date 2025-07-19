import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { trace, metrics, context, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import type { Span, Tracer, Meter } from '@opentelemetry/api'

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  serviceName: string
  serviceVersion: string
  environment: string
  endpoint?: string
  apiKey?: string
  sampleRate?: number
  enableAutoInstrumentation?: boolean
  enableMetrics?: boolean
  enableTracing?: boolean
  customAttributes?: Record<string, string | number | boolean>
}

/**
 * AI operation span attributes
 */
export interface AISpanAttributes {
  'ai.provider': string
  'ai.model': string
  'ai.operation': string
  'ai.tokens.input'?: number
  'ai.tokens.output'?: number
  'ai.tokens.total'?: number
  'ai.cost.input'?: number
  'ai.cost.output'?: number
  'ai.cost.total'?: number
  'ai.latency.ms': number
  'ai.request.id': string
  'ai.user.id'?: string
  'ai.session.id'?: string
}

/**
 * Telemetry manager
 */
export class TelemetryManager {
  private sdk: NodeSDK | null = null
  private tracer: Tracer | null = null
  private meter: Meter | null = null
  private config: TelemetryConfig
  private initialized = false

  constructor(config: TelemetryConfig) {
    this.config = {
      sampleRate: 1.0,
      enableAutoInstrumentation: true,
      enableMetrics: true,
      enableTracing: true,
      ...config
    }
  }

  /**
   * Initialize telemetry
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        ...this.config.customAttributes
      })

      // Configure exporters
      const traceExporter = new OTLPTraceExporter({
        url: this.config.endpoint ? `${this.config.endpoint}/v1/traces` : undefined,
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : undefined
      })

      const metricExporter = new OTLPMetricExporter({
        url: this.config.endpoint ? `${this.config.endpoint}/v1/metrics` : undefined,
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : undefined
      })

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 30000 // Export every 30 seconds
        }),
        instrumentations: this.config.enableAutoInstrumentation 
          ? [getNodeAutoInstrumentations({
              '@opentelemetry/instrumentation-fs': { enabled: false }
            })]
          : []
      })

      // Start SDK
      this.sdk.start()

      // Get tracer and meter
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion)
      this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion)

      this.initialized = true
      console.log(`Telemetry initialized for ${this.config.serviceName}`)
    } catch (error) {
      console.error('Failed to initialize telemetry:', error)
      throw error
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown()
      this.initialized = false
      console.log('Telemetry shutdown complete')
    }
  }

  /**
   * Get tracer instance
   */
  getTracer(): Tracer {
    if (!this.tracer) {
      throw new Error('Telemetry not initialized. Call initialize() first.')
    }
    return this.tracer
  }

  /**
   * Get meter instance
   */
  getMeter(): Meter {
    if (!this.meter) {
      throw new Error('Telemetry not initialized. Call initialize() first.')
    }
    return this.meter
  }

  /**
   * Create AI operation span
   */
  createAISpan(
    name: string,
    attributes: Partial<AISpanAttributes>,
    parentSpan?: Span
  ): Span {
    const tracer = this.getTracer()
    
    const span = tracer.startSpan(name, {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.operation': name,
        ...attributes
      }
    }, parentSpan ? trace.setSpan(context.active(), parentSpan) : undefined)

    return span
  }

  /**
   * Trace AI operation
   */
  async traceAIOperation<T>(
    operationName: string,
    attributes: Partial<AISpanAttributes>,
    operation: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.createAISpan(operationName, attributes)
    const startTime = Date.now()

    try {
      const result = await operation(span)
      
      // Update span with success
      span.setStatus({ code: SpanStatusCode.OK })
      span.setAttributes({
        'ai.latency.ms': Date.now() - startTime,
        'ai.success': true
      })

      return result
    } catch (error) {
      // Update span with error
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      span.setAttributes({
        'ai.latency.ms': Date.now() - startTime,
        'ai.success': false,
        'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
        'ai.error.message': error instanceof Error ? error.message : String(error)
      })

      throw error
    } finally {
      span.end()
    }
  }

  /**
   * Record AI metrics
   */
  recordAIMetrics(attributes: AISpanAttributes): void {
    const meter = this.getMeter()

    // Create counters and histograms if they don't exist
    const requestCounter = meter.createCounter('ai_requests_total', {
      description: 'Total number of AI requests'
    })

    const tokenHistogram = meter.createHistogram('ai_tokens_used', {
      description: 'Number of tokens used in AI operations'
    })

    const latencyHistogram = meter.createHistogram('ai_request_duration_ms', {
      description: 'Duration of AI requests in milliseconds'
    })

    const costHistogram = meter.createHistogram('ai_request_cost', {
      description: 'Cost of AI requests'
    })

    // Record metrics
    const commonLabels = {
      provider: attributes['ai.provider'],
      model: attributes['ai.model'],
      operation: attributes['ai.operation']
    }

    requestCounter.add(1, commonLabels)
    
    if (attributes['ai.tokens.total']) {
      tokenHistogram.record(attributes['ai.tokens.total'], commonLabels)
    }
    
    latencyHistogram.record(attributes['ai.latency.ms'], commonLabels)
    
    if (attributes['ai.cost.total']) {
      costHistogram.record(attributes['ai.cost.total'], commonLabels)
    }
  }

  /**
   * Add custom attributes to current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      activeSpan.setAttributes(attributes)
    }
  }

  /**
   * Add span event
   */
  addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      activeSpan.addEvent(name, attributes)
    }
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      return activeSpan.spanContext().traceId
    }
    return undefined
  }

  /**
   * Get current span ID
   */
  getCurrentSpanId(): string | undefined {
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      return activeSpan.spanContext().spanId
    }
    return undefined
  }
}

/**
 * Global telemetry instance
 */
let globalTelemetry: TelemetryManager | null = null

/**
 * Initialize global telemetry
 */
export async function initializeTelemetry(config: TelemetryConfig): Promise<TelemetryManager> {
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryManager(config)
    await globalTelemetry.initialize()
  }
  return globalTelemetry
}

/**
 * Get global telemetry instance
 */
export function getTelemetry(): TelemetryManager {
  if (!globalTelemetry) {
    throw new Error('Telemetry not initialized. Call initializeTelemetry() first.')
  }
  return globalTelemetry
}

/**
 * Shutdown global telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (globalTelemetry) {
    await globalTelemetry.shutdown()
    globalTelemetry = null
  }
}