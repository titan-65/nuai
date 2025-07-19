import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import type { Span, Tracer } from '@opentelemetry/api'
import { getTelemetry } from './telemetry'
import { getMetrics } from './metrics'

/**
 * Tracing utilities for AI operations
 */

/**
 * AI operation context
 */
export interface AIOperationContext {
  provider: string
  model: string
  operation: string
  userId?: string
  sessionId?: string
  requestId: string
  metadata?: Record<string, any>
}

/**
 * AI operation result
 */
export interface AIOperationResult {
  success: boolean
  tokens?: {
    input?: number
    output?: number
    total?: number
  }
  cost?: number
  latency: number
  error?: Error
  metadata?: Record<string, any>
}

/**
 * Trace decorator for AI operations
 */
export function traceAIOperation(operationName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const tracer = getTelemetry().getTracer()
      const span = tracer.startSpan(`ai.${operationName}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'ai.operation': operationName,
          'ai.method': `${target.constructor.name}.${propertyName}`
        }
      })

      const startTime = Date.now()

      try {
        const result = await method.apply(this, args)
        
        // Record success
        span.setStatus({ code: SpanStatusCode.OK })
        span.setAttributes({
          'ai.success': true,
          'ai.latency.ms': Date.now() - startTime
        })

        return result
      } catch (error) {
        // Record error
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
        span.setAttributes({
          'ai.success': false,
          'ai.latency.ms': Date.now() - startTime,
          'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
          'ai.error.message': error instanceof Error ? error.message : String(error)
        })

        throw error
      } finally {
        span.end()
      }
    }

    return descriptor
  }
}

/**
 * Trace AI provider operation
 */
export async function traceProviderOperation<T>(
  context: AIOperationContext,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTelemetry().getTracer()
  const span = tracer.startSpan(`ai.provider.${context.operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'ai.provider': context.provider,
      'ai.model': context.model,
      'ai.operation': context.operation,
      'ai.request.id': context.requestId,
      'ai.user.id': context.userId,
      'ai.session.id': context.sessionId
    }
  })

  const startTime = Date.now()

  try {
    // Add context metadata
    if (context.metadata) {
      Object.entries(context.metadata).forEach(([key, value]) => {
        span.setAttributes({ [`ai.context.${key}`]: value })
      })
    }

    // Execute operation
    const result = await operation()
    
    // Record success
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'ai.success': true,
      'ai.latency.ms': Date.now() - startTime
    })

    return result
  } catch (error) {
    // Record error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.setAttributes({
      'ai.success': false,
      'ai.latency.ms': Date.now() - startTime,
      'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      'ai.error.message': error instanceof Error ? error.message : String(error)
    })

    throw error
  } finally {
    span.end()
  }
}

/**
 * Trace AI operation with metrics
 */
export async function traceAIOperationWithMetrics<T>(
  context: AIOperationContext,
  operation: () => Promise<{ result: T; metrics: AIOperationResult }>
): Promise<T> {
  const tracer = getTelemetry().getTracer()
  const metricsManager = getMetrics()
  
  const span = tracer.startSpan(`ai.${context.operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'ai.provider': context.provider,
      'ai.model': context.model,
      'ai.operation': context.operation,
      'ai.request.id': context.requestId,
      'ai.user.id': context.userId,
      'ai.session.id': context.sessionId
    }
  })

  const startTime = Date.now()

  try {
    // Execute operation
    const { result, metrics } = await operation()
    
    // Update span with metrics
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'ai.success': true,
      'ai.latency.ms': metrics.latency,
      'ai.tokens.input': metrics.tokens?.input,
      'ai.tokens.output': metrics.tokens?.output,
      'ai.tokens.total': metrics.tokens?.total,
      'ai.cost.total': metrics.cost
    })

    // Record metrics
    metricsManager.recordRequest(
      context.provider,
      context.model,
      context.operation,
      metrics.latency,
      metrics.tokens,
      metrics.cost,
      false
    )

    return result
  } catch (error) {
    const latency = Date.now() - startTime
    
    // Record error in span
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.setAttributes({
      'ai.success': false,
      'ai.latency.ms': latency,
      'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      'ai.error.message': error instanceof Error ? error.message : String(error)
    })

    // Record error metrics
    metricsManager.recordRequest(
      context.provider,
      context.model,
      context.operation,
      latency,
      undefined,
      undefined,
      true
    )

    throw error
  } finally {
    span.end()
  }
}

/**
 * Create child span
 */
export function createChildSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
  parentSpan?: Span
): Span {
  const tracer = getTelemetry().getTracer()
  
  return tracer.startSpan(name, {
    attributes,
    parent: parentSpan ? trace.setSpan(context.active(), parentSpan) : undefined
  })
}

/**
 * Add span event
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
  span?: Span
): void {
  const targetSpan = span || trace.getActiveSpan()
  if (targetSpan) {
    targetSpan.addEvent(name, attributes)
  }
}

/**
 * Set span attributes
 */
export function setSpanAttributes(
  attributes: Record<string, string | number | boolean>,
  span?: Span
): void {
  const targetSpan = span || trace.getActiveSpan()
  if (targetSpan) {
    targetSpan.setAttributes(attributes)
  }
}

/**
 * Get current trace context
 */
export function getCurrentTraceContext(): {
  traceId?: string
  spanId?: string
  traceFlags?: number
} {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    const spanContext = activeSpan.spanContext()
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags
    }
  }
  return {}
}

/**
 * Trace agent execution
 */
export async function traceAgentExecution<T>(
  agentName: string,
  agentType: string,
  operation: () => Promise<T>
): Promise<T> {
  const tracer = getTelemetry().getTracer()
  const metricsManager = getMetrics()
  
  const span = tracer.startSpan(`ai.agent.${agentName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'ai.agent.name': agentName,
      'ai.agent.type': agentType,
      'ai.operation': 'agent_execution'
    }
  })

  const startTime = Date.now()

  try {
    const result = await operation()
    const duration = Date.now() - startTime
    
    // Record success
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'ai.success': true,
      'ai.duration.ms': duration
    })

    // Record metrics
    metricsManager.recordAgentExecution(agentName, agentType, duration, false)

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Record error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.setAttributes({
      'ai.success': false,
      'ai.duration.ms': duration,
      'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      'ai.error.message': error instanceof Error ? error.message : String(error)
    })

    // Record error metrics
    metricsManager.recordAgentExecution(agentName, agentType, duration, true)

    throw error
  } finally {
    span.end()
  }
}

/**
 * Trace RAG operation
 */
export async function traceRAGOperation<T>(
  operation: () => Promise<{ result: T; retrievalCount: number }>
): Promise<T> {
  const tracer = getTelemetry().getTracer()
  const metricsManager = getMetrics()
  
  const span = tracer.startSpan('ai.rag.query', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'ai.operation': 'rag_query'
    }
  })

  const startTime = Date.now()

  try {
    const { result, retrievalCount } = await operation()
    const latency = Date.now() - startTime
    
    // Record success
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'ai.success': true,
      'ai.rag.retrieval_count': retrievalCount,
      'ai.latency.ms': latency
    })

    // Record metrics
    metricsManager.recordRAGQuery(retrievalCount, latency, false)

    return result
  } catch (error) {
    const latency = Date.now() - startTime
    
    // Record error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.setAttributes({
      'ai.success': false,
      'ai.latency.ms': latency,
      'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      'ai.error.message': error instanceof Error ? error.message : String(error)
    })

    // Record error metrics
    metricsManager.recordRAGQuery(0, latency, true)

    throw error
  } finally {
    span.end()
  }
}

/**
 * Trace vector store operation
 */
export async function traceVectorOperation<T>(
  operation: string,
  vectorOperation: () => Promise<T>
): Promise<T> {
  const tracer = getTelemetry().getTracer()
  const metricsManager = getMetrics()
  
  const span = tracer.startSpan(`ai.vector.${operation}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'ai.vector.operation': operation
    }
  })

  const startTime = Date.now()

  try {
    const result = await operation()
    const latency = Date.now() - startTime
    
    // Record success
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'ai.success': true,
      'ai.latency.ms': latency
    })

    // Record metrics
    metricsManager.recordVectorOperation(operation, latency)

    return result
  } catch (error) {
    const latency = Date.now() - startTime
    
    // Record error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    span.setAttributes({
      'ai.success': false,
      'ai.latency.ms': latency,
      'ai.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      'ai.error.message': error instanceof Error ? error.message : String(error)
    })

    throw error
  } finally {
    span.end()
  }
}