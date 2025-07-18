import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MemoryVectorStore, VectorStoreFactory, type VectorDocument } from '@ai-nuxt/core'

// Test the core vector store functionality that would be used by the Vue composable
// This allows us to test the business logic without Vue dependencies

// Mock embedding generator for testing
const mockEmbeddingGenerator = async (text: string): Promise<number[]> => {
  // Generate deterministic embedding based on text content
  const hash = simpleHash(text)
  const dimensions = 384
  const embedding = new Array(dimensions).fill(0).map((_, i) => {
    return Math.sin((hash + i) * 0.1) * Math.cos((hash + i) * 0.05)
  })
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Sample documents for testing
const sampleDocuments: VectorDocument[] = [
  {
    id: 'doc1',
    content: 'The quick brown fox jumps over the lazy dog',
    embedding: [],
    metadata: { category: 'animals', type: 'sentence' }
  },
  {
    id: 'doc2',
    content: 'Machine learning is a subset of artificial intelligence',
    embedding: [],
    metadata: { category: 'technology', type: 'definition' }
  },
  {
    id: 'doc3',
    content: 'The cat sat on the mat',
    embedding: [],
    metadata: { category: 'animals', type: 'sentence' }
  }
]

describe('Vector Store Composable Core Functionality', () => {
  let vectorStore: MemoryVectorStore

  beforeEach(async () => {
    vectorStore = new MemoryVectorStore(mockEmbeddingGenerator)
  })

  afterEach(async () => {
    await vectorStore.destroy()
  })

  describe('Document Management', () => {
    it('should add and retrieve documents', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      const size = await vectorStore.size()
      expect(size).toBe(1)
      
      const retrieved = await vectorStore.get('doc1')
      expect(retrieved).toBeTruthy()
      expect(retrieved?.content).toBe(sampleDocuments[0].content)
    })

    it('should add documents in batch', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      const size = await vectorStore.size()
      expect(size).toBe(3)
      
      for (const doc of sampleDocuments) {
        const retrieved = await vectorStore.get(doc.id)
        expect(retrieved).toBeTruthy()
        expect(retrieved?.content).toBe(doc.content)
      }
    })

    it('should update existing documents', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      await vectorStore.updateDocument('doc1', 'Updated content', { updated: true })
      
      const updated = await vectorStore.get('doc1')
      expect(updated?.content).toBe('Updated content')
      expect(updated?.metadata?.updated).toBe(true)
    })

    it('should delete documents', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      const deleted = await vectorStore.delete('doc1')
      expect(deleted).toBe(true)
      
      const size = await vectorStore.size()
      expect(size).toBe(0)
    })

    it('should delete multiple documents', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      const deletedCount = await vectorStore.deleteBatch(['doc1', 'doc2'])
      expect(deletedCount).toBe(2)
      
      const size = await vectorStore.size()
      expect(size).toBe(1)
    })

    it('should clear all documents', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      await vectorStore.clear()
      
      const size = await vectorStore.size()
      expect(size).toBe(0)
    })
  })

  describe('Search Operations', () => {
    beforeEach(async () => {
      await vectorStore.addBatch(sampleDocuments)
    })

    it('should search documents by text', async () => {
      const results = await vectorStore.searchByText('fox animal', { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
      
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(-1)
        expect(result.similarity).toBeLessThanOrEqual(1)
        expect(result.document).toBeTruthy()
      })
    })

    it('should search documents by embedding', async () => {
      const queryEmbedding = await mockEmbeddingGenerator('test query')
      const results = await vectorStore.search(queryEmbedding, { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it('should find similar documents', async () => {
      const results = await vectorStore.findSimilarDocuments('doc1', { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      // Should not include the original document
      results.forEach(result => {
        expect(result.document.id).not.toBe('doc1')
      })
    })

    it('should respect search threshold', async () => {
      const results = await vectorStore.searchByText('test', {
        threshold: 0.8,
        limit: 5
      })
      
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.8)
      })
    })

    it('should filter by metadata', async () => {
      const results = await vectorStore.searchByText('animal', {
        filter: (doc) => doc.metadata?.category === 'animals'
      })
      
      results.forEach(result => {
        expect(result.document.metadata?.category).toBe('animals')
      })
    })
  })

  describe('Metadata Operations', () => {
    beforeEach(async () => {
      await vectorStore.addBatch(sampleDocuments)
    })

    it('should get documents by metadata filter', async () => {
      const animalDocs = await vectorStore.getDocumentsByMetadata(
        (metadata) => metadata.category === 'animals'
      )
      
      expect(animalDocs.length).toBe(2)
      animalDocs.forEach(doc => {
        expect(doc.metadata?.category).toBe('animals')
      })
    })

    it('should cluster documents by similarity', async () => {
      const clusters = await vectorStore.clusterDocuments(0.5)
      
      expect(clusters.length).toBeGreaterThan(0)
      
      // All documents should be in some cluster
      const allDocsInClusters = clusters.flat()
      expect(allDocsInClusters.length).toBe(sampleDocuments.length)
      
      // Each document should appear only once
      const docIds = allDocsInClusters.map(doc => doc.id)
      const uniqueIds = new Set(docIds)
      expect(uniqueIds.size).toBe(docIds.length)
    })
  })

  describe('Statistics and Performance', () => {
    it('should provide accurate statistics', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      const stats = await vectorStore.stats()
      
      expect(stats.totalDocuments).toBe(3)
      expect(stats.totalEmbeddings).toBe(3)
      expect(stats.averageEmbeddingDimension).toBeGreaterThan(0)
      expect(stats.memoryUsage).toBeGreaterThan(0)
      expect(stats.lastUpdated).toBeGreaterThan(0)
    })

    it('should handle large datasets efficiently', async () => {
      // Generate test documents
      const documents = Array.from({ length: 50 }, (_, i) => ({
        id: `doc-${i}`,
        content: `This is test document number ${i} with content about topic ${i % 5}`,
        embedding: [],
        metadata: { topic: i % 5, index: i }
      }))
      
      const startTime = Date.now()
      await vectorStore.addBatch(documents)
      const addTime = Date.now() - startTime
      
      expect(addTime).toBeLessThan(3000) // Should complete within 3 seconds
      
      const searchStartTime = Date.now()
      const results = await vectorStore.searchByText('test document', { limit: 10 })
      const searchTime = Date.now() - searchStartTime
      
      expect(searchTime).toBeLessThan(1000) // Should search within 1 second
      expect(results.length).toBe(10)
      
      const stats = await vectorStore.stats()
      expect(stats.totalDocuments).toBe(50)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid document operations', async () => {
      // Try to get non-existent document
      const nonExistent = await vectorStore.get('nonexistent')
      expect(nonExistent).toBeNull()
      
      // Try to delete non-existent document
      const deleted = await vectorStore.delete('nonexistent')
      expect(deleted).toBe(false)
      
      // Try to find similar documents for non-existent document
      await expect(vectorStore.findSimilarDocuments('nonexistent')).rejects.toThrow()
    })

    it('should handle documents without embeddings', async () => {
      const docWithoutEmbedding = {
        id: 'no-embedding',
        content: 'This document has no embedding',
        embedding: []
      }
      
      await vectorStore.add(docWithoutEmbedding)
      
      const retrieved = await vectorStore.get('no-embedding')
      expect(retrieved).toBeTruthy()
      expect(retrieved?.embedding.length).toBeGreaterThan(0)
    })

    it('should handle empty search results', async () => {
      const results = await vectorStore.searchByText('nonexistent content', {
        threshold: 0.99 // Very high threshold
      })
      
      expect(results).toEqual([])
    })
  })
})

describe('Vector Store Factory', () => {
  it('should create memory store with embedding generator', () => {
    const store = VectorStoreFactory.createMemoryStore(mockEmbeddingGenerator)
    expect(store).toBeInstanceOf(MemoryVectorStore)
  })

  it('should create store from existing documents', async () => {
    const documents = [
      { id: 'doc1', content: 'First document', metadata: { type: 'test' } },
      { id: 'doc2', content: 'Second document', metadata: { type: 'test' } }
    ]

    const store = await VectorStoreFactory.createFromDocuments(documents, mockEmbeddingGenerator)
    
    const size = await store.size()
    expect(size).toBe(2)
    
    const doc1 = await store.get('doc1')
    expect(doc1?.content).toBe('First document')
    expect(doc1?.embedding.length).toBeGreaterThan(0)
    
    await store.destroy()
  })
})

describe('Composable Integration Scenarios', () => {
  it('should support reactive document management patterns', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Simulate reactive state updates
    let documentCount = 0
    let hasDocuments = false
    
    const updateState = async () => {
      documentCount = await store.size()
      hasDocuments = documentCount > 0
    }
    
    await updateState()
    expect(documentCount).toBe(0)
    expect(hasDocuments).toBe(false)
    
    await store.add(sampleDocuments[0])
    await updateState()
    expect(documentCount).toBe(1)
    expect(hasDocuments).toBe(true)
    
    await store.clear()
    await updateState()
    expect(documentCount).toBe(0)
    expect(hasDocuments).toBe(false)
    
    await store.destroy()
  })

  it('should support search result management', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    await store.addBatch(sampleDocuments)
    
    // Simulate search results state
    let searchResults: any[] = []
    
    searchResults = await store.searchByText('fox')
    expect(searchResults.length).toBeGreaterThan(0)
    
    // Clear search results
    searchResults = []
    expect(searchResults.length).toBe(0)
    
    await store.destroy()
  })

  it('should support persistence patterns', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Add documents
    await store.addBatch(sampleDocuments)
    
    // Export documents (simulating persistence)
    const exported = await store.getAllDocuments()
    expect(exported.length).toBe(3)
    
    // Clear and reimport (simulating load from persistence)
    await store.clear()
    expect(await store.size()).toBe(0)
    
    await store.addBatch(exported)
    expect(await store.size()).toBe(3)
    
    await store.destroy()
  })

  it('should support capacity management', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    const maxDocuments = 2
    
    // Simulate capacity checking
    const isAtCapacity = () => store.size().then(size => size >= maxDocuments)
    
    expect(await isAtCapacity()).toBe(false)
    
    await store.addBatch(sampleDocuments.slice(0, 2))
    expect(await isAtCapacity()).toBe(true)
    
    // Should not add more documents when at capacity
    const currentSize = await store.size()
    expect(currentSize).toBe(2)
    
    await store.destroy()
  })
})