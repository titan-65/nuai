import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { EmbeddingOptions } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()
    
    // Extract options from request body
    const {
      input,
      provider: providerId,
      model,
      ...otherOptions
    } = body as EmbeddingOptions & { provider?: string }
    
    // Validate required fields
    if (!input) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Input is required'
      })
    }
    
    if (typeof input !== 'string' && !Array.isArray(input)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Input must be a string or array of strings'
      })
    }
    
    if (Array.isArray(input) && input.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Input array cannot be empty'
      })
    }
    
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
    
    // Check if provider supports embeddings
    if (!aiProvider.embedding) {
      throw createError({
        statusCode: 400,
        statusMessage: `Provider ${aiProvider.name} does not support embeddings`
      })
    }
    
    // Prepare embedding options
    const embeddingOptions: EmbeddingOptions = {
      input,
      model: model || undefined,
      ...otherOptions
    }
    
    // Create embeddings
    const response = await aiProvider.embedding.create(embeddingOptions)
    
    // Log usage if debug mode is enabled
    if (config.aiNuxt.debug) {
      const inputCount = Array.isArray(input) ? input.length : 1
      console.log(`🔢 Embeddings created - Provider: ${response.provider}, Model: ${response.model}, Inputs: ${inputCount}, Tokens: ${response.usage.totalTokens}`)
    }
    
    return response
  } catch (error: any) {
    // Handle different types of errors
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }
    
    console.error('Embedding API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message || 'Unknown error'}`
    })
  }
})