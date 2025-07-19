import { describe, it, expect, beforeEach } from 'vitest'
import {
  MemoryVectorStore,
  VectorStoreFactory,
  VectorUtils,
  type VectorDocument,
  type VectorSearchOptions
} from '../vector-store'

// Mock embedding generator for testing
const mockEmbeddingGenerator = async (text: string): Promise<number[]> => {
  // Generate deterministic embedding based on text content
  const hash = simpleHash(text)
  const dimensions = 384
  const embedding = new Array(dimensions).fill(0).map((_, i) => {
    return Math.sin((hash + i) * 0.1) * Math.cos((hash + i) * 0.05)
  })
  
  // Normalize the embedding
  return VectorUtils.normalizeVector(embedding)
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

describe('MemoryVectorStore', () => {
  let vectorStore: MemoryVectorStore
  let sampleDocuments: VectorDocument[]

  beforeEach(async () => {
    vectorStore = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Create sample documents
    sampleDocuments = [
      {
        id: 'doc1',
        content: 'The quick brown fox jumps over the lazy dog',
        embedding: await mockEmbeddingGenerator('The quick brown fox jumps over the lazy dog'),
        metadata: { category: 'animals', type: 'sentence' }
      },
      {
        id: 'doc2',
        content: 'Machine learning is a subset of artificial intelligence',
        embedding: await mockEmbeddingGenerator('Machine learning is a subset of artificial intelligence'),
        metadata: { category: 'technology', type: 'definition' }
      },
      {
        id: 'doc3',
        content: 'The cat sat on the mat',
        embedding: await mockEmbeddingGenerator('The cat sat on the mat'),
        metadata: { category: 'animals', type: 'sentence' }
      }
    ]
  })

  describe('Basic Operations', () => {
    it('should add a document', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      const size = await vectorStore.size()
      expect(size).toBe(1)
      
      const retrieved = await vectorStore.get('doc1')
      expect(retrieved).toBeTruthy()
      expect(retrieved?.content).toBe(sampleDocuments[0].content)
    })

    it('should add a document without embedding and generate one', async () => {
      const docWithoutEmbedding = {
        id: 'doc-no-embedding',
        content: 'This document has no embedding',
        embedding: [],
        metadata: { test: true }
      }

      await vectorStore.add(docWithoutEmbedding)
      
      const retrieved = await vectorStore.get('doc-no-embedding')
      expect(retrieved).toBeTruthy()
      expect(retrieved?.embedding.length).toBeGreaterThan(0)
    })

    it('should add multiple documents in batch', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      const size = await vectorStore.size()
      expect(size).toBe(3)
      
      for (const doc of sampleDocuments) {
        const retrieved = await vectorStore.get(doc.id)
        expect(retrieved).toBeTruthy()
        expect(retrieved?.content).toBe(doc.content)
      }
    })

    it('should update existing document', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      const updatedDoc = {
        ...sampleDocuments[0],
        content: 'Updated content',
        metadata: { updated: true }
      }
      
      await vectorStore.add(updatedDoc)
      
      const size = await vectorStore.size()
      expect(size).toBe(1) // Should not increase size
      
      const retrieved = await vectorStore.get('doc1')
      expect(retrieved?.content).toBe('Updated content')
      expect(retrieved?.metadata?.updated).toBe(true)
    })

    it('should delete a document', async () => {
      await vectorStore.add(sampleDocuments[0])
      
      const deleted = await vectorStore.delete('doc1')
      expect(deleted).toBe(true)
      
      const size = await vectorStore.size()
      expect(size).toBe(0)
      
      const retrieved = await vectorStore.get('doc1')
      expect(retrieved).toBeNull()
    })

    it('should delete multiple documents in batch', async () => {
      await vectorStore.addBatch(sampleDocuments)
      
      const deletedCount = await vectorStore.deleteBatch(['doc1', 'doc2', 'nonexistent'])
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

    it('should search by embedding vector', async () => {
      const queryEmbedding = await mockEmbeddingGenerator('brown fox')
      
      const results = await vectorStore.search(queryEmbedding, { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
      
      // Results should be sorted by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
      }
    })

    it('should search by text', async () => {
      const results = await vectorStore.searchByText('machine learning AI', { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(2)
      
      // Results should have similarity scores
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(-1)
        expect(result.similarity).toBeLessThanOrEqual(1)
        expect(result.distance).toBeGreaterThanOrEqual(0)
        expect(result.distance).toBeLessThanOrEqual(2)
      })
    })

    it('should respect similarity threshold', async () => {
      const results = await vectorStore.searchByText('completely unrelated quantum physics', {
        threshold: 0.9 // High threshold
      })
      
      // With high threshold, might not find any results
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9)
      })
    })

    it('should apply metadata filter', async () => {
      const results = await vectorStore.searchByText('animal', {
        filter: (doc) => doc.metadata?.category === 'animals'
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.document.metadata?.category).toBe('animals')
      })
    })

    it('should exclude metadata when requested', async () => {
      const results = await vectorStore.searchByText('fox', {
        includeMetadata: false
      })
      
      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.document.metadata).toBeUndefined()
      })
    })

    it('should find similar documents to a given document', async () => {
      const results = await vectorStore.findSimilarDocuments('doc1', { limit: 2 })
      
      expect(results.length).toBeGreaterThan(0)
      // Should not include the original document
      results.forEach(result => {
        expect(result.document.id).not.toBe('doc1')
      })
    })
  })

  describe('Document Management', () => {
    beforeEach(async () => {
      await vectorStore.addBatch(sampleDocuments)
    })

    it('should update document content', async () => {
      await vectorStore.updateDocument('doc1', 'New content for document 1', { updated: true })
      
      const retrieved = await vectorStore.get('doc1')
      expect(retrieved?.content).toBe('New content for document 1')
      expect(retrieved?.metadata?.updated).toBe(true)
      expect(retrieved?.embedding.length).toBeGreaterThan(0)
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

    it('should get all documents', async () => {
      const allDocs = await vectorStore.getAllDocuments()
      
      expect(allDocs.length).toBe(sampleDocuments.length)
      
      const docIds = allDocs.map(doc => doc.id).sort()
      const expectedIds = sampleDocuments.map(doc => doc.id).sort()
      expect(docIds).toEqual(expectedIds)
    })
  })

  describe('Statistics and Metadata', () => {
    beforeEach(async () => {
      await vectorStore.addBatch(sampleDocuments)
    })

    it('should provide accurate statistics', async () => {
      const stats = await vectorStore.stats()
      
      expect(stats.totalDocuments).toBe(3)
      expect(stats.totalEmbeddings).toBe(3)
      expect(stats.averageEmbeddingDimension).toBeGreaterThan(0)
      expect(stats.memoryUsage).toBeGreaterThan(0)
      expect(stats.lastUpdated).toBeGreaterThan(0)
    })

    it('should handle empty store statistics', async () => {
      const emptyStore = new MemoryVectorStore(mockEmbeddingGenerator)
      const stats = await emptyStore.stats()
      
      expect(stats.totalDocuments).toBe(0)
      expect(stats.totalEmbeddings).toBe(0)
      expect(stats.averageEmbeddingDimension).toBe(0)
      expect(stats.memoryUsage).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when adding document without id', async () => {
      const invalidDoc = {
        id: '',
        content: 'Content without id',
        embedding: []
      }

      await expect(vectorStore.add(invalidDoc)).rejects.toThrow('Document must have id and content')
    })

    it('should throw error when adding document without content', async () => {
      const invalidDoc = {
        id: 'doc1',
        content: '',
        embedding: []
      }

      await expect(vectorStore.add(invalidDoc)).rejects.toThrow('Document must have id and content')
    })

    it('should throw error when searching by text without embedding generator', async () => {
      const storeWithoutGenerator = new MemoryVectorStore()
      
      await expect(storeWithoutGenerator.searchByText('test')).rejects.toThrow(
        'No embedding generator available for text search'
      )
    })

    it('should throw error when finding similar documents for non-existent document', async () => {
      await expect(vectorStore.findSimilarDocuments('nonexistent')).rejects.toThrow(
        'Document with id nonexistent not found'
      )
    })

    it('should throw error when updating non-existent document', async () => {
      await expect(vectorStore.updateDocument('nonexistent', 'new content')).rejects.toThrow(
        'Document with id nonexistent not found'
      )
    })
  })
})

describe('VectorStoreFactory', () => {
  it('should create memory store', () => {
    const store = VectorStoreFactory.createMemoryStore(mockEmbeddingGenerator)
    expect(store).toBeInstanceOf(MemoryVectorStore)
  })

  it('should create store from documents', async () => {
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
  })
})

describe('VectorUtils', () => {
  describe('Vector Operations', () => {
    it('should normalize vector to unit length', () => {
      const vector = [3, 4]
      const normalized = VectorUtils.normalizeVector(vector)

      expect(normalized[0]).toBeCloseTo(0.6)
      expect(normalized[1]).toBeCloseTo(0.8)

      // Check unit length
      const magnitude = VectorUtils.vectorMagnitude(normalized)
      expect(magnitude).toBeCloseTo(1)
    })

    it('should calculate vector magnitude', () => {
      const vector = [3, 4]
      const magnitude = VectorUtils.vectorMagnitude(vector)
      expect(magnitude).toBe(5)
    })

    it('should add vectors', () => {
      const a = [1, 2, 3]
      const b = [4, 5, 6]
      const result = VectorUtils.addVectors(a, b)
      expect(result).toEqual([5, 7, 9])
    })

    it('should subtract vectors', () => {
      const a = [4, 5, 6]
      const b = [1, 2, 3]
      const result = VectorUtils.subtractVectors(a, b)
      expect(result).toEqual([3, 3, 3])
    })

    it('should calculate centroid of vectors', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ]
      const centroid = VectorUtils.calculateCentroid(vectors)
      expect(centroid).toEqual([4, 5, 6])
    })

    it('should calculate cosine similarity', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      const c = [1, 0, 0]

      expect(VectorUtils.cosineSimilarity(a, b)).toBe(0)
      expect(VectorUtils.cosineSimilarity(a, c)).toBe(1)
    })

    it('should find diverse vectors', () => {
      const vectors = [
        [1, 0, 0],
        [1, 0.1, 0], // Similar to first
        [0, 1, 0],   // Different
        [0, 0, 1],   // Different
        [0, 1, 0.1]  // Similar to third
      ]

      const diverse = VectorUtils.findDiverseVectors(vectors, 3)
      expect(diverse.length).toBe(3)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for different length vectors in operations', () => {
      const a = [1, 2]
      const b = [1, 2, 3]

      expect(() => VectorUtils.addVectors(a, b)).toThrow('Vectors must have the same length')
      expect(() => VectorUtils.subtractVectors(a, b)).toThrow('Vectors must have the same length')
      expect(() => VectorUtils.cosineSimilarity(a, b)).toThrow('Vectors must have the same length')
    })

    it('should handle empty vector arrays', () => {
      const centroid = VectorUtils.calculateCentroid([])
      expect(centroid).toEqual([])

      const diverse = VectorUtils.findDiverseVectors([], 3)
      expect(diverse).toEqual([])
    })

    it('should handle zero vectors in normalization', () => {
      const zeroVector = [0, 0, 0]
      const normalized = VectorUtils.normalizeVector(zeroVector)
      expect(normalized).toEqual([0, 0, 0])
    })
  })
})

describe('Integration Tests', () => {
  it('should work end-to-end with document storage and search', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Add documents
    const documents = [
      { id: '1', content: 'JavaScript is a programming language', embedding: [], metadata: { lang: 'js' } },
      { id: '2', content: 'Python is great for data science', embedding: [], metadata: { lang: 'python' } },
      { id: '3', content: 'TypeScript adds types to JavaScript', embedding: [], metadata: { lang: 'ts' } }
    ]
    
    await store.addBatch(documents)
    
    // Search for programming-related content
    const results = await store.searchByText('programming language', { limit: 2 })
    
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(2)
    
    // Should find programming-related documents
    const foundLangs = results.map(r => r.document.metadata?.lang)
    expect(foundLangs.length).toBeGreaterThan(0)
    
    // Verify all results have valid metadata
    results.forEach(result => {
      expect(result.document.metadata?.lang).toBeTruthy()
      expect(['js', 'python', 'ts']).toContain(result.document.metadata?.lang)
    })
  })

  it('should handle large dataset efficiently', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Generate test documents
    const documents = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i}`,
      content: `This is test document number ${i} with some content about topic ${i % 10}`,
      embedding: [],
      metadata: { topic: i % 10, index: i }
    }))
    
    const startTime = Date.now()
    await store.addBatch(documents)
    const addTime = Date.now() - startTime
    
    expect(addTime).toBeLessThan(5000) // Should complete within 5 seconds
    
    const searchStartTime = Date.now()
    const results = await store.searchByText('test document', { limit: 10 })
    const searchTime = Date.now() - searchStartTime
    
    expect(searchTime).toBeLessThan(1000) // Should search within 1 second
    expect(results.length).toBe(10)
    
    const stats = await store.stats()
    expect(stats.totalDocuments).toBe(100)
  })

  it('should maintain consistency across operations', async () => {
    const store = new MemoryVectorStore(mockEmbeddingGenerator)
    
    // Add initial documents
    await store.add({ id: '1', content: 'First document', embedding: [] })
    await store.add({ id: '2', content: 'Second document', embedding: [] })
    
    expect(await store.size()).toBe(2)
    
    // Update document
    await store.updateDocument('1', 'Updated first document')
    expect(await store.size()).toBe(2) // Size should remain the same
    
    const updated = await store.get('1')
    expect(updated?.content).toBe('Updated first document')
    
    // Delete document
    await store.delete('2')
    expect(await store.size()).toBe(1)
    
    // Clear all
    await store.clear()
    expect(await store.size()).toBe(0)
  })
})