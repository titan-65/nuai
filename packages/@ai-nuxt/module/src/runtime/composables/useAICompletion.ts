import { ref } from 'vue'
import { useAI } from './useAI'
import type { CompletionOptions } from '@ai-nuxt/core'

export interface UseAICompletionOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Composable for AI text completions
 */
export function useAICompletion(options: UseAICompletionOptions = {}) {
  const ai = useAI(options.provider)
  
  // Reactive state
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const result = ref<string>('')
  const usage = ref<any>(null)
  
  // Methods
  const complete = async (prompt: string, completionOptions?: Partial<CompletionOptions>) => {
    if (isLoading.value) {
      throw new Error('Completion is already in progress')
    }
    
    isLoading.value = true
    error.value = null
    result.value = ''
    
    try {
      const requestOptions: CompletionOptions = {
        prompt,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        ...completionOptions
      }
      
      const response = await ai.completion.create(requestOptions)
      
      result.value = response.text
      usage.value = response.usage
      
      return response
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  const stream = async (prompt: string, completionOptions?: Partial<CompletionOptions>) => {
    if (isLoading.value) {
      throw new Error('Completion is already in progress')
    }
    
    isLoading.value = true
    error.value = null
    result.value = ''
    
    try {
      const requestOptions: CompletionOptions = {
        prompt,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        ...completionOptions
      }
      
      let fullText = ''
      for await (const chunk of ai.completion.stream(requestOptions)) {
        if (!chunk.finished) {
          fullText += chunk.delta
          result.value = fullText
        }
      }
      
      return { text: fullText }
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  const clear = () => {
    result.value = ''
    error.value = null
    usage.value = null
  }
  
  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    result: readonly(result),
    usage: readonly(usage),
    
    // Methods
    complete,
    stream,
    clear
  }
}