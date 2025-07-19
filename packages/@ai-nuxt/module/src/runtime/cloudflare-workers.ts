/**
 * Cloudflare Workers runtime entry for AI Nuxt
 */

import { 
  initializeTelemetry, 
  OpenAIEdgeProvider, 
  createEdgeCache,
  getMetrics,
  trackError 
} from '@ai-nuxt/core'

// Global AI Nuxt instance for Cloudflare Workers
let aiNuxtInitialized = false

/**
 * Initialize AI Nuxt for Cloudflare Workers
 */
async function initializeAINuxt(env: any) {
  if (aiNuxtInitialized) return

  try {
    // Initialize telemetry with Cloudflare-specific config
    await initializeTelemetry({
      serviceName: env.AI_NUXT_SERVICE_NAME || 'ai-nuxt-cf-worker',
      serviceVersion: env.AI_NUXT_VERSION || '1.0.0',
      environment: env.NODE_ENV || 'production',
      enableAutoInstrumentation: false, // Disabled for edge
      enableMetrics: true,
      enableTracing: true,
      sampleRate: parseFloat(env.AI_NUXT_SAMPLE_RATE || '0.1')
    })

    // Initialize providers
    if (env.OPENAI_API_KEY) {
      const openaiProvider = new OpenAIEdgeProvider({
        apiKey: env.OPENAI_API_KEY,
        maxConcurrency: 10,
        timeout: 25000
      })
      
      // Register provider globally
      globalThis.__AI_NUXT_PROVIDERS__ = {
        ...globalThis.__AI_NUXT_PROVIDERS__,
        openai: openaiProvider
      }
    }

    // Initialize edge cache
    if (env.AI_NUXT_CACHE) {
      const cache = createEdgeCache('cloudflare', {
        namespace: env.AI_NUXT_CACHE,
        ttl: parseInt(env.AI_NUXT_CACHE_TTL || '3600')
      })
      
      globalThis.__AI_NUXT_CACHE__ = cache
    }

    aiNuxtInitialized = true
    console.log('AI Nuxt initialized for Cloudflare Workers')
  } catch (error) {
    console.error('Failed to initialize AI Nuxt:', error)
    await trackError(error as Error, {
      platform: 'cloudflare-workers',
      operation: 'initialization'
    })
  }
}

/**
 * Cloudflare Workers fetch handler
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Initialize AI Nuxt
    await initializeAINuxt(env)

    const url = new URL(request.url)
    const startTime = Date.now()

    try {
      // Handle AI API routes
      if (url.pathname.startsWith('/api/ai/')) {
        return await handleAIRequest(request, env, ctx)
      }

      // Handle monitoring routes
      if (url.pathname.startsWith('/api/monitoring/')) {
        return await handleMonitoringRequest(request, env, ctx)
      }

      // Default response
      return new Response('AI Nuxt Cloudflare Worker', {
        headers: { 'Content-Type': 'text/plain' }
      })
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Track error
      await trackError(error as Error, {
        platform: 'cloudflare-workers',
        operation: 'request',
        metadata: {
          method: request.method,
          url: request.url,
          duration
        }
      })

      // Record error metrics
      const metrics = getMetrics()
      metrics.recordRequest(
        'cloudflare-workers',
        'edge',
        request.method,
        duration,
        undefined,
        undefined,
        true
      )

      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }
}

/**
 * Handle AI API requests
 */
async function handleAIRequest(
  request: Request, 
  env: any, 
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/ai/', '')

  switch (path) {
    case 'chat':
      return await handleChatRequest(request, env)
    case 'completion':
      return await handleCompletionRequest(request, env)
    case 'embedding':
      return await handleEmbeddingRequest(request, env)
    case 'health':
      return await handleHealthRequest(request, env)
    default:
      return new Response('Not Found', { status: 404 })
  }
}

/**
 * Handle chat requests
 */
async function handleChatRequest(request: Request, env: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const body = await request.json()
    const { messages, model, temperature, maxTokens, stream } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response('OpenAI provider not configured', { status: 500 })
    }

    const response = await provider.chat(messages, {
      model,
      temperature,
      maxTokens,
      stream
    })

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle completion requests
 */
async function handleCompletionRequest(request: Request, env: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const body = await request.json()
    const { prompt, model, temperature, maxTokens } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response('OpenAI provider not configured', { status: 500 })
    }

    const response = await provider.completion(prompt, {
      model,
      temperature,
      maxTokens
    })

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle embedding requests
 */
async function handleEmbeddingRequest(request: Request, env: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const body = await request.json()
    const { input, model } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response('OpenAI provider not configured', { status: 500 })
    }

    const response = await provider.embedding(input, { model })

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle health check requests
 */
async function handleHealthRequest(request: Request, env: any): Promise<Response> {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'cloudflare-workers',
    providers: {
      openai: !!globalThis.__AI_NUXT_PROVIDERS__?.openai
    },
    cache: !!globalThis.__AI_NUXT_CACHE__
  }

  return new Response(JSON.stringify(health), {
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Handle monitoring requests
 */
async function handleMonitoringRequest(
  request: Request, 
  env: any, 
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/monitoring/', '')

  switch (path) {
    case 'health':
      return await handleHealthRequest(request, env)
    case 'metrics':
      return await handleMetricsRequest(request, env)
    default:
      return new Response('Not Found', { status: 404 })
  }
}

/**
 * Handle metrics requests
 */
async function handleMetricsRequest(request: Request, env: any): Promise<Response> {
  try {
    const metrics = {
      platform: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
      // Add basic metrics here
      requests: 0, // Would be tracked in production
      errors: 0,
      latency: 0
    }

    return new Response(JSON.stringify(metrics), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Type declarations for Cloudflare Workers
declare global {
  var __AI_NUXT_PROVIDERS__: Record<string, any>
  var __AI_NUXT_CACHE__: any
}

// Export types for TypeScript support
export type CloudflareWorkerEnv = {
  AI_NUXT_SERVICE_NAME?: string
  AI_NUXT_VERSION?: string
  AI_NUXT_SAMPLE_RATE?: string
  AI_NUXT_CACHE_TTL?: string
  OPENAI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  AI_NUXT_CACHE?: KVNamespace
  [key: string]: any
}