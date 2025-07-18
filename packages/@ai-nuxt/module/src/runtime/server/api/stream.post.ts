import { defineEventHandler, readBody, createError, setHeader } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { ChatOptions, CompletionOptions } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config = useRuntimeConfig()
    
    // Extract common options
    const {
      type,
      provider: providerId,
      ...options
    } = body as { type: 'chat' | 'completion'; provider?: string } & (ChatOptions | CompletionOptions)
    
    // Validate type
    if (!type || (type !== 'chat' && type !== 'completion')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Type must be either "chat" or "completion"'
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
    
    // Set SSE headers
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
    
    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (type === 'chat') {
            const chatOptions = options as ChatOptions
            
            // Validate chat options
            if (!chatOptions.messages || !Array.isArray(chatOptions.messages) || chatOptions.messages.length === 0) {
              throw new Error('Messages array is required and cannot be empty')
            }
            
            // Stream chat completion
            for await (const chunk of aiProvider.chat.stream(chatOptions)) {
              const data = JSON.stringify(chunk)
              controller.enqueue(`data: ${data}\n\n`)
              
              if (chunk.finished) {
                break
              }
            }
          } else if (type === 'completion') {
            const completionOptions = options as CompletionOptions
            
            // Validate completion options
            if (!completionOptions.prompt || typeof completionOptions.prompt !== 'string') {
              throw new Error('Prompt is required and must be a string')
            }
            
            // Stream text completion
            for await (const chunk of aiProvider.completion.stream(completionOptions)) {
              const data = JSON.stringify(chunk)
              controller.enqueue(`data: ${data}\n\n`)
              
              if (chunk.finished) {
                break
              }
            }
          }
          
          // Send completion signal
          controller.enqueue('data: [DONE]\n\n')
          controller.close()
          
          // Log usage if debug mode is enabled
          if (config.aiNuxt.debug) {
            console.log(`🌊 Streaming ${type} completed - Provider: ${aiProvider.name}`)
          }
        } catch (error: any) {
          console.error(`Streaming ${type} error:`, error)
          
          // Send error to client
          const errorData = JSON.stringify({
            error: error.message || 'Unknown streaming error',
            finished: true
          })
          controller.enqueue(`data: ${errorData}\n\n`)
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error: any) {
    // Handle different types of errors
    if (error.statusCode) {
      throw error // Re-throw HTTP errors
    }
    
    console.error('Stream API error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message || 'Unknown error'}`
    })
  }
})