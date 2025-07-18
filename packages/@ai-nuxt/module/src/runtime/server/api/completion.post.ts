import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { CompletionOptions } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()
    
    // Extract options from request body
    const {
      prompt,
      provider: providerId,
      model,
      temperature,
      maxTokens,
      ...otherOptions
    } = body as CompletionOptions & { provider?: string }
    
    // Validate required fields
    if (!prompt || typeof prompt !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Prompt is required and must be a string'
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
    
    // Prepare completion options
    const completionOptions: CompletionOptions = {
      prompt,
      model: model || undefined,
      temperature: temperature || undefined,
      maxTokens: maxTokens || undefined,
      stream: false,
      ...otherOptions
    }
    
    // Create completion
    const response = await aiProvider.completion.create(completionOptions)
    
    // Log usage if debug mode is enabled
    if (config.aiNuxt.debug) {
      console.log(`📝 Text completion - Provider: ${response.provider}, Model: ${response.model}, Tokens: ${response.usage.totalTokens}`)
    }
    
    return response
  } catch (error: any) {
    // Handle different types of errors
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }
    
    console.error('Completion API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message || 'Unknown error'}`
    })
  }
})