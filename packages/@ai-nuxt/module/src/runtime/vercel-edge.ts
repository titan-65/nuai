/**
 * Vercel Edge Runtime entry for AI Nuxt
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  initializeTelemetry, 
  OpenAIEdgeProvider, 
  createEdgeCache,
  getMetrics,
  trackError 
} from '@ai-nuxt/core'

// Global AI Nuxt instance for Vercel Edge
let aiNuxtInitialized = false

/**
 * Initialize AI Nuxt for Vercel Edge Runtime
 */
async function initializeAINuxt() {
  if (aiNuxtInitialized) return

  try {
    // Initialize telemetry with Vercel-specific config
    await initializeTelemetry({
      serviceName: process.env.AI_NUXT_SERVICE_NAME || 'ai-nuxt-vercel-edge',
      serviceVersion: process.env.AI_NUXT_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      enableAutoInstrumentation: false, // Disabled for edge
      enableMetrics: true,
      enableTracing: true,
      sampleRate: parseFloat(process.env.AI_NUXT_SAMPLE_RATE || '0.2')
    })

    // Initialize providers
    if (process.env.OPENAI_API_KEY) {
      const openaiProvider = new OpenAIEdgeProvider({
        apiKey: process.env.OPENAI_API_KEY,
        maxConcurrency: 12,
        timeout: 25000
      })
      
      // Register provider globally
      globalThis.__AI_NUXT_PROVIDERS__ = {
        ...globalThis.__AI_NUXT_PROVIDERS__,
        openai: openaiProvider
      }
    }

    // Initialize edge cache with Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv')
      const cache = createEdgeCache('vercel', {
        kv,
        ttl: parseInt(process.env.AI_NUXT_CACHE_TTL || '7200')
      })
      
      globalThis.__AI_NUXT_CACHE__ = cache
    }

    aiNuxtInitialized = true
    console.log('AI Nuxt initialized for Vercel Edge Runtime')
  } catch (error) {
    console.error('Failed to initialize AI Nuxt:', error)
    await trackError(error as Error, {
      platform: 'vercel-edge',
      operation: 'initialization'
    })
  }
}

/**
 * Main edge function handler
 */
export default async function handler(request: NextRequest): Promise<NextResponse> {
  // Initialize AI Nuxt
  await initializeAINuxt()

  const { pathname } = request.nextUrl
  const startTime = Date.now()

  try {
    // Handle AI API routes
    if (pathname.startsWith('/api/ai/')) {
      return await handleAIRequest(request)
    }

    // Handle monitoring routes
    if (pathname.startsWith('/api/monitoring/')) {
      return await handleMonitoringRequest(request)
    }

    // Default response
    return NextResponse.json({ 
      message: 'AI Nuxt Vercel Edge Runtime',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Track error
    await trackError(error as Error, {
      platform: 'vercel-edge',
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
      'vercel-edge',
      'edge',
      request.method,
      duration,
      undefined,
      undefined,
      true
    )

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * Handle AI API requests
 */
async function handleAIRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const path = pathname.replace('/api/ai/', '')

  switch (path) {
    case 'chat':
      return await handleChatRequest(request)
    case 'completion':
      return await handleCompletionRequest(request)
    case 'embedding':
      return await handleEmbeddingRequest(request)
    case 'health':
      return await handleHealthRequest(request)
    default:
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
}

/**
 * Handle chat requests
 */
async function handleChatRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }

  try {
    const body = await request.json()
    const { messages, model, temperature, maxTokens, stream } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return NextResponse.json(
        { error: 'OpenAI provider not configured' },
        { status: 500 }
      )
    }

    const response = await provider.chat(messages, {
      model,
      temperature,
      maxTokens,
      stream
    })

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle completion requests
 */
async function handleCompletionRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }

  try {
    const body = await request.json()
    const { prompt, model, temperature, maxTokens } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return NextResponse.json(
        { error: 'OpenAI provider not configured' },
        { status: 500 }
      )
    }

    const response = await provider.completion(prompt, {
      model,
      temperature,
      maxTokens
    })

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle embedding requests
 */
async function handleEmbeddingRequest(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  }

  try {
    const body = await request.json()
    const { input, model } = body

    const provider = globalThis.__AI_NUXT_PROVIDERS__?.openai
    if (!provider) {
      return NextResponse.json(
        { error: 'OpenAI provider not configured' },
        { status: 500 }
      )
    }

    const response = await provider.embedding(input, { model })

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle health check requests
 */
async function handleHealthRequest(request: NextRequest): Promise<NextResponse> {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: 'vercel-edge',
    runtime: 'edge',
    providers: {
      openai: !!globalThis.__AI_NUXT_PROVIDERS__?.openai
    },
    cache: !!globalThis.__AI_NUXT_CACHE__,
    region: process.env.VERCEL_REGION || 'unknown'
  }

  return NextResponse.json(health)
}

/**
 * Handle monitoring requests
 */
async function handleMonitoringRequest(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const path = pathname.replace('/api/monitoring/', '')

  switch (path) {
    case 'health':
      return await handleHealthRequest(request)
    case 'metrics':
      return await handleMetricsRequest(request)
    default:
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
}

/**
 * Handle metrics requests
 */
async function handleMetricsRequest(request: NextRequest): Promise<NextResponse> {
  try {
    const metrics = {
      platform: 'vercel-edge',
      runtime: 'edge',
      timestamp: new Date().toISOString(),
      region: process.env.VERCEL_REGION || 'unknown',
      // Add basic metrics here
      requests: 0, // Would be tracked in production
      errors: 0,
      latency: 0
    }

    return NextResponse.json(metrics)
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Edge runtime configuration
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1'], // Multi-region deployment
}

// Type declarations
declare global {
  var __AI_NUXT_PROVIDERS__: Record<string, any>
  var __AI_NUXT_CACHE__: any
}