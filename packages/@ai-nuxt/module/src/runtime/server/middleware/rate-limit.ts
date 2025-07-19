import { defineEventHandler, createError } from 'h3'
import { useRuntimeConfig } from '#nitro'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

// Simple in-memory store for rate limiting
// In production, you'd want to use Redis or another distributed store
const store: RateLimitStore = {}

/**
 * Rate limiting middleware for AI API routes
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Skip if rate limiting is disabled
  if (!aiConfig.security?.rateLimit?.enabled) {
    return
  }
  
  // Get client identifier (IP address or API key)
  const clientIp = event.node.req.headers['x-forwarded-for'] || 
                  event.node.req.socket.remoteAddress || 
                  'unknown'
  
  const apiKey = event.node.req.headers['x-api-key'] || 'anonymous'
  
  // Use API key if available, otherwise use IP
  const clientId = typeof apiKey === 'string' && apiKey !== 'anonymous' 
    ? apiKey 
    : String(clientIp)
  
  // Get rate limit settings
  const maxRequests = aiConfig.security?.rateLimit?.maxRequests || 60
  const windowMs = aiConfig.security?.rateLimit?.windowMs || 60000 // 1 minute default
  
  const now = Date.now()
  
  // Initialize or get current client's rate limit data
  if (!store[clientId]) {
    store[clientId] = {
      count: 0,
      resetAt: now + windowMs
    }
  }
  
  // Reset counter if time window has passed
  if (now > store[clientId].resetAt) {
    store[clientId] = {
      count: 0,
      resetAt: now + windowMs
    }
  }
  
  // Increment request count
  store[clientId].count++
  
  // Check if rate limit is exceeded
  if (store[clientId].count > maxRequests) {
    // Calculate remaining time until reset
    const resetIn = Math.ceil((store[clientId].resetAt - now) / 1000)
    
    // Set rate limit headers
    event.node.res.setHeader('X-RateLimit-Limit', maxRequests.toString())
    event.node.res.setHeader('X-RateLimit-Remaining', '0')
    event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(store[clientId].resetAt / 1000).toString())
    event.node.res.setHeader('Retry-After', resetIn.toString())
    
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${resetIn} seconds.`
    })
  }
  
  // Set rate limit headers
  event.node.res.setHeader('X-RateLimit-Limit', maxRequests.toString())
  event.node.res.setHeader('X-RateLimit-Remaining', (maxRequests - store[clientId].count).toString())
  event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(store[clientId].resetAt / 1000).toString())
})