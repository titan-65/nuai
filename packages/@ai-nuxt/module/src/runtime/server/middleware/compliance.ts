/**
 * Compliance middleware for automatic data tracking in AI operations
 */

import { complianceIntegration, type AIOperationContext } from '@ai-nuxt/core'
import type { IncomingMessage, ServerResponse } from 'http'

export interface ComplianceMiddlewareOptions {
  /** Enable compliance tracking */
  enabled: boolean
  /** Track all AI API requests */
  trackApiRequests: boolean
  /** Default retention period in days */
  defaultRetentionPeriod: number
  /** Require consent for PII processing */
  requireConsentForPII: boolean
  /** Automatically extract user context from requests */
  autoExtractContext: boolean
}

/**
 * Extract data subject information from request
 */
function extractDataSubject(req: IncomingMessage): {
  id: string
  email?: string
  userId?: string
  ipAddress?: string
  sessionId?: string
} {
  const headers = req.headers
  const ip = (headers['x-forwarded-for'] as string)?.split(',')[0] || 
             (headers['x-real-ip'] as string) || 
             req.socket.remoteAddress || 
             'unknown'

  // Extract user information from headers or session
  const userId = headers['x-user-id'] as string
  const email = headers['x-user-email'] as string
  const sessionId = headers['x-session-id'] as string || 
                   extractSessionFromCookie(headers.cookie as string)

  return {
    id: userId || sessionId || `ip_${ip}`,
    email,
    userId,
    ipAddress: ip,
    sessionId
  }
}

/**
 * Extract session ID from cookie
 */
function extractSessionFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  
  return cookies['session-id'] || cookies['sessionId'] || cookies['sid']
}

/**
 * Extract operation context from request
 */
function extractOperationContext(req: IncomingMessage, body?: any): AIOperationContext | null {
  const url = req.url || ''
  const method = req.method || 'GET'
  
  if (method !== 'POST') return null
  
  let operationType: AIOperationContext['operationType']
  let provider = 'unknown'
  let model = 'unknown'
  
  // Determine operation type from URL
  if (url.includes('/api/ai/chat')) {
    operationType = 'chat'
  } else if (url.includes('/api/ai/completion')) {
    operationType = 'completion'
  } else if (url.includes('/api/ai/embedding')) {
    operationType = 'embedding'
  } else if (url.includes('/api/ai/agents')) {
    operationType = 'agent'
  } else if (url.includes('/api/ai/tools')) {
    operationType = 'tool'
  } else {
    return null // Not an AI operation
  }
  
  // Extract provider and model from request body
  if (body) {
    provider = body.provider || provider
    model = body.model || model
  }
  
  const subject = extractDataSubject(req)
  
  return {
    subject,
    operationType,
    provider,
    model,
    sessionId: subject.sessionId,
    requestId: req.headers['x-request-id'] as string || `req_${Date.now()}`,
    ipAddress: subject.ipAddress,
    userAgent: req.headers['user-agent'],
    metadata: {
      url,
      method,
      timestamp: Date.now()
    }
  }
}

/**
 * Compliance tracking middleware
 */
export function createComplianceMiddleware(options: ComplianceMiddlewareOptions) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!options.enabled) {
      return next()
    }
    
    // Only track AI API requests if configured
    if (options.trackApiRequests && req.url?.includes('/api/ai/')) {
      try {
        // Capture request body for analysis
        let body = ''
        const originalWrite = res.write
        const originalEnd = res.end
        let responseBody = ''
        
        // Capture request body
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        
        req.on('end', async () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {}
            const context = extractOperationContext(req, parsedBody)
            
            if (context) {
              // Track input (prompt/message)
              const input = parsedBody.message || parsedBody.prompt || parsedBody.input
              if (input && typeof input === 'string') {
                await complianceIntegration.trackPrompt(input, context, {
                  retentionPeriod: options.defaultRetentionPeriod
                })
              }
              
              // Track conversation if it's a chat request
              if (context.operationType === 'chat' && parsedBody.messages) {
                await complianceIntegration.trackConversation(parsedBody.messages, context, {
                  retentionPeriod: options.defaultRetentionPeriod
                })
              }
            }
          } catch (error) {
            console.error('Compliance tracking error (request):', error)
          }
        })
        
        // Capture response body
        res.write = function(chunk: any, ...args: any[]) {
          if (chunk) {
            responseBody += chunk.toString()
          }
          return originalWrite.call(this, chunk, ...args)
        }
        
        res.end = function(chunk: any, ...args: any[]) {
          if (chunk) {
            responseBody += chunk.toString()
          }
          
          // Track response
          setTimeout(async () => {
            try {
              const parsedBody = body ? JSON.parse(body) : {}
              const context = extractOperationContext(req, parsedBody)
              
              if (context && responseBody) {
                try {
                  const parsedResponse = JSON.parse(responseBody)
                  const output = parsedResponse.content || parsedResponse.response || parsedResponse.result
                  
                  if (output && typeof output === 'string') {
                    await complianceIntegration.trackResponse(output, context, {
                      retentionPeriod: options.defaultRetentionPeriod
                    })
                  }
                } catch (parseError) {
                  // Response might not be JSON, track as-is if it's a string
                  if (typeof responseBody === 'string' && responseBody.length < 10000) {
                    await complianceIntegration.trackResponse(responseBody, context, {
                      retentionPeriod: options.defaultRetentionPeriod
                    })
                  }
                }
              }
            } catch (error) {
              console.error('Compliance tracking error (response):', error)
            }
          }, 0)
          
          return originalEnd.call(this, chunk, ...args)
        }
      } catch (error) {
        console.error('Compliance middleware error:', error)
      }
    }
    
    next()
  }
}

/**
 * Default compliance middleware with standard configuration
 */
export const complianceMiddleware = createComplianceMiddleware({
  enabled: true,
  trackApiRequests: true,
  defaultRetentionPeriod: 365,
  requireConsentForPII: true,
  autoExtractContext: true
})