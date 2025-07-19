import { defineEventHandler, createError, getMethod, readBody } from 'h3'
import { useRuntimeConfig } from '#nitro'

// Simple prompt injection patterns
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|above)\s+instructions/i,
  /forget\s+(?:all\s+)?(?:previous|above)\s+instructions/i,
  /system:\s*you\s+are/i,
  /\[system\]/i,
  /\<\|system\|\>/i,
  /\<\|im_start\|\>/i
]

// Simple PII patterns
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g
}

/**
 * Security middleware for AI API routes
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Skip if security features are disabled
  if (!aiConfig.security) {
    return
  }
  
  // Only process POST requests
  const method = getMethod(event)
  if (method !== 'POST') {
    return
  }
  
  try {
    // Get request body
    const body = event.context.body || await readBody(event)
    
    // Store the body back for later middleware/handlers
    event.context.body = body
    
    // Check for prompt injection if enabled
    if (aiConfig.security.promptInjectionDetection) {
      const content = extractContent(body)
      
      if (content && detectPromptInjection(content)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: 'Potential prompt injection detected'
        })
      }
    }
    
    // Scrub PII if enabled
    if (aiConfig.security.piiScrubbing) {
      const scrubbedBody = scrubPII(body)
      event.context.body = scrubbedBody
    }
    
    // Content filtering if enabled
    if (aiConfig.security.contentFiltering) {
      const content = extractContent(body)
      
      if (content && detectInappropriateContent(content)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: 'Content policy violation detected'
        })
      }
    }
  } catch (error: any) {
    // Only throw if it's our error
    if (error.statusCode) {
      throw error
    }
    // Otherwise continue
  }
})

/**
 * Extract content from request body
 */
function extractContent(body: any): string | null {
  if (!body) return null
  
  // Extract from messages array
  if (body.messages && Array.isArray(body.messages)) {
    return body.messages
      .map((m: any) => m.content || '')
      .join(' ')
  }
  
  // Extract from prompt
  if (body.prompt && typeof body.prompt === 'string') {
    return body.prompt
  }
  
  // Extract from input
  if (body.input) {
    if (typeof body.input === 'string') {
      return body.input
    }
    if (Array.isArray(body.input)) {
      return body.input.join(' ')
    }
  }
  
  return null
}

/**
 * Detect potential prompt injection
 */
function detectPromptInjection(content: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Scrub PII from request body
 */
function scrubPII(body: any): any {
  if (!body) return body
  
  // Create a deep copy to avoid modifying the original
  const copy = JSON.parse(JSON.stringify(body))
  
  // Process messages
  if (copy.messages && Array.isArray(copy.messages)) {
    copy.messages = copy.messages.map((message: any) => {
      if (message.content && typeof message.content === 'string') {
        message.content = scrubPIIFromString(message.content)
      }
      return message
    })
  }
  
  // Process prompt
  if (copy.prompt && typeof copy.prompt === 'string') {
    copy.prompt = scrubPIIFromString(copy.prompt)
  }
  
  // Process input
  if (copy.input) {
    if (typeof copy.input === 'string') {
      copy.input = scrubPIIFromString(copy.input)
    } else if (Array.isArray(copy.input)) {
      copy.input = copy.input.map((item: string) => 
        typeof item === 'string' ? scrubPIIFromString(item) : item
      )
    }
  }
  
  return copy
}

/**
 * Scrub PII from a string
 */
function scrubPIIFromString(text: string): string {
  let result = text
  
  // Replace each PII type
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    result = result.replace(pattern, `[${type.toUpperCase()}]`)
  }
  
  return result
}

/**
 * Simple content filtering
 * In a real implementation, this would be more sophisticated
 */
function detectInappropriateContent(content: string): boolean {
  const lowercased = content.toLowerCase()
  
  // Very basic inappropriate content detection
  // In production, you'd use a more sophisticated approach
  const inappropriateWords = [
    'hate', 'violence', 'harmful'
  ]
  
  return inappropriateWords.some(word => lowercased.includes(word))
}