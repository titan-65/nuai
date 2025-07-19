/**
 * Netlify Edge Functions entry for AI Nuxt
 */

import { 
  initializeTelemetry, 
  OpenAIEdgeProvider, 
  createEdgeCache,
  getMetrics,
  trackError 
} from '@ai-nuxt/core'

// Global AI Nuxt instance for Netlify Edge
let aiNuxtInitialized = false

/**
 * Initialize AI Nuxt for Netlify Edge Functions
 */
async function initializeAINuxt(context: any) {
  if (aiNuxtInitialized) return

  try {
    // Initialize telemetry with Netlify-specific config
    await initializeTelemetry({
      serviceName: Deno.env.get('AI_NUXT_SERVICE_NAME') || 'ai-nuxt-netlify-edge',
      serviceVersion: Deno.env.get('AI_NUXT_VERSION') || '1.0.0',
      environment: Deno.env.get('NODE_ENV') || 'production',
      enableAutoInstrumentation: false, // Disabled for edge
      enableMetrics: true,
      enableTracing: true,
      sampleRate: parseFloat(Deno.env.get('AI_NUXT_SAMPLE_RATE') || '0.15')
    })

    // Initialize providers
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (openaiApiKey) {
      const openaiProvider = new OpenAIEdgeProvider({
        apiKey: openaiApiKey,
        maxConcurrency: 8,
        timeout: 20000
      })
      
      // Register provider globally
      globalThis.__AI_NUXT_PROVIDERS__ = {
        ...globalThis.__AI_NUXT_PROVIDERS__,
        openai: openaiProvider
      }
    }

    // Initialize edge cache with Netlify Blobs
    const siteId = Deno.env.get('NETLIFY_SITE_ID')
    const token = Deno.env.get('NETLIFY_TOKEN')
    
    if (siteId && token) {
      // In a real implementation, this would use Netlify Blobs SDK
      const cache = createEdgeCache('netlify', {
        siteId,
        token,
        ttl: parseInt(Deno.env.get('AI_NUXT_CACHE_TTL') || '5400')
      })
      
      globalThis.__AI_NUXT_CACHE__ = cache
    }

    aiNuxtInitialized = true
    console.log('AI Nuxt initialized for Netlify Edge Functions')
  } catch (error) {
    console.error('Failed to initialize AI Nuxt:', error)
    await trackError(error as Error, {
      platform: 'netlify-edge',
      operation: 'initialization'
    })
  }
}

/**
 * Main edge function handler
 */
export default async function handler(request: Request, context: any): Promise<Response> {
  // Initialize AI Nuxt
  await initializeAINuxt(context)

  const url = new URL(request.url)
  const startTime = Date.now()

  try {
    // Handle AI API routes
    if (url.pathname.startsWith('/api/ai/')) {
      return await handleAIRequest(request, context)
    }

    // Handle monitoring routes
    if (url.pathname.startsWith('/api/monitoring/')) {
      return await handleMonitoringRequest(request, context)
    }

    // Default response
    return new Response(JSON.stringify({
      message: 'AI Nuxt Netlify Edge Function',
      timestamp: new Date().toISOString(),
      geo: context.geo || {}
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Track error
    await trackError(error as Error, {
      platform: 'netlify-edge',
      operation: 'request',
      metadata: {
        method: request.method,
        url: request.url,
        duration,
        geo: context.geo
      }
    })

    // Record error metrics
    const metrics = getMetrics()
    metrics.recordRequest(
      'netlify-edge',
      'edge',
      request.method,
      duration,
      undefined,
      undefined,
      true
    )

    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle AI API requests
 */
async function handleAIRequest(request: Request, context: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/ai/', '')

  switch (path) {
    case 'chat':
      return await handleChatRequest(request, context)
    case 'completion':
      return await handleCompletionRequest(request, context)
    case 'embedding':
      return await handleEmbeddingRequest(request, context)
    case 'health':
      return await handleHealthRequest(request, context)
    default:
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
  }
}

/**
 * Handle chat requests
 */
async function handleChatRequest(request: Request, context: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { messages, model, temperature, maxTokens, stream } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response(JSON.stringify({ error: 'OpenAI provider not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
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
async function handleCompletionRequest(request: Request, context: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { prompt, model, temperature, maxTokens } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response(JSON.stringify({ error: 'OpenAI provider not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
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
async function handleEmbeddingRequest(request: Request, context: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json()
    const { input, model } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return new Response(JSON.stringify({ error: 'OpenAI provider not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
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
async function handleHealthRequest(request: Request, context: any): Promise<Response> {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'netlify-edge',
    runtime: 'deno',
    providers: {
      openai: !!globalThis.__AI_NUXT_PROVIDERS__?.openai
    },
    cache: !!globalThis.__AI_NUXT_CACHE__,
    geo: context.geo || {},
    site: {
      id: Deno.env.get('NETLIFY_SITE_ID'),
      name: Deno.env.get('NETLIFY_SITE_NAME')
    }
  }

  return new Response(JSON.stringify(health), {
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Handle monitoring requests
 */
async function handleMonitoringRequest(request: Request, context: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/monitoring/', '')

  switch (path) {
    case 'health':
      return await handleHealthRequest(request, context)
    case 'metrics':
      return await handleMetricsRequest(request, context)
    default:
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
  }
}

/**
 * Handle metrics requests
 */
async function handleMetricsRequest(request: Request, context: any): Promise<Response> {
  try {
    const metrics = {
      platform: 'netlify-edge',
      runtime: 'deno',
      timestamp: new Date().toISOString(),
      geo: context.geo || {},
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

// Edge function configuration
export const config = {
  path: '/api/ai/*'
}

// Type declarations
declare global {
  var __AI_NUXT_PROVIDERS__: Record<string, any>
  var __AI_NUXT_CACHE__: any
}