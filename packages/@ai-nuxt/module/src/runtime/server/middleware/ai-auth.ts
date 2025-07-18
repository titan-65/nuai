import { defineEventHandler, createError, getHeader } from 'h3'
import { useRuntimeConfig } from '#nitro'

/**
 * Authentication middleware for AI API routes
 */
export default defineEventHandler(async (event) => {
  // Only apply to AI API routes
  if (!event.node.req.url?.startsWith('/api/ai/')) {
    return
  }
  
  const config = useRuntimeConfig()
  
  // Skip auth if not configured
  if (!config.aiNuxt.security?.requireAuth) {
    return
  }
  
  // Check for API key in headers
  const apiKey = getHeader(event, 'x-api-key') || getHeader(event, 'authorization')?.replace('Bearer ', '')
  
  if (!apiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'API key required'
    })
  }
  
  // Validate API key
  const validApiKeys = config.aiNuxt.security.apiKeys || []
  if (!validApiKeys.includes(apiKey)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid API key'
    })
  }
  
  // Add user context to event
  event.context.user = {
    apiKey,
    authenticated: true
  }
})