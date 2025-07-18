import { ref, computed, reactive } from 'vue'
import { useRuntimeConfig } from '#app'
import { 
  RAGSystem, 
  DEFAULT_RAG_CONFIG,
  type RAGConfig, 
  type RAGResult,
  type VectorDocument 
} from '@ai-nuxt/core'
import { useAIVectorStore } from './useAIVectorStore'
import type { ChatOptions, CompletionOptions } from '@ai-nuxt/core'

export interface UseAIRAGOptions {
  config?: Partial<RAGConfig>
  vectorStoreOptions?: {
    generateEmbedding?: (text: string) => Promise<number[]>
    maxDocuments?: number
  }
}

export interface RAGState {
  isEnabled: boolean
  isProcessing: boolean
  error: string | null
  lastResult: RAGResult | null
  stats: {
    totalEnhancements: number
    averageProcessingTime: number
    documentsRetrieved: number
    contextLength: number
  }
}

/**
 * AI RAG (Retrieval-Augmented Generation) composable for Vue components
 */
export const useAIRAG = (options: UseAIRAGOptions = {}) => {
  const config = useRuntimeConfig()
  const aiConfig = config.public?.aiNuxt || {}
  
  // Initialize vector store
  const vectorStore = useAIVectorStore(options.vectorStoreOptions)
  
  // RAG system instance
  let ragSystem: RAGSystem | null = null
  
  // Configuration
  const ragConfig = ref<RAGConfig>({
    ...DEFAULT_RAG_CONFIG,
    ...options.config
  })

  // Reactive state
  const state = reactive<RAGState>({
    isEnabled: ragConfig.value.enabled,
    isProcessing: false,
    error: null,
    lastResult: null,
    stats: {
      totalEnhancements: 0,
      averageProcessingTime: 0,
      documentsRetrieved: 0,
      contextLength: 0
    }
  })

  // Computed properties
  const isInitialized = computed(() => ragSystem !== null && vectorStore.isInitialized.value)
  const hasDocuments = computed(() => vectorStore.hasDocuments.value)
  const documentCount = computed(() => vectorStore.documentCount.value)
  
  const configSummary = computed(() => ({
    enabled: state.isEnabled,
    maxContextLength: ragConfig.value.maxContextLength,
    maxDocuments: ragConfig.value.maxDocuments,
    similarityThreshold: ragConfig.value.similarityThreshold,
    chunkSize: ragConfig.value.chunkSize,
    relevanceScoring: ragConfig.value.relevanceScoring.enabled
  }))

  // Initialize RAG system
  const initializeRAG = async (): Promise<void> => {
    if (ragSystem) return

    try {
      // Ensure vector store is initialized
      await vectorStore.initializeStore()
      
      // Create RAG system with vector store
      const vectorStoreInstance = (vectorStore as any).vectorStore
      if (!vectorStoreInstance) {
        throw new Error('Vector store not properly initialized')
      }
      
      ragSystem = new RAGSystem(vectorStoreInstance, ragConfig.value)
      state.error = null
    } catch (error: any) {
      state.error = error.message || 'Failed to initialize RAG system'
      throw error
    }
  }

  // Ensure RAG system is initialized
  const ensureInitialized = async (): Promise<void> => {
    if (!ragSystem || !vectorStore.isInitialized.value) {
      await initializeRAG()
    }
  }

  // Add documents to RAG system
  const addDocuments = async (documents: VectorDocument[]): Promise<void> => {
    await ensureInitialized()
    
    state.isProcessing = true
    state.error = null

    try {
      await ragSystem!.addDocuments(documents)
      await vectorStore.refreshDocuments()
    } catch (error: any) {
      state.error = error.message || 'Failed to add documents to RAG system'
      throw error
    } finally {
      state.isProcessing = false
    }
  }

  // Add single document
  const addDocument = async (document: VectorDocument): Promise<void> => {
    await addDocuments([document])
  }

  // Enhance chat with RAG context
  const enhanceChat = async (chatOptions: ChatOptions): Promise<RAGResult> => {
    await ensureInitialized()
    
    if (!state.isEnabled) {
      // Return unenhanced result when RAG is disabled
      const originalPrompt = extractPromptFromMessages(chatOptions.messages || [])
      return {
        originalPrompt,
        enhancedPrompt: originalPrompt,
        context: {
          query: '',
          retrievedDocuments: [],
          contextText: '',
          relevanceScores: [],
          totalTokens: 0,
          truncated: false
        },
        metadata: {
          documentsRetrieved: 0,
          contextLength: 0,
          processingTime: 0
        }
      }
    }

    state.isProcessing = true
    state.error = null

    try {
      const result = await ragSystem!.enhanceChat(chatOptions)
      
      // Update state and stats
      state.lastResult = result
      updateStats(result)
      
      return result
    } catch (error: any) {
      state.error = error.message || 'Failed to enhance chat with RAG'
      throw error
    } finally {
      state.isProcessing = false
    }
  }

  // Enhance completion with RAG context
  const enhanceCompletion = async (completionOptions: CompletionOptions): Promise<RAGResult> => {
    await ensureInitialized()
    
    if (!state.isEnabled) {
      // Return unenhanced result when RAG is disabled
      return {
        originalPrompt: completionOptions.prompt || '',
        enhancedPrompt: completionOptions.prompt || '',
        context: {
          query: '',
          retrievedDocuments: [],
          contextText: '',
          relevanceScores: [],
          totalTokens: 0,
          truncated: false
        },
        metadata: {
          documentsRetrieved: 0,
          contextLength: 0,
          processingTime: 0
        }
      }
    }

    state.isProcessing = true
    state.error = null

    try {
      const result = await ragSystem!.enhanceCompletion(completionOptions)
      
      // Update state and stats
      state.lastResult = result
      updateStats(result)
      
      return result
    } catch (error: any) {
      state.error = error.message || 'Failed to enhance completion with RAG'
      throw error
    } finally {
      state.isProcessing = false
    }
  }

  // Search for relevant documents
  const searchDocuments = async (query: string, limit: number = 5): Promise<any[]> => {
    await ensureInitialized()
    
    try {
      const results = await vectorStore.searchByText(query, { 
        limit,
        threshold: ragConfig.value.similarityThreshold 
      })
      return results
    } catch (error: any) {
      state.error = error.message || 'Failed to search documents'
      return []
    }
  }

  // Update RAG configuration
  const updateConfig = (newConfig: Partial<RAGConfig>): void => {
    ragConfig.value = { ...ragConfig.value, ...newConfig }
    state.isEnabled = ragConfig.value.enabled
    
    if (ragSystem) {
      ragSystem.updateConfig(newConfig)
    }
  }

  // Enable/disable RAG
  const enableRAG = (): void => {
    updateConfig({ enabled: true })
  }

  const disableRAG = (): void => {
    updateConfig({ enabled: false })
  }

  // Configure context settings
  const setContextSettings = (settings: {
    maxContextLength?: number
    maxDocuments?: number
    similarityThreshold?: number
  }): void => {
    updateConfig(settings)
  }

  // Configure chunking settings
  const setChunkingSettings = (settings: {
    chunkSize?: number
    chunkOverlap?: number
  }): void => {
    updateConfig(settings)
  }

  // Configure relevance scoring
  const setRelevanceScoring = (settings: {
    enabled?: boolean
    weights?: {
      similarity?: number
      recency?: number
      metadata?: number
    }
  }): void => {
    const currentScoring = ragConfig.value.relevanceScoring
    updateConfig({
      relevanceScoring: {
        ...currentScoring,
        ...settings,
        weights: settings.weights ? { ...currentScoring.weights, ...settings.weights } : currentScoring.weights
      }
    })
  }

  // Get RAG system statistics
  const getRAGStats = async (): Promise<any> => {
    if (!ragSystem) return null
    
    try {
      return await ragSystem.getStats()
    } catch (error: any) {
      state.error = error.message || 'Failed to get RAG statistics'
      return null
    }
  }

  // Clear all documents
  const clearDocuments = async (): Promise<void> => {
    await vectorStore.clearDocuments()
    resetStats()
  }

  // Reset statistics
  const resetStats = (): void => {
    state.stats = {
      totalEnhancements: 0,
      averageProcessingTime: 0,
      documentsRetrieved: 0,
      contextLength: 0
    }
    state.lastResult = null
  }

  // Clear error state
  const clearError = (): void => {
    state.error = null
  }

  // Destroy RAG system and cleanup
  const destroy = async (): Promise<void> => {
    if (ragSystem) {
      ragSystem = null
    }
    
    await vectorStore.destroy()
    resetStats()
    state.error = null
  }

  // Helper functions
  const extractPromptFromMessages = (messages: any[]): string => {
    if (messages.length === 0) return ''
    const lastMessage = messages[messages.length - 1]
    return lastMessage.content || ''
  }

  const updateStats = (result: RAGResult): void => {
    state.stats.totalEnhancements++
    state.stats.documentsRetrieved = result.metadata.documentsRetrieved
    state.stats.contextLength = result.metadata.contextLength
    
    // Update average processing time
    const currentAvg = state.stats.averageProcessingTime
    const newAvg = (currentAvg * (state.stats.totalEnhancements - 1) + result.metadata.processingTime) / state.stats.totalEnhancements
    state.stats.averageProcessingTime = Math.round(newAvg)
  }

  // Initialize on client-side
  if (process.client) {
    initializeRAG().catch(error => {
      console.error('Failed to initialize RAG system:', error)
    })
  }

  return {
    // State
    state: readonly(state),
    ragConfig: readonly(ragConfig),
    
    // Computed
    isInitialized,
    hasDocuments,
    documentCount,
    configSummary,

    // Core methods
    initializeRAG,
    addDocument,
    addDocuments,
    enhanceChat,
    enhanceCompletion,
    searchDocuments,

    // Configuration
    updateConfig,
    enableRAG,
    disableRAG,
    setContextSettings,
    setChunkingSettings,
    setRelevanceScoring,

    // Management
    getRAGStats,
    clearDocuments,
    resetStats,
    clearError,
    destroy,

    // Vector store access
    vectorStore
  }
}

// Export types for convenience
export type { RAGConfig, RAGResult, VectorDocument } from '@ai-nuxt/core'