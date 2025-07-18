/**
 * Vector Store Implementation
 * Provides document storage and similarity search capabilities for RAG
 */

export interface VectorDocument {
  id: string
  content: string
  embedding: number[]
  metadata?: Record<string, any>
  timestamp?: number
}

export interface VectorSearchResult {
  document: VectorDocument
  similarity: number
  distance: number
}

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  includeMetadata?: boolean
  filter?: (doc: VectorDocument) => boolean
}

export interface VectorStoreStats {
  totalDocuments: number
  totalEmbeddings: number
  averageEmbeddingDimension: number
  memoryUsage: number
  lastUpdated: number
}

/**
 * Abstract Vector Store Interface
 */
export abstract class VectorStore {
  abstract add(document: VectorDocument): Promise<void>
  abstract addBatch(documents: VectorDocument[]): Promise<void>
  abstract search(queryEmbedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>
  abstract searchByText(text: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>
  abstract get(id: string): Promise<VectorDocument | null>
  abstract delete(id: string): Promise<boolean>
  abstract deleteBatch(ids: string[]): Promise<number>
  abstract clear(): Promise<void>
  abstract size(): Promise<number>
  abstract stats(): Promise<VectorStoreStats>
  abstract destroy(): Promise<void>
}

/**
 * In-Memory Vector Store Implementation
 */
export class MemoryVectorStore extends VectorStore {
  private documents = new Map<string, VectorDocument>()
  private embeddings: number[][] = []
  private documentIds: string[] = []
  private generateEmbedding?: (text: string) => Promise<number[]>

  constructor(generateEmbedding?: (text: string) => Promise<number[]>) {
    super()
    this.generateEmbedding = generateEmbedding
  }

  async add(document: VectorDocument): Promise<void> {
    // Validate document
    if (!document.id || !document.content) {
      throw new Error('Document must have id and content')
    }

    // Generate embedding if not provided
    if (!document.embedding || document.embedding.length === 0) {
      if (!this.generateEmbedding) {
        throw new Error('No embedding provided and no embedding generator available')
      }
      document.embedding = await this.generateEmbedding(document.content)
    }

    // Add timestamp if not provided
    if (!document.timestamp) {
      document.timestamp = Date.now()
    }

    // Store document
    const existingIndex = this.documentIds.indexOf(document.id)
    if (existingIndex >= 0) {
      // Update existing document
      this.documents.set(document.id, document)
      this.embeddings[existingIndex] = document.embedding
    } else {
      // Add new document
      this.documents.set(document.id, document)
      this.embeddings.push(document.embedding)
      this.documentIds.push(document.id)
    }
  }

  async addBatch(documents: VectorDocument[]): Promise<void> {
    // Generate embeddings for documents that don't have them
    const documentsToProcess = [...documents]
    
    if (this.generateEmbedding) {
      const textsToEmbed: string[] = []
      const indicesToUpdate: number[] = []
      
      documentsToProcess.forEach((doc, index) => {
        if (!doc.embedding || doc.embedding.length === 0) {
          textsToEmbed.push(doc.content)
          indicesToUpdate.push(index)
        }
      })
      
      if (textsToEmbed.length > 0) {
        // Generate embeddings in batch if possible
        const embeddings = await Promise.all(
          textsToEmbed.map(text => this.generateEmbedding!(text))
        )
        
        indicesToUpdate.forEach((docIndex, embIndex) => {
          documentsToProcess[docIndex].embedding = embeddings[embIndex]
        })
      }
    }

    // Add all documents
    for (const document of documentsToProcess) {
      await this.add(document)
    }
  }

  async search(queryEmbedding: number[], options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const {
      limit = 10,
      threshold = 0.0,
      includeMetadata = true,
      filter
    } = options

    if (this.embeddings.length === 0) {
      return []
    }

    // Calculate similarities
    const results: VectorSearchResult[] = []
    
    for (let i = 0; i < this.embeddings.length; i++) {
      const docId = this.documentIds[i]
      const document = this.documents.get(docId)
      
      if (!document) continue
      
      // Apply filter if provided
      if (filter && !filter(document)) continue
      
      const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i])
      const distance = 1 - similarity // Convert similarity to distance
      
      if (similarity >= threshold) {
        const result: VectorSearchResult = {
          document: includeMetadata ? document : {
            ...document,
            metadata: undefined
          },
          similarity,
          distance
        }
        results.push(result)
      }
    }

    // Sort by similarity (descending) and limit results
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, limit)
  }

  async searchByText(text: string, options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    if (!this.generateEmbedding) {
      throw new Error('No embedding generator available for text search')
    }

    const queryEmbedding = await this.generateEmbedding(text)
    return this.search(queryEmbedding, options)
  }

  async get(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null
  }

  async delete(id: string): Promise<boolean> {
    const document = this.documents.get(id)
    if (!document) return false

    const index = this.documentIds.indexOf(id)
    if (index >= 0) {
      this.documents.delete(id)
      this.embeddings.splice(index, 1)
      this.documentIds.splice(index, 1)
      return true
    }

    return false
  }

  async deleteBatch(ids: string[]): Promise<number> {
    let deletedCount = 0
    
    for (const id of ids) {
      if (await this.delete(id)) {
        deletedCount++
      }
    }
    
    return deletedCount
  }

  async clear(): Promise<void> {
    this.documents.clear()
    this.embeddings = []
    this.documentIds = []
  }

  async size(): Promise<number> {
    return this.documents.size
  }

  async stats(): Promise<VectorStoreStats> {
    const totalDocuments = this.documents.size
    const totalEmbeddings = this.embeddings.length
    
    let averageEmbeddingDimension = 0
    if (this.embeddings.length > 0) {
      const totalDimensions = this.embeddings.reduce((sum, emb) => sum + emb.length, 0)
      averageEmbeddingDimension = totalDimensions / this.embeddings.length
    }

    // Rough memory usage estimation
    let memoryUsage = 0
    for (const doc of this.documents.values()) {
      memoryUsage += JSON.stringify(doc).length * 2 // Rough byte estimation
    }
    for (const embedding of this.embeddings) {
      memoryUsage += embedding.length * 8 // 8 bytes per float64
    }

    return {
      totalDocuments,
      totalEmbeddings,
      averageEmbeddingDimension,
      memoryUsage,
      lastUpdated: Date.now()
    }
  }

  async destroy(): Promise<void> {
    await this.clear()
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Get all documents (for debugging/testing)
   */
  async getAllDocuments(): Promise<VectorDocument[]> {
    return Array.from(this.documents.values())
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string, 
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const document = await this.get(documentId)
    if (!document) {
      throw new Error(`Document with id ${documentId} not found`)
    }

    // Search using the document's embedding, excluding the document itself
    const results = await this.search(document.embedding, {
      ...options,
      filter: (doc) => {
        const passesOriginalFilter = !options.filter || options.filter(doc)
        return passesOriginalFilter && doc.id !== documentId
      }
    })

    return results
  }

  /**
   * Update document content and regenerate embedding
   */
  async updateDocument(id: string, content: string, metadata?: Record<string, any>): Promise<void> {
    const existingDoc = await this.get(id)
    if (!existingDoc) {
      throw new Error(`Document with id ${id} not found`)
    }

    const updatedDoc: VectorDocument = {
      ...existingDoc,
      content,
      metadata: metadata || existingDoc.metadata,
      timestamp: Date.now(),
      embedding: [] // Will be regenerated
    }

    await this.add(updatedDoc)
  }

  /**
   * Get documents by metadata filter
   */
  async getDocumentsByMetadata(filter: (metadata: Record<string, any>) => boolean): Promise<VectorDocument[]> {
    const results: VectorDocument[] = []
    
    for (const document of this.documents.values()) {
      if (document.metadata && filter(document.metadata)) {
        results.push(document)
      }
    }
    
    return results
  }

  /**
   * Cluster documents by similarity
   */
  async clusterDocuments(threshold: number = 0.8): Promise<VectorDocument[][]> {
    const documents = Array.from(this.documents.values())
    if (documents.length === 0) return []

    const clusters: VectorDocument[][] = []
    const assigned = new Set<string>()

    for (const doc of documents) {
      if (assigned.has(doc.id)) continue

      const cluster = [doc]
      assigned.add(doc.id)

      // Find similar documents
      const similarResults = await this.findSimilarDocuments(doc.id, { threshold })
      
      for (const result of similarResults) {
        if (!assigned.has(result.document.id)) {
          cluster.push(result.document)
          assigned.add(result.document.id)
        }
      }

      clusters.push(cluster)
    }

    return clusters
  }
}

/**
 * Vector Store Factory
 */
export class VectorStoreFactory {
  static createMemoryStore(generateEmbedding?: (text: string) => Promise<number[]>): MemoryVectorStore {
    return new MemoryVectorStore(generateEmbedding)
  }

  static async createFromDocuments(
    documents: Omit<VectorDocument, 'embedding'>[],
    generateEmbedding: (text: string) => Promise<number[]>
  ): Promise<MemoryVectorStore> {
    const store = new MemoryVectorStore(generateEmbedding)
    
    const documentsWithEmbeddings: VectorDocument[] = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        embedding: await generateEmbedding(doc.content),
        timestamp: doc.timestamp || Date.now()
      }))
    )
    
    await store.addBatch(documentsWithEmbeddings)
    return store
  }
}

/**
 * Utility functions for vector operations
 */
export const VectorUtils = {
  /**
   * Normalize a vector to unit length
   */
  normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector
  },

  /**
   * Calculate vector magnitude
   */
  vectorMagnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  },

  /**
   * Add two vectors
   */
  addVectors(a: number[], b: number[]): number[] {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }
    return a.map((val, i) => val + b[i])
  },

  /**
   * Subtract two vectors
   */
  subtractVectors(a: number[], b: number[]): number[] {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }
    return a.map((val, i) => val - b[i])
  },

  /**
   * Calculate centroid of multiple vectors
   */
  calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return []
    
    const dimensions = vectors[0].length
    const centroid = new Array(dimensions).fill(0)
    
    for (const vector of vectors) {
      if (vector.length !== dimensions) {
        throw new Error('All vectors must have the same dimensions')
      }
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i]
      }
    }
    
    return centroid.map(val => val / vectors.length)
  },

  /**
   * Find the most diverse vectors from a collection
   */
  findDiverseVectors(vectors: number[][], count: number): number[][] {
    if (vectors.length <= count) return vectors

    const selected: number[] = []
    const remaining = Array.from({ length: vectors.length }, (_, i) => i)

    // Start with a random vector
    const firstIndex = Math.floor(Math.random() * remaining.length)
    selected.push(remaining.splice(firstIndex, 1)[0])

    // Greedily select the most diverse vectors
    while (selected.length < count && remaining.length > 0) {
      let maxMinDistance = -1
      let bestIndex = -1

      for (let i = 0; i < remaining.length; i++) {
        const candidateIndex = remaining[i]
        
        // Find minimum distance to already selected vectors
        let minDistance = Infinity
        for (const selectedIndex of selected) {
          const similarity = this.cosineSimilarity(vectors[candidateIndex], vectors[selectedIndex])
          const distance = 1 - similarity
          minDistance = Math.min(minDistance, distance)
        }

        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
          bestIndex = i
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining.splice(bestIndex, 1)[0])
      } else {
        break
      }
    }

    return selected.map(index => vectors[index])
  },

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) {
      return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}