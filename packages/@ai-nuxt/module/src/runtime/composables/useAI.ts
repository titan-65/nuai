import { useRuntimeConfig } from '#app'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'

/**
 * Core AI composable that provides access to AI providers
 */
export function useAI(providerId?: string) {
  const config = useRuntimeConfig()
  const aiConfig = config.public.aiNuxt
  
  // Get the specified provider or default
  const targetProvider = providerId || aiConfig.defaultProvider
  
  // On client side, we'll use API routes instead of direct provider access
  if (process.client) {
    return {
      chat: {
        create: async (options: any) => {
          const response = await $fetch('/api/ai/chat', {
            method: 'POST',
            body: {
              ...options,
              provider: targetProvider
            }
          })
          return response
        },
        stream: async function* (options: any) {
          const response = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...options,
              provider: targetProvider,
              type: 'chat'
            })
          })
          
          if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`)
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
        }
      },
      completion: {
        create: async (options: any) => {
          const response = await $fetch('/api/ai/completion', {
            method: 'POST',
            body: {
              ...options,
              provider: targetProvider
            }
          })
          return response
        },
        stream: async function* (options: any) {
          const response = await fetch('/api/ai/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...options,
              provider: targetProvider,
              type: 'completion'
            })
          })
          
          if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`)
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
        }
      },
      embedding: {
        create: async (options: any) => {
          const response = await $fetch('/api/ai/embedding', {
            method: 'POST',
            body: {
              ...options,
              provider: targetProvider
            }
          })
          return response
        }
      }
    }
  }
  
  // Server-side: use providers directly
  try {
    const provider = providerId ? getProvider(providerId) : getDefaultProvider()
    return {
      chat: provider.chat,
      completion: provider.completion,
      embedding: provider.embedding,
      vision: provider.vision,
      audio: provider.audio
    }
  } catch (error) {
    throw new Error(`Failed to get AI provider: ${error}`)
  }
}