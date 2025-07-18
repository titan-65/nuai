import { ref, computed, reactive } from 'vue'
import { useRuntimeConfig, useNuxtApp } from '#app'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { ChatOptions, CompletionOptions, EmbeddingOptions, ChatResponse, CompletionResponse, EmbeddingResponse } from '@ai-nuxt/core'
import { useAICache } from './useAICache'

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
  
  // Advanced caching with semantic similarity
  const aiCache = useAICache()
  
  // Initialize semantic caching if enabled
  if (aiConfig.caching?.semantic?.enabled) {
    // Create embedding function for semantic caching
    const generateEmbedding = async (text: string): Promise<number[]> => {
      try {
        const response = await $fetch<EmbeddingResponse>('/api/ai/embedding', {
          method: 'POST',
          body: {
            input: text,
            provider: aiConfig.caching.semantic.embeddingProvider || state.currentProvider,
            model: aiConfig.caching.semantic.embeddingModel || 'text-embedding-3-small'
          }
        })
        return response.data[0].embedding
      } catch (error) {
        console.warn('Failed to generate embedding for semantic cache:', error)
        throw error
      }
    }
    
    // Initialize cache with semantic similarity
    aiCache.initializeCache({
      enabled: true,
      layers: {
        memory: {
          enabled: true,
          maxSize: aiConfig.caching.maxSize || 100,
          ttl: (aiConfig.caching.ttl || 300) * 1000
        },
        semantic: {
          enabled: true,
          threshold: aiConfig.caching.semantic.threshold || 0.95,
          maxSize: aiConfig.caching.semantic.maxSize || 50,
          ttl: (aiConfig.caching.semantic.ttl || 600) * 1000
        }
      },
      keyGeneration: {
        includeModel: true,
        includeProvider: true,
        includeTemperature: true,
        includeMaxTokens: false,
        normalizeWhitespace: true
      }
    }, generateEmbedding)
  } else {
    // Initialize basic memory cache
    aiCache.initializeCache({
      enabled: aiConfig.caching?.enabled !== false,
      layers: {
        memory: {
          enabled: true,
          maxSize: aiConfig.caching?.maxSize || 100,
          ttl: (aiConfig.caching?.ttl || 300) * 1000
        },
        semantic: {
          enabled: false,
          threshold: 0.95,
          maxSize: 50,
          ttl: 600000
        }
      }
    })
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
        // Check semantic cache first
        if (options.caching !== false && aiCache.isEnabled.value) {
          const cachedResponse = await aiCache.getCachedChatResponse(chatOptions)
          if (cachedResponse) {
            if (aiConfig.debug) {
              console.log('🎯 Semantic cache hit for chat request', {
                similarity: cachedResponse.metadata.cacheHit ? 'exact' : 'semantic',
                provider: cachedResponse.metadata.provider,
                model: cachedResponse.metadata.model
              })
            }
            updateStats(cachedResponse.response)
            return cachedResponse.response
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
          
          // Cache successful response with semantic similarity
          if (options.caching !== false && aiCache.isEnabled.value) {
            await aiCache.setCachedChatResponse(chatOptions, response, {
              provider: state.currentProvider,
              model: options.model || chatOptions.model || 'default',
              tokens: response.usage?.totalTokens,
              cost: response.cost
            })
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
        // Check semantic cache first
        if (options.caching !== false && aiCache.isEnabled.value) {
          const cachedResponse = await aiCache.getCachedCompletionResponse(completionOptions)
          if (cachedResponse) {
            if (aiConfig.debug) {
              console.log('🎯 Semantic cache hit for completion request', {
                similarity: cachedResponse.metadata.cacheHit ? 'exact' : 'semantic',
                provider: cachedResponse.metadata.provider,
                model: cachedResponse.metadata.model
              })
            }
            updateStats(cachedResponse.response)
            return cachedResponse.response
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
          
          // Cache successful response with semantic similarity
          if (options.caching !== false && aiCache.isEnabled.value) {
            await aiCache.setCachedCompletionResponse(completionOptions, response, {
              provider: state.currentProvider,
              model: options.model || completionOptions.model || 'default',
              tokens: response.usage?.totalTokens,
              cost: response.cost
            })
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
        // Check semantic cache first
        if (options.caching !== false && aiCache.isEnabled.value) {
          const cachedResponse = await aiCache.getCachedEmbeddingResponse(embeddingOptions)
          if (cachedResponse) {
            if (aiConfig.debug) {
              console.log('🎯 Semantic cache hit for embedding request', {
                similarity: cachedResponse.metadata.cacheHit ? 'exact' : 'semantic',
                provider: cachedResponse.metadata.provider,
                model: cachedResponse.metadata.model
              })
            }
            updateStats(cachedResponse.response)
            return cachedResponse.response
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
          
          // Cache successful response with semantic similarity
          if (options.caching !== false && aiCache.isEnabled.value) {
            await aiCache.setCachedEmbeddingResponse(embeddingOptions, response, {
              provider: state.currentProvider,
              model: options.model || embeddingOptions.model || 'default',
              tokens: response.usage?.totalTokens,
              cost: response.cost
            })
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
  
  const clearCache = async () => {
    await aiCache.clearCache()
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