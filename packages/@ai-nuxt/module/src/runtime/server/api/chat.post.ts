import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import { APIValidator } from '../utils/validation'
import type { ChatOptions } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const config = useRuntimeConfig()
  
  try {
    const body = await readBody(event)
    
    // Validate request body
    const validation = APIValidator.validateChatRequest(body)
    if (!validation.valid) {
      APIValidator.throwValidationError(validation.errors)
    }
    
    // Validate provider
    const providerValidation = APIValidator.validateProvider(body.provider)
    if (!providerValidation.valid) {
      APIValidator.throwValidationError(providerValidation.errors)
    }
    
    // Extract options from request body
    const {
      messages,
      provider: providerId,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      ...otherOptions
    } = body as ChatOptions & { provider?: string }
    
    // Get AI provider
    let aiProvider
    try {
      aiProvider = providerId 
        ? getProvider(providerId) 
        : getDefaultProvider()
    } catch (error) {
      throw createError({
        statusCode: 400,
        statusMessage: `AI provider error: ${error}`
      })
    }
    
    // Check rate limiting (if enabled)
    const userKey = getHeader(event, 'x-user-id') || event.context.user?.apiKey || 'anonymous'
    if (config.aiNuxt.security?.rateLimiting?.enabled) {
      // Rate limiting would be implemented here
      // For now, we'll just log the user
      if (config.aiNuxt.debug) {
        console.log(`🔒 Chat request from user: ${userKey}`)
      }
    }
    
    // Prepare chat options
    const chatOptions: ChatOptions = {
      messages,
      model: model || undefined,
      temperature: temperature || undefined,
      maxTokens: maxTokens || undefined,
      systemPrompt: systemPrompt || undefined,
      stream: false,
      ...otherOptions
    }
    
    // Create chat completion
    const response = await aiProvider.chat.create(chatOptions)
    
    const duration = Date.now() - startTime
    
    // Enhanced logging
    if (config.aiNuxt.debug) {
      console.log(`💬 Chat completion completed:`, {
        provider: response.provider,
        model: response.model,
        tokens: response.usage.totalTokens,
        duration: `${duration}ms`,
        user: userKey,
        messageCount: messages.length
      })
    }
    
    // Add response metadata
    return {
      ...response,
      metadata: {
        ...response.metadata,
        requestId: generateRequestId(),
        duration,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    // Enhanced error logging
    console.error('Chat API error:', {
      error: error.message,
      statusCode: error.statusCode,
      duration: `${duration}ms`,
      url: event.node.req.url,
      method: event.node.req.method
    })
    
    // Handle different types of errors
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }
    
    // Handle provider-specific errors
    if (error.message?.includes('rate limit')) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Rate limit exceeded. Please try again later.'
      })
    }
    
    if (error.message?.includes('API key')) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or missing API key'
      })
    }
    
    if (error.message?.includes('quota')) {
      throw createError({
        statusCode: 402,
        statusMessage: 'Quota exceeded. Please check your billing.'
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message || 'Unknown error'}`
    })
  }
})

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`
}