import { defineEventHandler, getRequestURL, getMethod } from 'h3'
import { useRuntimeConfig } from '#nitro'

/**
 * Logger middleware for AI API routes
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Skip if logging is disabled
  if (!aiConfig.debug) {
    return
  }
  
  const start = Date.now()
  const method = getMethod(event)
  const url = getRequestURL(event)
  
  // Log request
  console.log(`🤖 [${new Date().toISOString()}] ${method} ${url.pathname} - Request started`)
  
  // Store original end method
  const originalEnd = event.node.res.end
  
  // Override end method to log response
  event.node.res.end = function (...args: any[]) {
    const duration = Date.now() - start
    const status = event.node.res.statusCode
    
    // Log response
    console.log(
      `🤖 [${new Date().toISOString()}] ${method} ${url.pathname} - ${status} - ${duration}ms`
    )
    
    // Call original end method
    return originalEnd.apply(this, args)
  }
})