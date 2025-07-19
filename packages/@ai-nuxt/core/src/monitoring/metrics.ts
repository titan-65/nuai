import { getTelemetry } from './telemetry'
import type { Meter, Counter, Histogram, UpDownCounter } from '@opentelemetry/api'

/**
 * AI-specific metrics
 */
export interface AIMetrics {
  // Request metrics
  requestsTotal: Counter
  requestDuration: Histogram
  requestErrors: Counter
  
  // Token metrics
  tokensUsed: Histogram
  tokensInput: Histogram
  tokensOutput: Histogram
  
  // Cost metrics
  requestCost: Histogram
  totalCost: Counter
  
  // Provider metrics
  providerRequests: Counter
  providerErrors: Counter
  providerLatency: Histogram
  
  // Model metrics
  modelRequests: Counter
  modelTokens: Histogram
  modelCost: Histogram
  
  // Cache metrics
  cacheHits: Counter
  cacheMisses: Counter
  cacheSize: UpDownCounter
  
  // Agent metrics
  agentExecutions: Counter
  agentDuration: Histogram
  agentErrors: Counter
  
  // RAG metrics
  ragQueries: Counter
  ragRetrievals: Histogram
  ragLatency: Histogram
  
  // Vector store metrics
  vectorOperations: Counter
  vectorSearchLatency: Histogram
  vectorIndexSize: UpDownCounter
}

/**
 * Metrics manager
 */
export class MetricsManager {
  private meter: Meter
  private metrics: AIMetrics

  constructor() {
    this.meter = getTelemetry().getMeter()
    this.metrics = this.createMetrics()
  }

  /**
   * Create all AI metrics
   */
  private createMetrics(): AIMetrics {
    return {
      // Request metrics
      requestsTotal: this.meter.createCounter('ai_requests_total', {
        description: 'Total number of AI requests'
      }),
      
      requestDuration: this.meter.createHistogram('ai_request_duration_ms', {
        description: 'Duration of AI requests in milliseconds',
        boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
      }),
      
      requestErrors: this.meter.createCounter('ai_request_errors_total', {
        description: 'Total number of AI request errors'
      }),

      // Token metrics
      tokensUsed: this.meter.createHistogram('ai_tokens_used', {
        description: 'Number of tokens used in AI operations',
        boundaries: [1, 10, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000]
      }),
      
      tokensInput: this.meter.createHistogram('ai_tokens_input', {
        description: 'Number of input tokens in AI operations',
        boundaries: [1, 10, 50, 100, 250, 500, 1000, 2000, 4000, 8000]
      }),
      
      tokensOutput: this.meter.createHistogram('ai_tokens_output', {
        description: 'Number of output tokens in AI operations',
        boundaries: [1, 10, 50, 100, 250, 500, 1000, 2000, 4000, 8000]
      }),

      // Cost metrics
      requestCost: this.meter.createHistogram('ai_request_cost_usd', {
        description: 'Cost of AI requests in USD',
        boundaries: [0.001, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
      }),
      
      totalCost: this.meter.createCounter('ai_total_cost_usd', {
        description: 'Total cost of AI operations in USD'
      }),

      // Provider metrics
      providerRequests: this.meter.createCounter('ai_provider_requests_total', {
        description: 'Total requests per AI provider'
      }),
      
      providerErrors: this.meter.createCounter('ai_provider_errors_total', {
        description: 'Total errors per AI provider'
      }),
      
      providerLatency: this.meter.createHistogram('ai_provider_latency_ms', {
        description: 'Latency per AI provider in milliseconds'
      }),

      // Model metrics
      modelRequests: this.meter.createCounter('ai_model_requests_total', {
        description: 'Total requests per AI model'
      }),
      
      modelTokens: this.meter.createHistogram('ai_model_tokens', {
        description: 'Tokens used per AI model'
      }),
      
      modelCost: this.meter.createHistogram('ai_model_cost_usd', {
        description: 'Cost per AI model in USD'
      }),

      // Cache metrics
      cacheHits: this.meter.createCounter('ai_cache_hits_total', {
        description: 'Total cache hits'
      }),
      
      cacheMisses: this.meter.createCounter('ai_cache_misses_total', {
        description: 'Total cache misses'
      }),
      
      cacheSize: this.meter.createUpDownCounter('ai_cache_size', {
        description: 'Current cache size'
      }),

      // Agent metrics
      agentExecutions: this.meter.createCounter('ai_agent_executions_total', {
        description: 'Total agent executions'
      }),
      
      agentDuration: this.meter.createHistogram('ai_agent_duration_ms', {
        description: 'Agent execution duration in milliseconds'
      }),
      
      agentErrors: this.meter.createCounter('ai_agent_errors_total', {
        description: 'Total agent execution errors'
      }),

      // RAG metrics
      ragQueries: this.meter.createCounter('ai_rag_queries_total', {
        description: 'Total RAG queries'
      }),
      
      ragRetrievals: this.meter.createHistogram('ai_rag_retrievals', {
        description: 'Number of documents retrieved per RAG query'
      }),
      
      ragLatency: this.meter.createHistogram('ai_rag_latency_ms', {
        description: 'RAG query latency in milliseconds'
      }),

      // Vector store metrics
      vectorOperations: this.meter.createCounter('ai_vector_operations_total', {
        description: 'Total vector store operations'
      }),
      
      vectorSearchLatency: this.meter.createHistogram('ai_vector_search_latency_ms', {
        description: 'Vector search latency in milliseconds'
      }),
      
      vectorIndexSize: this.meter.createUpDownCounter('ai_vector_index_size', {
        description: 'Current vector index size'
      })
    }
  }

  /**
   * Record AI request metrics
   */
  recordRequest(
    provider: string,
    model: string,
    operation: string,
    duration: number,
    tokens?: { input?: number; output?: number; total?: number },
    cost?: number,
    error?: boolean
  ): void {
    const labels = { provider, model, operation }

    // Record basic request metrics
    this.metrics.requestsTotal.add(1, labels)
    this.metrics.requestDuration.record(duration, labels)
    
    if (error) {
      this.metrics.requestErrors.add(1, labels)
    }

    // Record provider metrics
    this.metrics.providerRequests.add(1, { provider })
    this.metrics.providerLatency.record(duration, { provider })
    
    if (error) {
      this.metrics.providerErrors.add(1, { provider })
    }

    // Record model metrics
    this.metrics.modelRequests.add(1, { model })

    // Record token metrics
    if (tokens) {
      if (tokens.total) {
        this.metrics.tokensUsed.record(tokens.total, labels)
        this.metrics.modelTokens.record(tokens.total, { model })
      }
      if (tokens.input) {
        this.metrics.tokensInput.record(tokens.input, labels)
      }
      if (tokens.output) {
        this.metrics.tokensOutput.record(tokens.output, labels)
      }
    }

    // Record cost metrics
    if (cost) {
      this.metrics.requestCost.record(cost, labels)
      this.metrics.totalCost.add(cost, labels)
      this.metrics.modelCost.record(cost, { model })
    }
  }

  /**
   * Record cache metrics
   */
  recordCache(hit: boolean, cacheType: string): void {
    const labels = { cache_type: cacheType }
    
    if (hit) {
      this.metrics.cacheHits.add(1, labels)
    } else {
      this.metrics.cacheMisses.add(1, labels)
    }
  }

  /**
   * Update cache size
   */
  updateCacheSize(size: number, cacheType: string): void {
    this.metrics.cacheSize.add(size, { cache_type: cacheType })
  }

  /**
   * Record agent execution
   */
  recordAgentExecution(
    agentName: string,
    agentType: string,
    duration: number,
    error?: boolean
  ): void {
    const labels = { agent_name: agentName, agent_type: agentType }

    this.metrics.agentExecutions.add(1, labels)
    this.metrics.agentDuration.record(duration, labels)
    
    if (error) {
      this.metrics.agentErrors.add(1, labels)
    }
  }

  /**
   * Record RAG query
   */
  recordRAGQuery(
    retrievalCount: number,
    latency: number,
    error?: boolean
  ): void {
    this.metrics.ragQueries.add(1)
    this.metrics.ragRetrievals.record(retrievalCount)
    this.metrics.ragLatency.record(latency)
  }

  /**
   * Record vector store operation
   */
  recordVectorOperation(
    operation: string,
    latency?: number,
    indexSize?: number
  ): void {
    this.metrics.vectorOperations.add(1, { operation })
    
    if (latency) {
      this.metrics.vectorSearchLatency.record(latency, { operation })
    }
    
    if (indexSize !== undefined) {
      this.metrics.vectorIndexSize.add(indexSize)
    }
  }

  /**
   * Get metrics instance
   */
  getMetrics(): AIMetrics {
    return this.metrics
  }
}

/**
 * Global metrics instance
 */
let globalMetrics: MetricsManager | null = null

/**
 * Get global metrics instance
 */
export function getMetrics(): MetricsManager {
  if (!globalMetrics) {
    globalMetrics = new MetricsManager()
  }
  return globalMetrics
}

/**
 * Helper functions for common metrics
 */
export const metrics = {
  /**
   * Record AI request
   */
  recordRequest: (
    provider: string,
    model: string,
    operation: string,
    duration: number,
    tokens?: { input?: number; output?: number; total?: number },
    cost?: number,
    error?: boolean
  ) => {
    getMetrics().recordRequest(provider, model, operation, duration, tokens, cost, error)
  },

  /**
   * Record cache hit/miss
   */
  recordCache: (hit: boolean, cacheType: string) => {
    getMetrics().recordCache(hit, cacheType)
  },

  /**
   * Update cache size
   */
  updateCacheSize: (size: number, cacheType: string) => {
    getMetrics().updateCacheSize(size, cacheType)
  },

  /**
   * Record agent execution
   */
  recordAgent: (agentName: string, agentType: string, duration: number, error?: boolean) => {
    getMetrics().recordAgentExecution(agentName, agentType, duration, error)
  },

  /**
   * Record RAG query
   */
  recordRAG: (retrievalCount: number, latency: number, error?: boolean) => {
    getMetrics().recordRAGQuery(retrievalCount, latency, error)
  },

  /**
   * Record vector operation
   */
  recordVector: (operation: string, latency?: number, indexSize?: number) => {
    getMetrics().recordVectorOperation(operation, latency, indexSize)
  }
}