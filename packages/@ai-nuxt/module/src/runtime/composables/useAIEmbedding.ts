import { ref } from 'vue'
import { useAI } from './useAI'
import type { EmbeddingOptions } from '@ai-nuxt/core'

export interface UseAIEmbeddingOptions {
  provider?: string
  model?: string
}

/**
 * Composable for AI embeddings
 */
export function useAIEmbedding(options: UseAIEmbeddingOptions = {}) {
  const ai = useAI(options.provider)
  
  // Reactive state
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const embeddings = ref<number[][]>([])
  const usage = ref<any>(null)
  
  // Methods
  const embed = async (input: string | string[], embeddingOptions?: Partial<EmbeddingOptions>) => {
    if (isLoading.value) {
      throw new Error('Embedding is already in progress')
    }
    
    isLoading.value = true
    error.value = null
    embeddings.value = []
    
    try {
      const requestOptions: EmbeddingOptions = {
        input,
        model: options.model,
        ...embeddingOptions
      }
      
      const response = await ai.embedding.create(requestOptions)
      
      embeddings.value = response.embeddings
      usage.value = response.usage
      
      return response
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  const similarity = (embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions')
    }
    
    // Calculate cosine similarity
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }
  
  const findMostSimilar = (queryEmbedding: number[], candidateEmbeddings: number[][]): { index: number; similarity: number } => {
    let maxSimilarity = -1
    let bestIndex = -1
    
    candidateEmbeddings.forEach((candidate, index) => {
      const sim = similarity(queryEmbedding, candidate)
      if (sim > maxSimilarity) {
        maxSimilarity = sim
        bestIndex = index
      }
    })
    
    return { index: bestIndex, similarity: maxSimilarity }
  }
  
  const clear = () => {
    embeddings.value = []
    error.value = null
    usage.value = null
  }
  
  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    embeddings: readonly(embeddings),
    usage: readonly(usage),
    
    // Methods
    embed,
    similarity,
    findMostSimilar,
    clear
  }
}