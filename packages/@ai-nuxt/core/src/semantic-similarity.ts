/**
 * Semantic Similarity Service
 * Provides embedding generation and similarity calculation for AI caching
 */

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
  getDimensions(): number
  getModel(): string
}

export interface SimilarityResult {
  similarity: number
  index: number
  text: string
  embedding: number[]
}

export interface SemanticSimilarityOptions {
  threshold: number
  maxResults: number
  normalize: boolean
  useCache: boolean
}

/**
 * OpenAI Embedding Provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string
  private model: string
  private dimensions: number
  private baseUrl: string

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    baseUrl: string = 'https://api.openai.com/v1'
  ) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = baseUrl
    
    // Set dimensions based on model
    this.dimensions = this.getModelDimensions(model)
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: this.model
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data[0].embedding
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: texts,
        model: this.model
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data.map((item: any) => item.embedding)
  }

  getDimensions(): number {
    return this.dimensions
  }

  getModel(): string {
    return this.model
  }

  private getModelDimensions(model: string): number {
    const dimensionMap: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536
    }
    return dimensionMap[model] || 1536
  }
}

/**
 * Local/Mock Embedding Provider for testing
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number
  private model: string

  constructor(dimensions: number = 384, model: string = 'mock-embedding') {
    this.dimensions = dimensions
    this.model = model
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Generate deterministic embedding based on text content
    const hash = this.simpleHash(text)
    const embedding = new Array(this.dimensions).fill(0).map((_, i) => {
      return Math.sin((hash + i) * 0.1) * Math.cos((hash + i) * 0.05)
    })
    
    // Normalize the embedding
    return this.normalizeVector(embedding)
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)))
  }

  getDimensions(): number {
    return this.dimensions
  }

  getModel(): string {
    return this.model
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector
  }
}

/**
 * Semantic Similarity Calculator
 */
export class SemanticSimilarityCalculator {
  private embeddingProvider: EmbeddingProvider
  private embeddingCache: Map<string, number[]> = new Map()

  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
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
   * Calculate Euclidean distance between two vectors
   */
  static euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }

    return Math.sqrt(sum)
  }

  /**
   * Calculate Manhattan distance between two vectors
   */
  static manhattanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length')
    }

    let sum = 0
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i])
    }

    return sum
  }

  /**
   * Normalize a vector to unit length
   */
  static normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector
  }

  /**
   * Get embedding for text (with caching)
   */
  async getEmbedding(text: string, useCache: boolean = true): Promise<number[]> {
    const normalizedText = this.normalizeText(text)
    
    if (useCache && this.embeddingCache.has(normalizedText)) {
      return this.embeddingCache.get(normalizedText)!
    }

    const embedding = await this.embeddingProvider.generateEmbedding(normalizedText)
    
    if (useCache) {
      this.embeddingCache.set(normalizedText, embedding)
    }

    return embedding
  }

  /**
   * Find most similar texts from a collection
   */
  async findSimilar(
    queryText: string,
    candidateTexts: string[],
    options: Partial<SemanticSimilarityOptions> = {}
  ): Promise<SimilarityResult[]> {
    const {
      threshold = 0.7,
      maxResults = 10,
      normalize = true,
      useCache = true
    } = options

    // Get query embedding
    const queryEmbedding = await this.getEmbedding(queryText, useCache)

    // Get candidate embeddings
    const candidateEmbeddings = await Promise.all(
      candidateTexts.map(text => this.getEmbedding(text, useCache))
    )

    // Calculate similarities
    const results: SimilarityResult[] = []
    
    for (let i = 0; i < candidateTexts.length; i++) {
      const similarity = SemanticSimilarityCalculator.cosineSimilarity(
        queryEmbedding,
        candidateEmbeddings[i]
      )

      if (similarity >= threshold) {
        results.push({
          similarity,
          index: i,
          text: candidateTexts[i],
          embedding: candidateEmbeddings[i]
        })
      }
    }

    // Sort by similarity (descending) and limit results
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, maxResults)
  }

  /**
   * Check if two texts are semantically similar
   */
  async areSimilar(
    text1: string,
    text2: string,
    threshold: number = 0.8,
    useCache: boolean = true
  ): Promise<{ similar: boolean; similarity: number }> {
    const [embedding1, embedding2] = await Promise.all([
      this.getEmbedding(text1, useCache),
      this.getEmbedding(text2, useCache)
    ])

    const similarity = SemanticSimilarityCalculator.cosineSimilarity(embedding1, embedding2)
    
    return {
      similar: similarity >= threshold,
      similarity
    }
  }

  /**
   * Cluster texts by semantic similarity
   */
  async clusterTexts(
    texts: string[],
    threshold: number = 0.8,
    useCache: boolean = true
  ): Promise<string[][]> {
    if (texts.length === 0) return []

    // Get all embeddings
    const embeddings = await Promise.all(
      texts.map(text => this.getEmbedding(text, useCache))
    )

    const clusters: number[][] = []
    const assigned = new Set<number>()

    for (let i = 0; i < texts.length; i++) {
      if (assigned.has(i)) continue

      const cluster = [i]
      assigned.add(i)

      for (let j = i + 1; j < texts.length; j++) {
        if (assigned.has(j)) continue

        const similarity = SemanticSimilarityCalculator.cosineSimilarity(
          embeddings[i],
          embeddings[j]
        )

        if (similarity >= threshold) {
          cluster.push(j)
          assigned.add(j)
        }
      }

      clusters.push(cluster)
    }

    // Convert indices back to texts
    return clusters.map(cluster => cluster.map(index => texts[index]))
  }

  /**
   * Generate semantic cache key based on text content
   */
  async generateSemanticCacheKey(
    text: string,
    additionalContext: Record<string, any> = {}
  ): Promise<string> {
    const normalizedText = this.normalizeText(text)
    const embedding = await this.getEmbedding(normalizedText)
    
    // Create a hash from the embedding for cache key
    const embeddingHash = this.hashEmbedding(embedding)
    
    // Include additional context in the key
    const contextStr = Object.entries(additionalContext)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')
    
    return contextStr ? `${embeddingHash}|${contextStr}` : embeddingHash
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // This is a simplified implementation
    // In a real scenario, you'd track hits/misses
    return {
      size: this.embeddingCache.size,
      hitRate: 0 // Would need to track this
    }
  }

  /**
   * Normalize text for consistent processing
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '') // Remove punctuation
  }

  /**
   * Create a hash from an embedding vector
   */
  private hashEmbedding(embedding: number[]): string {
    // Create a stable hash from the embedding
    const rounded = embedding.map(val => Math.round(val * 10000) / 10000)
    const str = rounded.join(',')
    
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  }
}

/**
 * Factory for creating semantic similarity calculators
 */
export class SemanticSimilarityFactory {
  static createWithOpenAI(apiKey: string, model?: string): SemanticSimilarityCalculator {
    const provider = new OpenAIEmbeddingProvider(apiKey, model)
    return new SemanticSimilarityCalculator(provider)
  }

  static createWithMockProvider(dimensions?: number): SemanticSimilarityCalculator {
    const provider = new MockEmbeddingProvider(dimensions)
    return new SemanticSimilarityCalculator(provider)
  }

  static createWithProvider(provider: EmbeddingProvider): SemanticSimilarityCalculator {
    return new SemanticSimilarityCalculator(provider)
  }
}

/**
 * Utility functions for semantic similarity
 */
export const SemanticUtils = {
  /**
   * Calculate similarity between two text arrays
   */
  async calculateBatchSimilarity(
    texts1: string[],
    texts2: string[],
    calculator: SemanticSimilarityCalculator
  ): Promise<number[][]> {
    const embeddings1 = await Promise.all(texts1.map(text => calculator.getEmbedding(text)))
    const embeddings2 = await Promise.all(texts2.map(text => calculator.getEmbedding(text)))

    const similarities: number[][] = []
    
    for (let i = 0; i < embeddings1.length; i++) {
      const row: number[] = []
      for (let j = 0; j < embeddings2.length; j++) {
        row.push(SemanticSimilarityCalculator.cosineSimilarity(embeddings1[i], embeddings2[j]))
      }
      similarities.push(row)
    }

    return similarities
  },

  /**
   * Find the most diverse set of texts from a collection
   */
  async findDiverseTexts(
    texts: string[],
    count: number,
    calculator: SemanticSimilarityCalculator
  ): Promise<string[]> {
    if (texts.length <= count) return texts

    const embeddings = await Promise.all(texts.map(text => calculator.getEmbedding(text)))
    const selected: number[] = []
    const remaining = Array.from({ length: texts.length }, (_, i) => i)

    // Start with a random text
    const firstIndex = Math.floor(Math.random() * remaining.length)
    selected.push(remaining.splice(firstIndex, 1)[0])

    // Greedily select the most diverse texts
    while (selected.length < count && remaining.length > 0) {
      let maxMinDistance = -1
      let bestIndex = -1

      for (let i = 0; i < remaining.length; i++) {
        const candidateIndex = remaining[i]
        
        // Find minimum distance to already selected texts
        let minDistance = Infinity
        for (const selectedIndex of selected) {
          const similarity = SemanticSimilarityCalculator.cosineSimilarity(
            embeddings[candidateIndex],
            embeddings[selectedIndex]
          )
          const distance = 1 - similarity // Convert similarity to distance
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

    return selected.map(index => texts[index])
  }
}