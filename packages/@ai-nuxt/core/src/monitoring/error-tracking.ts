import { getCurrentTraceContext } from './tracing'
import { getMetrics } from './metrics'

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories
 */
export enum ErrorCategory {
  PROVIDER_ERROR = 'provider_error',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  QUOTA_EXCEEDED = 'quota_exceeded',
  MODEL_ERROR = 'model_error',
  AGENT_ERROR = 'agent_error',
  CACHE_ERROR = 'cache_error',
  VECTOR_ERROR = 'vector_error',
  RAG_ERROR = 'rag_error',
  UNKNOWN = 'unknown'
}

/**
 * Error context
 */
export interface ErrorContext {
  userId?: string
  sessionId?: string
  requestId?: string
  provider?: string
  model?: string
  operation?: string
  traceId?: string
  spanId?: string
  metadata?: Record<string, any>
}

/**
 * Tracked error
 */
export interface TrackedError {
  id: string
  timestamp: Date
  message: string
  stack?: string
  category: ErrorCategory
  severity: ErrorSeverity
  context: ErrorContext
  fingerprint: string
  count: number
  firstSeen: Date
  lastSeen: Date
}

/**
 * Error handler interface
 */
export interface ErrorHandler {
  handleError(error: Error, context: ErrorContext): Promise<void>
}

/**
 * Console error handler
 */
export class ConsoleErrorHandler implements ErrorHandler {
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    console.error('AI Nuxt Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Sentry error handler
 */
export class SentryErrorHandler implements ErrorHandler {
  private sentryDsn: string

  constructor(sentryDsn: string) {
    this.sentryDsn = sentryDsn
  }

  async handleError(error: Error, context: ErrorContext): Promise<void> {
    // In a real implementation, this would use @sentry/node
    // For now, we'll simulate the Sentry integration
    
    const sentryEvent = {
      message: error.message,
      level: this.getSentryLevel(this.categorizeError(error)),
      tags: {
        provider: context.provider,
        model: context.model,
        operation: context.operation,
        category: this.categorizeError(error)
      },
      user: {
        id: context.userId
      },
      contexts: {
        trace: {
          trace_id: context.traceId,
          span_id: context.spanId
        },
        ai: {
          provider: context.provider,
          model: context.model,
          operation: context.operation
        }
      },
      extra: context.metadata,
      fingerprint: [this.generateFingerprint(error, context)]
    }

    // Send to Sentry (simulated)
    console.log('Sentry Event:', sentryEvent)
  }

  private getSentryLevel(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.CRITICAL:
        return 'fatal'
      case ErrorCategory.PROVIDER_ERROR:
      case ErrorCategory.MODEL_ERROR:
        return 'error'
      case ErrorCategory.RATE_LIMIT:
      case ErrorCategory.QUOTA_EXCEEDED:
        return 'warning'
      default:
        return 'error'
    }
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    
    if (message.includes('rate limit')) return ErrorCategory.RATE_LIMIT
    if (message.includes('quota')) return ErrorCategory.QUOTA_EXCEEDED
    if (message.includes('auth')) return ErrorCategory.AUTHENTICATION
    if (message.includes('timeout')) return ErrorCategory.TIMEOUT
    if (message.includes('network')) return ErrorCategory.NETWORK
    if (message.includes('validation')) return ErrorCategory.VALIDATION
    
    return ErrorCategory.UNKNOWN
  }

  private generateFingerprint(error: Error, context: ErrorContext): string {
    const parts = [
      error.constructor.name,
      context.provider,
      context.operation,
      error.message.substring(0, 100)
    ].filter(Boolean)
    
    return parts.join(':')
  }
}

/**
 * Webhook error handler
 */
export class WebhookErrorHandler implements ErrorHandler {
  private webhookUrl: string
  private headers: Record<string, string>

  constructor(webhookUrl: string, headers: Record<string, string> = {}) {
    this.webhookUrl = webhookUrl
    this.headers = headers
  }

  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const payload = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      },
      context,
      severity: this.getSeverity(error),
      category: this.categorizeError(error)
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error('Failed to send error webhook:', response.statusText)
      }
    } catch (webhookError) {
      console.error('Error sending webhook:', webhookError)
    }
  }

  private getSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL
    }
    if (message.includes('quota') || message.includes('billing')) {
      return ErrorSeverity.HIGH
    }
    if (message.includes('rate limit') || message.includes('timeout')) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.LOW
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    
    if (message.includes('rate limit')) return ErrorCategory.RATE_LIMIT
    if (message.includes('quota')) return ErrorCategory.QUOTA_EXCEEDED
    if (message.includes('auth')) return ErrorCategory.AUTHENTICATION
    if (message.includes('timeout')) return ErrorCategory.TIMEOUT
    if (message.includes('network')) return ErrorCategory.NETWORK
    if (message.includes('validation')) return ErrorCategory.VALIDATION
    if (message.includes('provider')) return ErrorCategory.PROVIDER_ERROR
    if (message.includes('model')) return ErrorCategory.MODEL_ERROR
    if (message.includes('agent')) return ErrorCategory.AGENT_ERROR
    if (message.includes('cache')) return ErrorCategory.CACHE_ERROR
    if (message.includes('vector')) return ErrorCategory.VECTOR_ERROR
    if (message.includes('rag')) return ErrorCategory.RAG_ERROR
    
    return ErrorCategory.UNKNOWN
  }
}

/**
 * Error tracking manager
 */
export class ErrorTrackingManager {
  private handlers: ErrorHandler[] = []
  private errorStore = new Map<string, TrackedError>()

  constructor() {
    // Add default console handler
    this.addHandler(new ConsoleErrorHandler())
  }

  /**
   * Add error handler
   */
  addHandler(handler: ErrorHandler): void {
    this.handlers.push(handler)
  }

  /**
   * Remove error handler
   */
  removeHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler)
    if (index > -1) {
      this.handlers.splice(index, 1)
    }
  }

  /**
   * Track error
   */
  async trackError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): Promise<void> {
    // Enhance context with trace information
    const traceContext = getCurrentTraceContext()
    const enhancedContext: ErrorContext = {
      ...context,
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      requestId: context.requestId || this.generateRequestId()
    }

    // Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(error, enhancedContext)
    
    // Update error store
    const now = new Date()
    const existingError = this.errorStore.get(fingerprint)
    
    if (existingError) {
      existingError.count++
      existingError.lastSeen = now
    } else {
      const trackedError: TrackedError = {
        id: this.generateErrorId(),
        timestamp: now,
        message: error.message,
        stack: error.stack,
        category: this.categorizeError(error),
        severity: this.getSeverity(error),
        context: enhancedContext,
        fingerprint,
        count: 1,
        firstSeen: now,
        lastSeen: now
      }
      
      this.errorStore.set(fingerprint, trackedError)
    }

    // Record metrics
    const metrics = getMetrics()
    metrics.getMetrics().requestErrors.add(1, {
      category: this.categorizeError(error),
      provider: enhancedContext.provider || 'unknown',
      operation: enhancedContext.operation || 'unknown'
    })

    // Notify all handlers
    await Promise.all(
      this.handlers.map(handler => 
        handler.handleError(error, enhancedContext).catch(handlerError => {
          console.error('Error handler failed:', handlerError)
        })
      )
    )
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number
    errorsByCategory: Record<ErrorCategory, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    recentErrors: TrackedError[]
  } {
    const errors = Array.from(this.errorStore.values())
    
    const errorsByCategory = {} as Record<ErrorCategory, number>
    const errorsBySeverity = {} as Record<ErrorSeverity, number>
    
    errors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + error.count
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + error.count
    })

    const recentErrors = errors
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 10)

    return {
      totalErrors: errors.reduce((sum, error) => sum + error.count, 0),
      errorsByCategory,
      errorsBySeverity,
      recentErrors
    }
  }

  /**
   * Clear error store
   */
  clearErrors(): void {
    this.errorStore.clear()
  }

  private generateFingerprint(error: Error, context: ErrorContext): string {
    const parts = [
      error.constructor.name,
      context.provider,
      context.operation,
      error.message.substring(0, 100)
    ].filter(Boolean)
    
    return Buffer.from(parts.join(':')).toString('base64')
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''
    
    if (message.includes('rate limit') || stack.includes('rate limit')) {
      return ErrorCategory.RATE_LIMIT
    }
    if (message.includes('quota') || message.includes('billing')) {
      return ErrorCategory.QUOTA_EXCEEDED
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return ErrorCategory.AUTHENTICATION
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TIMEOUT
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION
    }
    if (message.includes('provider') || stack.includes('provider')) {
      return ErrorCategory.PROVIDER_ERROR
    }
    if (message.includes('model') || stack.includes('model')) {
      return ErrorCategory.MODEL_ERROR
    }
    if (message.includes('agent') || stack.includes('agent')) {
      return ErrorCategory.AGENT_ERROR
    }
    if (message.includes('cache') || stack.includes('cache')) {
      return ErrorCategory.CACHE_ERROR
    }
    if (message.includes('vector') || stack.includes('vector')) {
      return ErrorCategory.VECTOR_ERROR
    }
    if (message.includes('rag') || stack.includes('rag')) {
      return ErrorCategory.RAG_ERROR
    }
    
    return ErrorCategory.UNKNOWN
  }

  private getSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL
    }
    if (message.includes('quota') || message.includes('billing') || message.includes('payment')) {
      return ErrorSeverity.HIGH
    }
    if (message.includes('rate limit') || message.includes('timeout') || message.includes('auth')) {
      return ErrorSeverity.MEDIUM
    }
    
    return ErrorSeverity.LOW
  }
}

/**
 * Global error tracking instance
 */
let globalErrorTracker: ErrorTrackingManager | null = null

/**
 * Get global error tracker
 */
export function getErrorTracker(): ErrorTrackingManager {
  if (!globalErrorTracker) {
    globalErrorTracker = new ErrorTrackingManager()
  }
  return globalErrorTracker
}

/**
 * Track error helper
 */
export async function trackError(
  error: Error,
  context: Partial<ErrorContext> = {}
): Promise<void> {
  await getErrorTracker().trackError(error, context)
}

/**
 * Configure error tracking
 */
export function configureErrorTracking(config: {
  sentryDsn?: string
  webhookUrl?: string
  webhookHeaders?: Record<string, string>
}): void {
  const tracker = getErrorTracker()
  
  if (config.sentryDsn) {
    tracker.addHandler(new SentryErrorHandler(config.sentryDsn))
  }
  
  if (config.webhookUrl) {
    tracker.addHandler(new WebhookErrorHandler(config.webhookUrl, config.webhookHeaders))
  }
}