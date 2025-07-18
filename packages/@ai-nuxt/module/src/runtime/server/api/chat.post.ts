import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { ChatOptions } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()
    
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
    
    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Messages array is required and cannot be empty'
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
    
    // Log usage if debug mode is enabled
    if (config.aiNuxt.debug) {
      console.log(`💬 Chat completion - Provider: ${response.provider}, Model: ${response.model}, Tokens: ${response.usage.totalTokens}`)
    }
    
    return response
  } catch (error: any) {
    // Handle different types of errors
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }
    
    console.error('Chat API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message || 'Unknown error'}`
    })
  }
})