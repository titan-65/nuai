import { defineEventHandler, getRequestURL, getMethod, readBody } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { hash as ohash } from 'ohash'

interface CacheEntry {
  data: any
  expiresAt: number
}

// Simple in-memory cache
// In production, you'd want to use Redis or another distributed cache
const cache = new Map<string, CacheEntry>()

/**
 * Cache middleware for AI API routes
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Skip if caching is disabled
  if (!aiConfig.caching?.enabled) {
    return
  }
  
  // Only cache GET and POST requests
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'POST') {
    return
  }
  
  // Skip caching for streaming requests
  const url = getRequestURL(event)
  if (url.pathname.includes('/stream')) {
    return
  }
  
  // Generate cache key based on URL and request body
  let cacheKey: string
  
  if (method === 'GET') {
    cacheKey = ohash(url.toString())
  } else {
    // For POST, include the request body in the cache key
    try {
      const body = await readBody(event)
      cacheKey = ohash({ url: url.toString(), body })
      
      // Store the body back for later middleware/handlers
      event.context.body = body
    } catch (error) {
      // If we can't read the body, don't cache
      return
    }
  }
  
  // Check if we have a cached response
  const cachedEntry = cache.get(cacheKey)
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    // Return cached response
    event.node.res.setHeader('X-Cache', 'HIT')
    return cachedEntry.data
  }
  
  // Mark cache as missed
  event.node.res.setHeader('X-Cache', 'MISS')
  
  // Store original response end method
  const originalEnd = event.node.res.end
  
  // Override response to capture and cache it
  event.node.res.end = function (data: any, ...args: any[]) {
    // Only cache successful responses
    if (event.node.res.statusCode >= 200 && event.node.res.statusCode < 300) {
      try {
        // Parse the data if it's JSON
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        
        // Store in cache
        const ttl = aiConfig.caching?.ttl || 3600 // Default 1 hour
        cache.set(cacheKey, {
          data: parsed,
          expiresAt: Date.now() + (ttl * 1000)
        })
      } catch (error) {
        // If we can't parse the response, don't cache it
      }
    }
    
    // Call original end method
    return originalEnd.call(this, data, ...args)
  }
})