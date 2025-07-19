/**
 * RAG (Retrieval-Augmented Generation) System
 * Provides automatic context injection for AI prompts using vector search
 */

import { VectorStore, type VectorDocument, type VectorSearchResult } from './vector-store'
import type { ChatOptions, CompletionOptions } from './types'

export interface RAGConfig {
  enabled: boolean
  maxContextLength: number
  maxDocuments: number
  similarityThreshold: number
  contextTemplate: string
  includeMetadata: boolean
  chunkSize: number
  chunkOverlap: number
  relevanceScoring: {
    enabled: boolean
    weights: {
      similarity: number
      recency: number
      metadata: number
    }
  }
}

export interface DocumentChunk {
  id: string
  parentDocumentId: string
  content: string
  embedding: number[]
  metadata?: Record<string, any>
  chunkIndex: number
  totalChunks: number
  timestamp: number
}

export interface RAGContext {
  query: string
  retrievedDocuments: VectorSearchResult[]
  contextText: string
  relevanceScores: number[]
  totalTokens: number
  truncated: boolean
}

export interface RAGResult {
  originalPrompt: string
  enhancedPrompt: string
  context: RAGContext
  metadata: {
    documentsRetrieved: number
    contextLength: number
    processingTime: number
  }
}

/**
 * Document Chunking Service
 */
export class DocumentChunker {
  private config: Pick<RAGConfig, 'chunkSize' | 'chunkOverlap'>

  constructor(config: Pick<RAGConfig, 'chunkSize' | 'chunkOverlap'>) {
    this.config = config
  }

  /**
   * Split document into chunks with overlap
   */
  chunkDocument(document: VectorDocument): DocumentChunk[] {
    const { chunkSize, chunkOverlap } = this.config
    const content = document.content
    const chunks: DocumentChunk[] = []

    if (content.length <= chunkSize) {
      // Document is small enough to be a single chunk
      return [{
        id: `${document.id}_chunk_0`,
        parentDocumentId: document.id,
        content,
        embedding: document.embedding,
        metadata: document.metadata,
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: document.timestamp || Date.now()
      }]
    }

    // Split by sentences first, then by chunks
    const sentences = this.splitIntoSentences(content)
    let currentChunk = ''
    let chunkIndex = 0
    let sentenceIndex = 0

    while (sentenceIndex < sentences.length) {
      const sentence = sentences[sentenceIndex]
      
      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          id: `${document.id}_chunk_${chunkIndex}`,
          parentDocumentId: document.id,
          content: currentChunk.trim(),
          embedding: [], // Will be generated later
          metadata: {
            ...document.metadata,
            chunkIndex,
            parentDocument: document.id
          },
          chunkIndex,
          totalChunks: 0, // Will be updated later
          timestamp: document.timestamp || Date.now()
        })

        // Start new chunk with overlap
        if (chunkOverlap > 0 && chunks.length > 0) {
          const overlapText = this.getOverlapText(currentChunk, chunkOverlap)
          currentChunk = overlapText + ' ' + sentence
        } else {
          currentChunk = sentence
        }
        
        chunkIndex++
      } else {
        // Add sentence to current chunk
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence
      }
      
      sentenceIndex++
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        parentDocumentId: document.id,
        content: currentChunk.trim(),
        embedding: [],
        metadata: {
          ...document.metadata,
          chunkIndex,
          parentDocument: document.id
        },
        chunkIndex,
        totalChunks: 0,
        timestamp: document.timestamp || Date.now()
      })
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length
    })

    return chunks
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.')
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) return text
    
    // Try to break at word boundaries
    const words = text.split(' ')
    let overlapText = ''
    
    for (let i = words.length - 1; i >= 0; i--) {
      const candidate = words.slice(i).join(' ')
      if (candidate.length <= overlapSize) {
        overlapText = candidate
        break
      }
    }
    
    return overlapText || text.slice(-overlapSize)
  }

  /**
   * Batch chunk multiple documents
   */
  async chunkDocuments(documents: VectorDocument[]): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = []
    
    for (const document of documents) {
      const chunks = this.chunkDocument(document)
      allChunks.push(...chunks)
    }
    
    return allChunks
  }
}

/**
 * Relevance Scoring Service
 */
export class RelevanceScorer {
  private config: RAGConfig['relevanceScoring']

  constructor(config: RAGConfig['relevanceScoring']) {
    this.config = config
  }

  /**
   * Calculate relevance score for search results
   */
  scoreResults(results: VectorSearchResult[], query: string): VectorSearchResult[] {
    if (!this.config.enabled) {
      return results
    }

    const scoredResults = results.map(result => {
      const scores = {
        similarity: result.similarity,
        recency: this.calculateRecencyScore(result.document),
        metadata: this.calculateMetadataScore(result.document, query)
      }

      const weightedScore = 
        scores.similarity * this.config.weights.similarity +
        scores.recency * this.config.weights.recency +
        scores.metadata * this.config.weights.metadata

      return {
        ...result,
        similarity: weightedScore,
        metadata: {
          ...result.document.metadata,
          relevanceScores: scores,
          weightedScore
        }
      }
    })

    // Re-sort by new weighted scores
    return scoredResults.sort((a, b) => b.similarity - a.similarity)
  }

  /**
   * Calculate recency score based on document timestamp
   */
  private calculateRecencyScore(document: VectorDocument): number {
    if (!document.timestamp) return 0.5 // Neutral score for documents without timestamp
    
    const now = Date.now()
    const age = now - document.timestamp
    const maxAge = 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
    
    // Exponential decay: newer documents get higher scores
    return Math.exp(-age / (maxAge / 3))
  }

  /**
   * Calculate metadata-based relevance score
   */
  private calculateMetadataScore(document: VectorDocument, query: string): number {
    if (!document.metadata) return 0.5
    
    let score = 0.5
    const queryLower = query.toLowerCase()
    
    // Check if query terms appear in metadata values
    Object.values(document.metadata).forEach(value => {
      if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
        score += 0.2
      }
    })
    
    // Bonus for certain metadata types
    if (document.metadata.type === 'definition' || document.metadata.type === 'reference') {
      score += 0.1
    }
    
    return Math.min(score, 1.0)
  }
}

/**
 * Context Window Manager
 */
export class ContextWindowManager {
  private config: Pick<RAGConfig, 'maxContextLength' | 'contextTemplate'>

  constructor(config: Pick<RAGConfig, 'maxContextLength' | 'contextTemplate'>) {
    this.config = config
  }

  /**
   * Build context from retrieved documents
   */
  buildContext(results: VectorSearchResult[], query: string): RAGContext {
    const { maxContextLength, contextTemplate } = this.config
    
    let contextText = ''
    let totalTokens = 0
    let truncated = false
    const relevanceScores: number[] = []
    const includedDocuments: VectorSearchResult[] = []

    for (const result of results) {
      const docText = this.formatDocument(result.document, contextTemplate)
      const estimatedTokens = this.estimateTokens(docText)
      
      if (totalTokens + estimatedTokens <= maxContextLength) {
        contextText += (contextText ? '\n\n' : '') + docText
        totalTokens += estimatedTokens
        relevanceScores.push(result.similarity)
        includedDocuments.push(result)
      } else {
        truncated = true
        break
      }
    }

    return {
      query,
      retrievedDocuments: includedDocuments,
      contextText,
      relevanceScores,
      totalTokens,
      truncated
    }
  }

  /**
   * Format document according to template
   */
  private formatDocument(document: VectorDocument, template: string): string {
    return template
      .replace('{content}', document.content)
      .replace('{id}', document.id)
      .replace('{metadata}', document.metadata ? JSON.stringify(document.metadata) : '')
      .replace('{timestamp}', document.timestamp ? new Date(document.timestamp).toISOString() : '')
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4)
  }

  /**
   * Inject context into prompt
   */
  injectContext(originalPrompt: string, context: RAGContext): string {
    if (!context.contextText) return originalPrompt

    const contextSection = `Based on the following context information:\n\n${context.contextText}\n\n`
    const enhancedPrompt = contextSection + originalPrompt

    return enhancedPrompt
  }
}

/**
 * Main RAG System
 */
export class RAGSystem {
  private vectorStore: VectorStore
  private config: RAGConfig
  private chunker: DocumentChunker
  private scorer: RelevanceScorer
  private contextManager: ContextWindowManager

  constructor(vectorStore: VectorStore, config: Partial<RAGConfig> = {}) {
    this.vectorStore = vectorStore
    this.config = {
      enabled: true,
      maxContextLength: 4000,
      maxDocuments: 5,
      similarityThreshold: 0.7,
      contextTemplate: 'Document: {content}',
      includeMetadata: false,
      chunkSize: 1000,
      chunkOverlap: 200,
      relevanceScoring: {
        enabled: true,
        weights: {
          similarity: 0.7,
          recency: 0.2,
          metadata: 0.1
        }
      },
      ...config
    }

    this.chunker = new DocumentChunker(this.config)
    this.scorer = new RelevanceScorer(this.config.relevanceScoring)
    this.contextManager = new ContextWindowManager(this.config)
  }

  /**
   * Add documents to RAG system with chunking
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    // Chunk documents
    const chunks = await this.chunker.chunkDocuments(documents)
    
    // Convert chunks to VectorDocuments
    const chunkDocuments: VectorDocument[] = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      timestamp: chunk.timestamp
    }))

    // Add chunks to vector store
    await this.vectorStore.addBatch(chunkDocuments)
  }

  /**
   * Enhance chat options with RAG context
   */
  async enhanceChat(options: ChatOptions): Promise<RAGResult> {
    if (!this.config.enabled) {
      return {
        originalPrompt: this.extractPromptFromMessages(options.messages || []),
        enhancedPrompt: this.extractPromptFromMessages(options.messages || []),
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

    const startTime = Date.now()
    const query = this.extractPromptFromMessages(options.messages || [])
    
    // Retrieve relevant documents
    const searchResults = await this.vectorStore.searchByText(query, {
      limit: this.config.maxDocuments,
      threshold: this.config.similarityThreshold,
      includeMetadata: this.config.includeMetadata
    })

    // Score results for relevance
    const scoredResults = this.scorer.scoreResults(searchResults, query)

    // Build context
    const context = this.contextManager.buildContext(scoredResults, query)

    // Inject context into prompt
    const originalPrompt = this.extractPromptFromMessages(options.messages || [])
    const enhancedPrompt = this.contextManager.injectContext(originalPrompt, context)

    // Update the last message with enhanced prompt
    if (options.messages && options.messages.length > 0) {
      const lastMessage = options.messages[options.messages.length - 1]
      if (lastMessage.role === 'user') {
        lastMessage.content = enhancedPrompt
      }
    }

    const processingTime = Date.now() - startTime

    return {
      originalPrompt,
      enhancedPrompt,
      context,
      metadata: {
        documentsRetrieved: context.retrievedDocuments.length,
        contextLength: context.totalTokens,
        processingTime
      }
    }
  }

  /**
   * Enhance completion options with RAG context
   */
  async enhanceCompletion(options: CompletionOptions): Promise<RAGResult> {
    if (!this.config.enabled || !options.prompt) {
      return {
        originalPrompt: options.prompt || '',
        enhancedPrompt: options.prompt || '',
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

    const startTime = Date.now()
    const query = options.prompt
    
    // Retrieve relevant documents
    const searchResults = await this.vectorStore.searchByText(query, {
      limit: this.config.maxDocuments,
      threshold: this.config.similarityThreshold,
      includeMetadata: this.config.includeMetadata
    })

    // Score results for relevance
    const scoredResults = this.scorer.scoreResults(searchResults, query)

    // Build context
    const context = this.contextManager.buildContext(scoredResults, query)

    // Inject context into prompt
    const enhancedPrompt = this.contextManager.injectContext(options.prompt, context)
    options.prompt = enhancedPrompt

    const processingTime = Date.now() - startTime

    return {
      originalPrompt: query,
      enhancedPrompt,
      context,
      metadata: {
        documentsRetrieved: context.retrievedDocuments.length,
        contextLength: context.totalTokens,
        processingTime
      }
    }
  }

  /**
   * Extract prompt text from chat messages
   */
  private extractPromptFromMessages(messages: any[]): string {
    if (messages.length === 0) return ''
    
    const lastMessage = messages[messages.length - 1]
    return lastMessage.content || ''
  }

  /**
   * Update RAG configuration
   */
  updateConfig(newConfig: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Recreate components with new config
    this.chunker = new DocumentChunker(this.config)
    this.scorer = new RelevanceScorer(this.config.relevanceScoring)
    this.contextManager = new ContextWindowManager(this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config }
  }

  /**
   * Get statistics about the RAG system
   */
  async getStats(): Promise<{
    totalDocuments: number
    averageChunkSize: number
    configuredMaxContext: number
    configuredThreshold: number
  }> {
    const storeStats = await this.vectorStore.stats()
    
    return {
      totalDocuments: storeStats.totalDocuments,
      averageChunkSize: this.config.chunkSize,
      configuredMaxContext: this.config.maxContextLength,
      configuredThreshold: this.config.similarityThreshold
    }
  }
}

/**
 * Default RAG configuration
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  enabled: true,
  maxContextLength: 4000,
  maxDocuments: 5,
  similarityThreshold: 0.7,
  contextTemplate: 'Document: {content}',
  includeMetadata: false,
  chunkSize: 1000,
  chunkOverlap: 200,
  relevanceScoring: {
    enabled: true,
    weights: {
      similarity: 0.7,
      recency: 0.2,
      metadata: 0.1
    }
  }
}