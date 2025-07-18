import { ref, computed, reactive, watch } from 'vue'
import { useRuntimeConfig } from '#app'
import { 
  MemoryVectorStore, 
  VectorStoreFactory,
  type VectorDocument, 
  type VectorSearchResult, 
  type VectorSearchOptions,
  type VectorStoreStats
} from '@ai-nuxt/core'

export interface UseAIVectorStoreOptions {
  generateEmbedding?: (text: string) => Promise<number[]>
  autoSave?: boolean
  persistKey?: string
  maxDocuments?: number
  defaultSearchLimit?: number
  defaultSearchThreshold?: number
}

export interface VectorStoreState {
  isLoading: boolean
  error: string | null
  stats: VectorStoreStats | null
  lastOperation: string | null
  operationCount: number
}

/**
 * AI Vector Store composable for managing document storage and similarity search in Vue components
 */
export const useAIVectorStore = (options: UseAIVectorStoreOptions = {}) => {
  const config = useRuntimeConfig()
  const aiConfig = config.public?.aiNuxt || {}
  
  // Configuration
  const {
    autoSave = true,
    persistKey = 'ai-vector-store',
    maxDocuments = 1000,
    defaultSearchLimit = 10,
    defaultSearchThreshold = 0.7
  } = options

  // Vector store instance
  let vectorStore: MemoryVectorStore | null = null
  
  // Reactive state
  const state = reactive<VectorStoreState>({
    isLoading: false,
    error: null,
    stats: null,
    lastOperation: null,
    operationCount: 0
  })

  // Documents reactive reference
  const documents = ref<VectorDocument[]>([])
  const searchResults = ref<VectorSearchResult[]>([])
  const isInitialized = ref(false)

  // Computed properties
  const documentCount = computed(() => documents.value.length)
  const hasDocuments = computed(() => documentCount.value > 0)
  const isAtCapacity = computed(() => documentCount.value >= maxDocuments)
  
  const documentsByMetadata = computed(() => {
    const grouped: Record<string, VectorDocument[]> = {}
    documents.value.forEach(doc => {
      if (doc.metadata) {
        Object.entries(doc.metadata).forEach(([key, value]) => {
          const groupKey = `${key}:${value}`
          if (!grouped[groupKey]) grouped[groupKey] = []
          grouped[groupKey].push(doc)
        })
      }
    })
    return grouped
  })

  // Default embedding generator using AI service
  const defaultEmbeddingGenerator = async (text: string): Promise<number[]> => {
    try {
      const response = await $fetch<any>('/api/ai/embedding', {
        method: 'POST',
        body: {
          input: text,
          provider: aiConfig.defaultProvider || 'openai',
          model: aiConfig.embeddingModel || 'text-embedding-3-small'
        }
      })
      return response.data[0].embedding
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw new Error('Failed to generate embedding for text')
    }
  }

  // Initialize vector store
  const initializeStore = async (embeddingGenerator?: (text: string) => Promise<number[]>) => {
    if (vectorStore) return

    state.isLoading = true
    state.error = null

    try {
      const generator = embeddingGenerator || options.generateEmbedding || defaultEmbeddingGenerator
      vectorStore = VectorStoreFactory.createMemoryStore(generator)
      
      // Load persisted documents if available
      if (autoSave && process.client) {
        await loadPersistedDocuments()
      }
      
      await updateStats()
      isInitialized.value = true
      state.lastOperation = 'initialize'
    } catch (error: any) {
      state.error = error.message || 'Failed to initialize vector store'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Ensure store is initialized
  const ensureInitialized = async () => {
    if (!vectorStore || !isInitialized.value) {
      await initializeStore()
    }
  }

  // Add document to vector store
  const addDocument = async (document: Omit<VectorDocument, 'timestamp'> | VectorDocument): Promise<void> => {
    await ensureInitialized()
    
    if (isAtCapacity.value && !documents.value.find(d => d.id === document.id)) {
      throw new Error(`Cannot add document: maximum capacity of ${maxDocuments} reached`)
    }

    state.isLoading = true
    state.error = null

    try {
      const docWithTimestamp: VectorDocument = {
        ...document,
        timestamp: document.timestamp || Date.now()
      }

      await vectorStore!.add(docWithTimestamp)
      await refreshDocuments()
      await updateStats()
      
      if (autoSave && process.client) {
        await persistDocuments()
      }
      
      state.lastOperation = `add:${document.id}`
      state.operationCount++
    } catch (error: any) {
      state.error = error.message || 'Failed to add document'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Add multiple documents in batch
  const addDocuments = async (docs: (Omit<VectorDocument, 'timestamp'> | VectorDocument)[]): Promise<void> => {
    await ensureInitialized()
    
    if (docs.length + documentCount.value > maxDocuments) {
      throw new Error(`Cannot add ${docs.length} documents: would exceed maximum capacity of ${maxDocuments}`)
    }

    state.isLoading = true
    state.error = null

    try {
      const docsWithTimestamp: VectorDocument[] = docs.map(doc => ({
        ...doc,
        timestamp: doc.timestamp || Date.now()
      }))

      await vectorStore!.addBatch(docsWithTimestamp)
      await refreshDocuments()
      await updateStats()
      
      if (autoSave && process.client) {
        await persistDocuments()
      }
      
      state.lastOperation = `addBatch:${docs.length}`
      state.operationCount++
    } catch (error: any) {
      state.error = error.message || 'Failed to add documents'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Search documents by text
  const searchByText = async (
    query: string, 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const searchOptions: VectorSearchOptions = {
        limit: defaultSearchLimit,
        threshold: defaultSearchThreshold,
        ...options
      }

      const results = await vectorStore!.searchByText(query, searchOptions)
      searchResults.value = results
      
      state.lastOperation = `search:${query}`
      state.operationCount++
      
      return results
    } catch (error: any) {
      state.error = error.message || 'Failed to search documents'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Search documents by embedding vector
  const searchByEmbedding = async (
    embedding: number[], 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const searchOptions: VectorSearchOptions = {
        limit: defaultSearchLimit,
        threshold: defaultSearchThreshold,
        ...options
      }

      const results = await vectorStore!.search(embedding, searchOptions)
      searchResults.value = results
      
      state.lastOperation = `searchByEmbedding`
      state.operationCount++
      
      return results
    } catch (error: any) {
      state.error = error.message || 'Failed to search by embedding'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Get document by ID
  const getDocument = async (id: string): Promise<VectorDocument | null> => {
    await ensureInitialized()

    try {
      const document = await vectorStore!.get(id)
      state.lastOperation = `get:${id}`
      return document
    } catch (error: any) {
      state.error = error.message || 'Failed to get document'
      return null
    }
  }

  // Update document
  const updateDocument = async (id: string, content: string, metadata?: Record<string, any>): Promise<void> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      await vectorStore!.updateDocument(id, content, metadata)
      await refreshDocuments()
      await updateStats()
      
      if (autoSave && process.client) {
        await persistDocuments()
      }
      
      state.lastOperation = `update:${id}`
      state.operationCount++
    } catch (error: any) {
      state.error = error.message || 'Failed to update document'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Delete document
  const deleteDocument = async (id: string): Promise<boolean> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const deleted = await vectorStore!.delete(id)
      
      if (deleted) {
        await refreshDocuments()
        await updateStats()
        
        if (autoSave && process.client) {
          await persistDocuments()
        }
      }
      
      state.lastOperation = `delete:${id}`
      state.operationCount++
      
      return deleted
    } catch (error: any) {
      state.error = error.message || 'Failed to delete document'
      return false
    } finally {
      state.isLoading = false
    }
  }

  // Delete multiple documents
  const deleteDocuments = async (ids: string[]): Promise<number> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const deletedCount = await vectorStore!.deleteBatch(ids)
      
      if (deletedCount > 0) {
        await refreshDocuments()
        await updateStats()
        
        if (autoSave && process.client) {
          await persistDocuments()
        }
      }
      
      state.lastOperation = `deleteBatch:${deletedCount}`
      state.operationCount++
      
      return deletedCount
    } catch (error: any) {
      state.error = error.message || 'Failed to delete documents'
      return 0
    } finally {
      state.isLoading = false
    }
  }

  // Clear all documents
  const clearDocuments = async (): Promise<void> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      await vectorStore!.clear()
      documents.value = []
      searchResults.value = []
      await updateStats()
      
      if (autoSave && process.client) {
        localStorage.removeItem(persistKey)
      }
      
      state.lastOperation = 'clear'
      state.operationCount++
    } catch (error: any) {
      state.error = error.message || 'Failed to clear documents'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Find similar documents
  const findSimilarDocuments = async (
    documentId: string, 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const searchOptions: VectorSearchOptions = {
        limit: defaultSearchLimit,
        threshold: defaultSearchThreshold,
        ...options
      }

      const results = await vectorStore!.findSimilarDocuments(documentId, searchOptions)
      
      state.lastOperation = `similar:${documentId}`
      state.operationCount++
      
      return results
    } catch (error: any) {
      state.error = error.message || 'Failed to find similar documents'
      throw error
    } finally {
      state.isLoading = false
    }
  }

  // Get documents by metadata filter
  const getDocumentsByMetadata = async (filter: (metadata: Record<string, any>) => boolean): Promise<VectorDocument[]> => {
    await ensureInitialized()

    try {
      const results = await vectorStore!.getDocumentsByMetadata(filter)
      state.lastOperation = 'getByMetadata'
      return results
    } catch (error: any) {
      state.error = error.message || 'Failed to get documents by metadata'
      return []
    }
  }

  // Cluster documents
  const clusterDocuments = async (threshold: number = 0.8): Promise<VectorDocument[][]> => {
    await ensureInitialized()

    state.isLoading = true
    state.error = null

    try {
      const clusters = await vectorStore!.clusterDocuments(threshold)
      
      state.lastOperation = `cluster:${threshold}`
      state.operationCount++
      
      return clusters
    } catch (error: any) {
      state.error = error.message || 'Failed to cluster documents'
      return []
    } finally {
      state.isLoading = false
    }
  }

  // Refresh documents from store
  const refreshDocuments = async (): Promise<void> => {
    if (!vectorStore) return

    try {
      const allDocs = await vectorStore.getAllDocuments()
      documents.value = allDocs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    } catch (error: any) {
      state.error = error.message || 'Failed to refresh documents'
    }
  }

  // Update statistics
  const updateStats = async (): Promise<void> => {
    if (!vectorStore) return

    try {
      state.stats = await vectorStore.stats()
    } catch (error: any) {
      console.warn('Failed to update stats:', error)
    }
  }

  // Persist documents to localStorage
  const persistDocuments = async (): Promise<void> => {
    if (!process.client || !vectorStore) return

    try {
      const allDocs = await vectorStore.getAllDocuments()
      const serializedDocs = JSON.stringify(allDocs)
      localStorage.setItem(persistKey, serializedDocs)
    } catch (error: any) {
      console.warn('Failed to persist documents:', error)
    }
  }

  // Load persisted documents from localStorage
  const loadPersistedDocuments = async (): Promise<void> => {
    if (!process.client || !vectorStore) return

    try {
      const serializedDocs = localStorage.getItem(persistKey)
      if (serializedDocs) {
        const docs: VectorDocument[] = JSON.parse(serializedDocs)
        if (docs.length > 0) {
          await vectorStore.addBatch(docs)
          await refreshDocuments()
        }
      }
    } catch (error: any) {
      console.warn('Failed to load persisted documents:', error)
    }
  }

  // Export documents
  const exportDocuments = async (): Promise<VectorDocument[]> => {
    await ensureInitialized()
    return await vectorStore!.getAllDocuments()
  }

  // Import documents
  const importDocuments = async (docs: VectorDocument[], replace: boolean = false): Promise<void> => {
    await ensureInitialized()

    if (replace) {
      await clearDocuments()
    }

    await addDocuments(docs)
  }

  // Clear search results
  const clearSearchResults = (): void => {
    searchResults.value = []
  }

  // Reset error state
  const clearError = (): void => {
    state.error = null
  }

  // Destroy store and cleanup
  const destroy = async (): Promise<void> => {
    if (vectorStore) {
      await vectorStore.destroy()
      vectorStore = null
    }
    
    documents.value = []
    searchResults.value = []
    isInitialized.value = false
    state.stats = null
    state.error = null
    state.lastOperation = null
    state.operationCount = 0
  }

  // Watch for document changes to auto-update stats
  watch(
    () => documents.value.length,
    async () => {
      if (isInitialized.value) {
        await updateStats()
      }
    }
  )

  // Initialize on client-side
  if (process.client) {
    initializeStore().catch(error => {
      console.error('Failed to initialize vector store:', error)
    })
  }

  return {
    // State
    state: readonly(state),
    documents: readonly(documents),
    searchResults: readonly(searchResults),
    isInitialized: readonly(isInitialized),

    // Computed
    documentCount,
    hasDocuments,
    isAtCapacity,
    documentsByMetadata,

    // Methods
    initializeStore,
    addDocument,
    addDocuments,
    searchByText,
    searchByEmbedding,
    getDocument,
    updateDocument,
    deleteDocument,
    deleteDocuments,
    clearDocuments,
    findSimilarDocuments,
    getDocumentsByMetadata,
    clusterDocuments,
    refreshDocuments,
    exportDocuments,
    importDocuments,
    clearSearchResults,
    clearError,
    destroy
  }
}

// Export types for convenience
export type { VectorDocument, VectorSearchResult, VectorSearchOptions, VectorStoreStats } from '@ai-nuxt/core'