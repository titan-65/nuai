import { ref, computed, reactive } from 'vue'
import { useRuntimeConfig, useNuxtApp } from '#app'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { ChatOptions, CompletionOptions, EmbeddingOptions, ChatResponse, CompletionResponse, EmbeddingResponse } from '@ai-nuxt/core'

export interface UseAIOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  caching?: boolean
  retries?: number
  timeout?: number
}

export interface AIError extends Error {
  code?: string
  provider?: string
  statusCode?: number
}

/**
 * Core AI composable that provides access to AI providers with enhanced features
 */
export function useAI(options: UseAIOptions = {}) {
  const config = useRuntimeConfig()
  const { $ai } = useNuxtApp()
  const aiConfig = config.public.aiNuxt
  
  // Reactive state
  const state = reactive({
    currentProvider: options.provider || aiConfig.defaultProvider,
    isLoading: false,
    error: null as AIError | null,
    lastResponse: null as any,
    requestCount: 0,
    totalTokens: 0
  })
  
  // Computed properties
  const providerInfo = computed(() => ({
    current: state.currentProvider,
    available: $ai?.providers || [],
    capabilities: getProviderCapabilities(state.currentProvider)
  }))
  
  const stats = computed(() => ({
    requests: state.requestCount,
    tokens: state.totalTokens,
    provider: state.currentProvider
  }))
  
  // Internal cache for responses (simple in-memory cache)
  const responseCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  
  // Helper functions
  const createCacheKey = (method: string, options: any): string => {
    return `${method}:${state.currentProvider}:${JSON.stringify(options)}`
  }
  
  const getCachedResponse = (key: string) => {
    const cached = responseCache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data
    }
    responseCache.delete(key)
    return null
  }
  
  const setCachedResponse = (key: string, data: any, ttl: number = 300000) => { // 5 minutes default
    responseCache.set(key, { data, timestamp: Date.now(), ttl })
  }
  
  const handleError = (error: any, context: string): AIError => {
    const aiError: AIError = new Error(`${context}: ${error.message || 'Unknown error'}`)
    aiError.code = error.code || 'UNKNOWN_ERROR'
    aiError.provider = state.currentProvider
    aiError.statusCode = error.statusCode || error.status
    
    state.error = aiError
    
    if (aiConfig.debug) {
      console.error(`🚨 AI Error [${state.currentProvider}]:`, aiError)
    }
    
    return aiError
  }
  
  const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = options.retries || 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        
        // Don't retry on client errors (4xx)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error
        }
        
        if (attempt < maxRetries) {
          if (aiConfig.debug) {
            console.warn(`🔄 Retrying AI request (attempt ${attempt}/${maxRetries})`)
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      }
    }
    
    throw lastError
  }
  
  const updateStats = (response: any) => {
    state.requestCount++
    state.lastResponse = response
    if (response.usage?.totalTokens) {
      state.totalTokens += response.usage.totalTokens
    }
  }
  
  // Client-side API interface
  const createClientInterface = () => ({
    chat: {
      create: async (chatOptions: ChatOptions): Promise<ChatResponse> => {
        const cacheKey = options.caching !== false ? createCacheKey('chat', chatOptions) : null
        
        // Check cache first
        if (cacheKey && aiConfig.caching.enabled) {
          const cached = getCachedResponse(cacheKey)
          if (cached) {
            if (aiConfig.debug) {
              console.log('🎯 Cache hit for chat request')
            }
            return cached
          }
        }
        
        state.isLoading = true
        state.error = null
        
        try {
          const response = await withRetry(async () => {
            return await $fetch<ChatResponse>('/api/ai/chat', {
              method: 'POST',
              body: {
                ...chatOptions,
                provider: state.currentProvider,
                model: options.model || chatOptions.model,
                temperature: options.temperature ?? chatOptions.temperature,
                maxTokens: options.maxTokens || chatOptions.maxTokens
              },
              timeout: options.timeout || 30000
            })
          })
          
          updateStats(response)
          
          // Cache successful response
          if (cacheKey && aiConfig.caching.enabled) {
            setCachedResponse(cacheKey, response, aiConfig.caching.ttl * 1000)
          }
          
          return response
        } catch (error: any) {
          throw handleError(error, 'Chat completion failed')
        } finally {
          state.isLoading = false
        }
      },
      
      stream: async function* (chatOptions: ChatOptions) {
        state.isLoading = true
        state.error = null
        
        try {
          const response = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...chatOptions,
              provider: state.currentProvider,
              model: options.model || chatOptions.model,
              temperature: options.temperature ?? chatOptions.temperature,
              maxTokens: options.maxTokens || chatOptions.maxTokens,
              type: 'chat'
            })
          })
          
          if (!response.ok) {
            throw new Error(`Stream request failed: ${response.status} ${response.statusText}`)
          }
          
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('Failed to get response reader')
          }
          
          const decoder = new TextDecoder()
          let buffer = ''
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                const trimmed = line.trim()
                if (trimmed === '' || trimmed === 'data: [DONE]') continue
                
                if (trimmed.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(trimmed.slice(6))
                    
                    if (data.error) {
                      throw new Error(data.error)
                    }
                    
                    yield data
                  } catch (error) {
                    console.warn('Failed to parse streaming chunk:', error)
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        } catch (error: any) {
          throw handleError(error, 'Chat streaming failed')
        } finally {
          state.isLoading = false
        }
      }
    },
    
    completion: {
      create: async (completionOptions: CompletionOptions): Promise<CompletionResponse> => {
        const cacheKey = options.caching !== false ? createCacheKey('completion', completionOptions) : null
        
        // Check cache first
        if (cacheKey && aiConfig.caching.enabled) {
          const cached = getCachedResponse(cacheKey)
          if (cached) {
            if (aiConfig.debug) {
              console.log('🎯 Cache hit for completion request')
            }
            return cached
          }
        }
        
        state.isLoading = true
        state.error = null
        
        try {
          const response = await withRetry(async () => {
            return await $fetch<CompletionResponse>('/api/ai/completion', {
              method: 'POST',
              body: {
                ...completionOptions,
                provider: state.currentProvider,
                model: options.model || completionOptions.model,
                temperature: options.temperature ?? completionOptions.temperature,
                maxTokens: options.maxTokens || completionOptions.maxTokens
              },
              timeout: options.timeout || 30000
            })
          })
          
          updateStats(response)
          
          // Cache successful response
          if (cacheKey && aiConfig.caching.enabled) {
            setCachedResponse(cacheKey, response, aiConfig.caching.ttl * 1000)
          }
          
          return response
        } catch (error: any) {
          throw handleError(error, 'Text completion failed')
        } finally {
          state.isLoading = false
        }
      },
      
      stream: async function* (completionOptions: CompletionOptions) {
        state.isLoading = true
        state.error = null
        
        try {
          const response = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...completionOptions,
              provider: state.currentProvider,
              model: options.model || completionOptions.model,
              temperature: options.temperature ?? completionOptions.temperature,
              maxTokens: options.maxTokens || completionOptions.maxTokens,
              type: 'completion'
            })
          })
          
          if (!response.ok) {
            throw new Error(`Stream request failed: ${response.status} ${response.statusText}`)
          }
          
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('Failed to get response reader')
          }
          
          const decoder = new TextDecoder()
          let buffer = ''
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                const trimmed = line.trim()
                if (trimmed === '' || trimmed === 'data: [DONE]') continue
                
                if (trimmed.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(trimmed.slice(6))
                    
                    if (data.error) {
                      throw new Error(data.error)
                    }
                    
                    yield data
                  } catch (error) {
                    console.warn('Failed to parse streaming chunk:', error)
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        } catch (error: any) {
          throw handleError(error, 'Completion streaming failed')
        } finally {
          state.isLoading = false
        }
      }
    },
    
    embedding: {
      create: async (embeddingOptions: EmbeddingOptions): Promise<EmbeddingResponse> => {
        const cacheKey = options.caching !== false ? createCacheKey('embedding', embeddingOptions) : null
        
        // Check cache first
        if (cacheKey && aiConfig.caching.enabled) {
          const cached = getCachedResponse(cacheKey)
          if (cached) {
            if (aiConfig.debug) {
              console.log('🎯 Cache hit for embedding request')
            }
            return cached
          }
        }
        
        state.isLoading = true
        state.error = null
        
        try {
          const response = await withRetry(async () => {
            return await $fetch<EmbeddingResponse>('/api/ai/embedding', {
              method: 'POST',
              body: {
                ...embeddingOptions,
                provider: state.currentProvider,
                model: options.model || embeddingOptions.model
              },
              timeout: options.timeout || 30000
            })
          })
          
          updateStats(response)
          
          // Cache successful response
          if (cacheKey && aiConfig.caching.enabled) {
            setCachedResponse(cacheKey, response, aiConfig.caching.ttl * 1000)
          }
          
          return response
        } catch (error: any) {
          throw handleError(error, 'Embedding creation failed')
        } finally {
          state.isLoading = false
        }
      }
    }
  })
  
  // Server-side direct provider interface
  const createServerInterface = () => {
    try {
      const provider = options.provider ? getProvider(options.provider) : getDefaultProvider()
      
      return {
        chat: provider.chat,
        completion: provider.completion,
        embedding: provider.embedding,
        vision: provider.vision,
        audio: provider.audio
      }
    } catch (error) {
      throw handleError(error, 'Failed to get AI provider')
    }
  }
  
  // Provider capability detection
  const getProviderCapabilities = (providerId: string) => {
    const capabilities = {
      openai: { chat: true, completion: true, embedding: true, vision: false, audio: false, streaming: true },
      anthropic: { chat: true, completion: true, embedding: false, vision: false, audio: false, streaming: true },
      ollama: { chat: true, completion: true, embedding: true, vision: false, audio: false, streaming: true }
    }
    
    return capabilities[providerId as keyof typeof capabilities] || {
      chat: false, completion: false, embedding: false, vision: false, audio: false, streaming: false
    }
  }
  
  // Public methods
  const switchProvider = (providerId: string) => {
    if (!providerInfo.value.available.includes(providerId)) {
      throw new Error(`Provider ${providerId} is not available`)
    }
    
    state.currentProvider = providerId
    state.error = null
    
    if (aiConfig.debug) {
      console.log(`🔄 Switched to AI provider: ${providerId}`)
    }
  }
  
  const clearCache = () => {
    responseCache.clear()
    if (aiConfig.debug) {
      console.log('🗑️ AI response cache cleared')
    }
  }
  
  const resetStats = () => {
    state.requestCount = 0
    state.totalTokens = 0
    state.lastResponse = null
  }
  
  // Return appropriate interface based on environment
  const aiInterface = process.client ? createClientInterface() : createServerInterface()
  
  return {
    // Core AI interface
    ...aiInterface,
    
    // State
    state: readonly(state),
    providerInfo,
    stats,
    
    // Methods
    switchProvider,
    clearCache,
    resetStats,
    
    // Utilities
    isLoading: computed(() => state.isLoading),
    error: computed(() => state.error),
    currentProvider: computed(() => state.currentProvider)
  }
}