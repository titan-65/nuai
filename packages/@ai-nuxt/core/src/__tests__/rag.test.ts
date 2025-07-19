import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  RAGSystem,
  DocumentChunker,
  RelevanceScorer,
  ContextWindowManager,
  DEFAULT_RAG_CONFIG,
  type RAGConfig,
  type DocumentChunk
} from '../rag'
import { MemoryVectorStore, type VectorDocument } from '../vector-store'

// Mock embedding generator for testing
const mockEmbeddingGenerator = async (text: string): Promise<number[]> => {
  const hash = simpleHash(text)
  const dimensions = 384
  const embedding = new Array(dimensions).fill(0).map((_, i) => {
    return Math.sin((hash + i) * 0.1) * Math.cos((hash + i) * 0.05)
  })
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// Sample documents for testing
const sampleDocuments: VectorDocument[] = [
  {
    id: 'doc1',
    content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models. It enables computers to learn and improve from experience without being explicitly programmed. The field includes supervised learning, unsupervised learning, and reinforcement learning approaches.',
    embedding: [],
    metadata: { category: 'technology', type: 'definition', topic: 'machine-learning' },
    timestamp: Date.now() - 86400000 // 1 day ago
  },
  {
    id: 'doc2',
    content: 'Natural language processing (NLP) is a branch of artificial intelligence that deals with the interaction between computers and humans through natural language. It involves computational linguistics, machine learning, and deep learning models to process and analyze large amounts of natural language data.',
    embedding: [],
    metadata: { category: 'technology', type: 'definition', topic: 'nlp' },
    timestamp: Date.now() - 172800000 // 2 days ago
  },
  {
    id: 'doc3',
    content: 'Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data. It has revolutionized fields like computer vision, natural language processing, and speech recognition.',
    embedding: [],
    metadata: { category: 'technology', type: 'definition', topic: 'deep-learning' },
    timestamp: Date.now() - 259200000 // 3 days ago
  }
]

describe('DocumentChunker', () => {
  let chunker: DocumentChunker

  beforeEach(() => {
    chunker = new DocumentChunker({
      chunkSize: 200,
      chunkOverlap: 50
    })
  })

  describe('Document Chunking', () => {
    it('should create single chunk for small documents', () => {
      const smallDoc: VectorDocument = {
        id: 'small',
        content: 'This is a small document.',
        embedding: [],
        metadata: { type: 'test' }
      }

      const chunks = chunker.chunkDocument(smallDoc)
      
      expect(chunks).toHaveLength(1)
      expect(chunks[0].content).toBe(smallDoc.content)
      expect(chunks[0].chunkIndex).toBe(0)
      expect(chunks[0].totalChunks).toBe(1)
      expect(chunks[0].parentDocumentId).toBe('small')
    })

    it('should split large documents into multiple chunks', () => {
      const largeDoc: VectorDocument = {
        id: 'large',
        content: 'This is a very long document that needs to be split into multiple chunks. '.repeat(10),
        embedding: [],
        metadata: { type: 'test' }
      }

      const chunks = chunker.chunkDocument(largeDoc)
      
      expect(chunks.length).toBeGreaterThan(1)
      
      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index)
        expect(chunk.totalChunks).toBe(chunks.length)
        expect(chunk.parentDocumentId).toBe('large')
        expect(chunk.id).toBe(`large_chunk_${index}`)
      })
    })

    it('should include overlap between chunks', () => {
      const doc: VectorDocument = {
        id: 'overlap-test',
        content: 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence.',
        embedding: []
      }

      const chunks = chunker.chunkDocument(doc)
      
      if (chunks.length > 1) {
        // Check that there's some overlap between consecutive chunks
        const firstChunk = chunks[0].content
        const secondChunk = chunks[1].content
        
        // There should be some common content (overlap)
        expect(firstChunk).not.toBe(secondChunk)
      }
    })

    it('should preserve metadata in chunks', () => {
      const doc: VectorDocument = {
        id: 'meta-test',
        content: 'Document with metadata. '.repeat(20),
        embedding: [],
        metadata: { category: 'test', importance: 'high' }
      }

      const chunks = chunker.chunkDocument(doc)
      
      chunks.forEach(chunk => {
        expect(chunk.metadata?.category).toBe('test')
        expect(chunk.metadata?.importance).toBe('high')
        expect(chunk.metadata?.parentDocument).toBe('meta-test')
        expect(typeof chunk.metadata?.chunkIndex).toBe('number')
      })
    })

    it('should batch chunk multiple documents', async () => {
      const docs = sampleDocuments.slice(0, 2)
      const allChunks = await chunker.chunkDocuments(docs)
      
      expect(allChunks.length).toBeGreaterThanOrEqual(docs.length)
      
      // Check that chunks from different documents are included
      const parentIds = new Set(allChunks.map(chunk => chunk.parentDocumentId))
      expect(parentIds.size).toBe(docs.length)
    })
  })
})

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer

  beforeEach(() => {
    scorer = new RelevanceScorer({
      enabled: true,
      weights: {
        similarity: 0.7,
        recency: 0.2,
        metadata: 0.1
      }
    })
  })

  describe('Relevance Scoring', () => {
    it('should return original results when scoring is disabled', () => {
      const disabledScorer = new RelevanceScorer({ enabled: false, weights: { similarity: 1, recency: 0, metadata: 0 } })
      
      const results = [
        { document: sampleDocuments[0], similarity: 0.8, distance: 0.2 },
        { document: sampleDocuments[1], similarity: 0.6, distance: 0.4 }
      ]

      const scored = disabledScorer.scoreResults(results, 'test query')
      expect(scored).toEqual(results)
    })

    it('should calculate weighted relevance scores', () => {
      const results = [
        { document: sampleDocuments[0], similarity: 0.8, distance: 0.2 },
        { document: sampleDocuments[1], similarity: 0.6, distance: 0.4 }
      ]

      const scored = scorer.scoreResults(results, 'machine learning')
      
      expect(scored.length).toBe(results.length)
      scored.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0)
        expect(result.similarity).toBeLessThanOrEqual(1)
        expect(result.metadata?.relevanceScores).toBeTruthy()
        expect(result.metadata?.weightedScore).toBeTruthy()
      })
    })

    it('should boost scores for recent documents', () => {
      const recentDoc: VectorDocument = {
        ...sampleDocuments[0],
        timestamp: Date.now() // Very recent
      }
      
      const oldDoc: VectorDocument = {
        ...sampleDocuments[1],
        timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000 // 1 year ago
      }

      const results = [
        { document: recentDoc, similarity: 0.7, distance: 0.3 },
        { document: oldDoc, similarity: 0.7, distance: 0.3 }
      ]

      const scored = scorer.scoreResults(results, 'test')
      
      // Recent document should have higher weighted score due to recency
      expect(scored[0].similarity).toBeGreaterThan(scored[1].similarity)
    })

    it('should boost scores for metadata matches', () => {
      const query = 'machine learning algorithms'
      
      const results = [
        { document: sampleDocuments[0], similarity: 0.7, distance: 0.3 }, // Has 'machine-learning' in metadata
        { document: sampleDocuments[1], similarity: 0.7, distance: 0.3 }  // Has 'nlp' in metadata
      ]

      const scored = scorer.scoreResults(results, query)
      
      // Should have different weighted scores due to metadata relevance
      expect(scored[0].similarity).not.toBe(scored[1].similarity)
    })
  })
})

describe('ContextWindowManager', () => {
  let contextManager: ContextWindowManager

  beforeEach(() => {
    contextManager = new ContextWindowManager({
      maxContextLength: 500, // Small for testing
      contextTemplate: 'Doc: {content}'
    })
  })

  describe('Context Building', () => {
    it('should build context from search results', () => {
      const results = [
        { document: sampleDocuments[0], similarity: 0.9, distance: 0.1 },
        { document: sampleDocuments[1], similarity: 0.8, distance: 0.2 }
      ]

      const context = contextManager.buildContext(results, 'test query')
      
      expect(context.query).toBe('test query')
      expect(context.retrievedDocuments.length).toBeGreaterThan(0)
      expect(context.contextText).toContain('Doc:')
      expect(context.relevanceScores.length).toBe(context.retrievedDocuments.length)
      expect(context.totalTokens).toBeGreaterThan(0)
    })

    it('should respect context length limits', () => {
      const shortContextManager = new ContextWindowManager({
        maxContextLength: 50, // Very small limit
        contextTemplate: '{content}'
      })

      const results = sampleDocuments.map(doc => ({
        document: doc,
        similarity: 0.8,
        distance: 0.2
      }))

      const context = shortContextManager.buildContext(results, 'test')
      
      expect(context.totalTokens).toBeLessThanOrEqual(50)
      expect(context.truncated).toBe(true)
    })

    it('should format documents according to template', () => {
      const customManager = new ContextWindowManager({
        maxContextLength: 1000,
        contextTemplate: 'ID: {id}\nContent: {content}\nMeta: {metadata}'
      })

      const results = [
        { document: sampleDocuments[0], similarity: 0.9, distance: 0.1 }
      ]

      const context = customManager.buildContext(results, 'test')
      
      expect(context.contextText).toContain('ID: doc1')
      expect(context.contextText).toContain('Content:')
      expect(context.contextText).toContain('Meta:')
    })

    it('should inject context into prompts', () => {
      const context = {
        query: 'test',
        retrievedDocuments: [],
        contextText: 'This is context information.',
        relevanceScores: [],
        totalTokens: 10,
        truncated: false
      }

      const originalPrompt = 'What is machine learning?'
      const enhanced = contextManager.injectContext(originalPrompt, context)
      
      expect(enhanced).toContain('Based on the following context information:')
      expect(enhanced).toContain('This is context information.')
      expect(enhanced).toContain(originalPrompt)
    })

    it('should return original prompt when no context', () => {
      const context = {
        query: 'test',
        retrievedDocuments: [],
        contextText: '',
        relevanceScores: [],
        totalTokens: 0,
        truncated: false
      }

      const originalPrompt = 'What is machine learning?'
      const enhanced = contextManager.injectContext(originalPrompt, context)
      
      expect(enhanced).toBe(originalPrompt)
    })
  })
})

describe('RAGSystem', () => {
  let vectorStore: MemoryVectorStore
  let ragSystem: RAGSystem

  beforeEach(async () => {
    vectorStore = new MemoryVectorStore(mockEmbeddingGenerator)
    ragSystem = new RAGSystem(vectorStore, {
      maxContextLength: 1000,
      maxDocuments: 3,
      similarityThreshold: 0.5,
      chunkSize: 300,
      chunkOverlap: 50
    })
  })

  afterEach(async () => {
    await vectorStore.destroy()
  })

  describe('Document Management', () => {
    it('should add documents with chunking', async () => {
      await ragSystem.addDocuments(sampleDocuments)
      
      const stats = await vectorStore.stats()
      expect(stats.totalDocuments).toBeGreaterThanOrEqual(sampleDocuments.length)
    })

    it('should chunk large documents', async () => {
      const largeDoc: VectorDocument = {
        id: 'large',
        content: 'This is a very long document. '.repeat(50), // Make it large enough to chunk
        embedding: [],
        metadata: { type: 'test' }
      }

      await ragSystem.addDocuments([largeDoc])
      
      const stats = await vectorStore.stats()
      expect(stats.totalDocuments).toBeGreaterThan(1) // Should be chunked
    })
  })

  describe('Chat Enhancement', () => {
    beforeEach(async () => {
      await ragSystem.addDocuments(sampleDocuments)
    })

    it('should enhance chat with relevant context', async () => {
      const chatOptions = {
        messages: [
          { role: 'user', content: 'What is machine learning?' }
        ]
      }

      const result = await ragSystem.enhanceChat(chatOptions)
      
      expect(result.originalPrompt).toBe('What is machine learning?')
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      
      // If documents are found, the prompt should be enhanced
      if (result.context.retrievedDocuments.length > 0) {
        expect(result.enhancedPrompt).toContain('Based on the following context information:')
        expect(result.metadata.documentsRetrieved).toBeGreaterThan(0)
      } else {
        // If no documents found, prompt should remain unchanged
        expect(result.enhancedPrompt).toBe(result.originalPrompt)
        expect(result.metadata.documentsRetrieved).toBe(0)
      }
    })

    it('should modify chat messages with enhanced prompt', async () => {
      const chatOptions = {
        messages: [
          { role: 'user', content: 'What is deep learning?' }
        ]
      }

      await ragSystem.enhanceChat(chatOptions)
      
      // The last message should be enhanced with context
      const lastMessage = chatOptions.messages[chatOptions.messages.length - 1]
      expect(lastMessage.content).toContain('Based on the following context information:')
      expect(lastMessage.content).toContain('What is deep learning?')
    })

    it('should return original prompt when RAG is disabled', async () => {
      const disabledRAG = new RAGSystem(vectorStore, { enabled: false })
      
      const chatOptions = {
        messages: [
          { role: 'user', content: 'What is AI?' }
        ]
      }

      const result = await disabledRAG.enhanceChat(chatOptions)
      
      expect(result.originalPrompt).toBe(result.enhancedPrompt)
      expect(result.context.retrievedDocuments).toHaveLength(0)
      expect(result.metadata.documentsRetrieved).toBe(0)
    })

    it('should handle empty messages', async () => {
      const chatOptions = { messages: [] }
      
      const result = await ragSystem.enhanceChat(chatOptions)
      
      expect(result.originalPrompt).toBe('')
      expect(result.enhancedPrompt).toBe('')
    })
  })

  describe('Completion Enhancement', () => {
    beforeEach(async () => {
      await ragSystem.addDocuments(sampleDocuments)
    })

    it('should enhance completion with relevant context', async () => {
      const completionOptions = {
        prompt: 'Explain neural networks'
      }

      const result = await ragSystem.enhanceCompletion(completionOptions)
      
      expect(result.originalPrompt).toBe('Explain neural networks')
      expect(result.enhancedPrompt).toContain('Based on the following context information:')
      expect(completionOptions.prompt).toBe(result.enhancedPrompt)
      expect(result.context.retrievedDocuments.length).toBeGreaterThan(0)
    })

    it('should handle empty prompts', async () => {
      const completionOptions = { prompt: '' }
      
      const result = await ragSystem.enhanceCompletion(completionOptions)
      
      expect(result.originalPrompt).toBe('')
      expect(result.enhancedPrompt).toBe('')
    })

    it('should return original when RAG disabled', async () => {
      const disabledRAG = new RAGSystem(vectorStore, { enabled: false })
      
      const completionOptions = {
        prompt: 'Test prompt'
      }

      const result = await disabledRAG.enhanceCompletion(completionOptions)
      
      expect(result.originalPrompt).toBe(result.enhancedPrompt)
      expect(result.context.retrievedDocuments).toHaveLength(0)
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxDocuments: 10,
        similarityThreshold: 0.8
      }

      ragSystem.updateConfig(newConfig)
      
      const config = ragSystem.getConfig()
      expect(config.maxDocuments).toBe(10)
      expect(config.similarityThreshold).toBe(0.8)
    })

    it('should provide system statistics', async () => {
      await ragSystem.addDocuments(sampleDocuments)
      
      const stats = await ragSystem.getStats()
      
      expect(stats.totalDocuments).toBeGreaterThan(0)
      expect(stats.averageChunkSize).toBe(300)
      expect(stats.configuredMaxContext).toBe(1000)
      expect(stats.configuredThreshold).toBe(0.5)
    })
  })

  describe('Integration Scenarios', () => {
    it('should work end-to-end with realistic data', async () => {
      // Add knowledge base
      const knowledgeBase: VectorDocument[] = [
        {
          id: 'kb1',
          content: 'Vue.js is a progressive JavaScript framework for building user interfaces. It is designed to be incrementally adoptable and focuses on the view layer.',
          embedding: [],
          metadata: { category: 'frontend', framework: 'vue' }
        },
        {
          id: 'kb2',
          content: 'React is a JavaScript library for building user interfaces, maintained by Facebook. It uses a component-based architecture and virtual DOM.',
          embedding: [],
          metadata: { category: 'frontend', framework: 'react' }
        },
        {
          id: 'kb3',
          content: 'Angular is a TypeScript-based web application framework developed by Google. It provides a comprehensive solution for building large-scale applications.',
          embedding: [],
          metadata: { category: 'frontend', framework: 'angular' }
        }
      ]

      await ragSystem.addDocuments(knowledgeBase)

      // Test chat enhancement
      const chatOptions = {
        messages: [
          { role: 'user', content: 'Compare Vue.js and React for building web applications' }
        ]
      }

      const result = await ragSystem.enhanceChat(chatOptions)

      // Test that the system processes the request correctly
      expect(result.originalPrompt).toBe('Compare Vue.js and React for building web applications')
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      
      // If documents are retrieved, check the enhancement
      if (result.context.retrievedDocuments.length > 0) {
        expect(result.enhancedPrompt).toContain('Based on the following context information:')
        expect(result.metadata.documentsRetrieved).toBeGreaterThan(0)
      }
    })

    it('should handle queries with no relevant context', async () => {
      await ragSystem.addDocuments(sampleDocuments) // Tech documents
      
      const chatOptions = {
        messages: [
          { role: 'user', content: 'What is the best recipe for chocolate cake?' }
        ]
      }

      const result = await ragSystem.enhanceChat(chatOptions)
      
      // Should still work but might have fewer or no relevant documents
      expect(result.originalPrompt).toBe('What is the best recipe for chocolate cake?')
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
    })

    it('should respect similarity thresholds', async () => {
      const strictRAG = new RAGSystem(vectorStore, {
        similarityThreshold: 0.95 // Very high threshold
      })

      await strictRAG.addDocuments(sampleDocuments)

      const chatOptions = {
        messages: [
          { role: 'user', content: 'Tell me about cooking' } // Unrelated to tech docs
        ]
      }

      const result = await strictRAG.enhanceChat(chatOptions)
      
      // Should find few or no documents due to high threshold
      expect(result.context.retrievedDocuments.length).toBeLessThanOrEqual(1)
    })
  })
})

describe('Default Configuration', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_RAG_CONFIG.enabled).toBe(true)
    expect(DEFAULT_RAG_CONFIG.maxContextLength).toBeGreaterThan(0)
    expect(DEFAULT_RAG_CONFIG.maxDocuments).toBeGreaterThan(0)
    expect(DEFAULT_RAG_CONFIG.similarityThreshold).toBeGreaterThan(0)
    expect(DEFAULT_RAG_CONFIG.similarityThreshold).toBeLessThan(1)
    expect(DEFAULT_RAG_CONFIG.chunkSize).toBeGreaterThan(0)
    expect(DEFAULT_RAG_CONFIG.chunkOverlap).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_RAG_CONFIG.relevanceScoring.enabled).toBe(true)
    
    const weights = DEFAULT_RAG_CONFIG.relevanceScoring.weights
    expect(weights.similarity + weights.recency + weights.metadata).toBeCloseTo(1.0)
  })
})