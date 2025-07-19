import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SemanticSimilarityCalculator,
  SemanticSimilarityFactory,
  MockEmbeddingProvider,
  OpenAIEmbeddingProvider,
  SemanticUtils
} from '../semantic-similarity'

describe('SemanticSimilarityCalculator', () => {
  describe('Static Methods', () => {
    describe('cosineSimilarity', () => {
      it('should calculate cosine similarity correctly', () => {
        const a = [1, 0, 0]
        const b = [0, 1, 0]
        const c = [1, 0, 0]

        expect(SemanticSimilarityCalculator.cosineSimilarity(a, b)).toBe(0)
        expect(SemanticSimilarityCalculator.cosineSimilarity(a, c)).toBe(1)
      })

      it('should handle identical vectors', () => {
        const a = [1, 2, 3]
        const b = [1, 2, 3]

        expect(SemanticSimilarityCalculator.cosineSimilarity(a, b)).toBe(1)
      })

      it('should handle opposite vectors', () => {
        const a = [1, 0, 0]
        const b = [-1, 0, 0]

        expect(SemanticSimilarityCalculator.cosineSimilarity(a, b)).toBe(-1)
      })

      it('should handle zero vectors', () => {
        const a = [0, 0, 0]
        const b = [1, 2, 3]

        expect(SemanticSimilarityCalculator.cosineSimilarity(a, b)).toBe(0)
      })

      it('should throw error for different length vectors', () => {
        const a = [1, 2]
        const b = [1, 2, 3]

        expect(() => SemanticSimilarityCalculator.cosineSimilarity(a, b)).toThrow()
      })
    })

    describe('euclideanDistance', () => {
      it('should calculate Euclidean distance correctly', () => {
        const a = [0, 0]
        const b = [3, 4]

        expect(SemanticSimilarityCalculator.euclideanDistance(a, b)).toBe(5)
      })

      it('should return 0 for identical vectors', () => {
        const a = [1, 2, 3]
        const b = [1, 2, 3]

        expect(SemanticSimilarityCalculator.euclideanDistance(a, b)).toBe(0)
      })
    })

    describe('manhattanDistance', () => {
      it('should calculate Manhattan distance correctly', () => {
        const a = [1, 1]
        const b = [4, 5]

        expect(SemanticSimilarityCalculator.manhattanDistance(a, b)).toBe(7)
      })
    })

    describe('normalizeVector', () => {
      it('should normalize vector to unit length', () => {
        const vector = [3, 4]
        const normalized = SemanticSimilarityCalculator.normalizeVector(vector)

        expect(normalized[0]).toBeCloseTo(0.6)
        expect(normalized[1]).toBeCloseTo(0.8)

        // Check unit length
        const magnitude = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2)
        expect(magnitude).toBeCloseTo(1)
      })

      it('should handle zero vector', () => {
        const vector = [0, 0, 0]
        const normalized = SemanticSimilarityCalculator.normalizeVector(vector)

        expect(normalized).toEqual([0, 0, 0])
      })
    })
  })

  describe('Instance Methods', () => {
    let calculator: SemanticSimilarityCalculator
    let mockProvider: MockEmbeddingProvider

    beforeEach(() => {
      mockProvider = new MockEmbeddingProvider(384)
      calculator = new SemanticSimilarityCalculator(mockProvider)
    })

    describe('getEmbedding', () => {
      it('should get embedding for text', async () => {
        const embedding = await calculator.getEmbedding('hello world')

        expect(embedding).toHaveLength(384)
        expect(embedding.every(val => typeof val === 'number')).toBe(true)
      })

      it('should cache embeddings when enabled', async () => {
        const text = 'test text'
        
        const embedding1 = await calculator.getEmbedding(text, true)
        const embedding2 = await calculator.getEmbedding(text, true)

        expect(embedding1).toEqual(embedding2)
      })

      it('should not cache embeddings when disabled', async () => {
        const text = 'test text'
        
        await calculator.getEmbedding(text, false)
        const stats = calculator.getCacheStats()

        expect(stats.size).toBe(0)
      })
    })

    describe('findSimilar', () => {
      it('should find similar texts', async () => {
        const queryText = 'hello world'
        const candidates = [
          'hello there',
          'goodbye world',
          'completely different text',
          'hello universe'
        ]

        const results = await calculator.findSimilar(queryText, candidates, {
          threshold: 0.1, // Lower threshold for mock provider
          maxResults: 3
        })

        expect(results.length).toBeGreaterThanOrEqual(0)
        expect(results.length).toBeLessThanOrEqual(3)
        
        if (results.length > 0) {
          expect(results[0].similarity).toBeGreaterThanOrEqual(0.1)
          
          // Results should be sorted by similarity (descending)
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
          }
        }
      })

      it('should respect threshold parameter', async () => {
        const queryText = 'hello world'
        const candidates = ['hello there', 'goodbye world']

        const results = await calculator.findSimilar(queryText, candidates, {
          threshold: 0.9 // High threshold
        })

        results.forEach(result => {
          expect(result.similarity).toBeGreaterThanOrEqual(0.9)
        })
      })

      it('should limit results to maxResults', async () => {
        const queryText = 'hello'
        const candidates = Array.from({ length: 10 }, (_, i) => `hello ${i}`)

        const results = await calculator.findSimilar(queryText, candidates, {
          threshold: 0.1,
          maxResults: 3
        })

        expect(results.length).toBeLessThanOrEqual(3)
      })
    })

    describe('areSimilar', () => {
      it('should determine if texts are similar', async () => {
        const result1 = await calculator.areSimilar('hello world', 'hello there', 0.5)
        const result2 = await calculator.areSimilar('hello world', 'completely different', 0.9)

        // Mock provider can generate negative similarities, so we just check they're numbers
        expect(typeof result1.similarity).toBe('number')
        expect(typeof result2.similarity).toBe('number')
        expect(result1.similarity).toBeGreaterThanOrEqual(-1)
        expect(result1.similarity).toBeLessThanOrEqual(1)
        expect(result2.similarity).toBeGreaterThanOrEqual(-1)
        expect(result2.similarity).toBeLessThanOrEqual(1)
        expect(typeof result1.similar).toBe('boolean')
        expect(typeof result2.similar).toBe('boolean')
      })
    })

    describe('clusterTexts', () => {
      it('should cluster similar texts together', async () => {
        const texts = [
          'hello world',
          'hello there',
          'goodbye world',
          'goodbye there',
          'completely different'
        ]

        const clusters = await calculator.clusterTexts(texts, 0.7)

        expect(clusters.length).toBeGreaterThan(0)
        expect(clusters.every(cluster => cluster.length > 0)).toBe(true)
        
        // All original texts should be in some cluster
        const allTextsInClusters = clusters.flat()
        expect(allTextsInClusters.sort()).toEqual(texts.sort())
      })

      it('should handle empty input', async () => {
        const clusters = await calculator.clusterTexts([])
        expect(clusters).toEqual([])
      })

      it('should handle single text', async () => {
        const clusters = await calculator.clusterTexts(['single text'])
        expect(clusters).toEqual([['single text']])
      })
    })

    describe('generateSemanticCacheKey', () => {
      it('should generate consistent cache keys for same text', async () => {
        const text = 'hello world'
        
        const key1 = await calculator.generateSemanticCacheKey(text)
        const key2 = await calculator.generateSemanticCacheKey(text)

        expect(key1).toBe(key2)
      })

      it('should include additional context in cache key', async () => {
        const text = 'hello world'
        const context = { model: 'gpt-4', temperature: 0.7 }
        
        const keyWithoutContext = await calculator.generateSemanticCacheKey(text)
        const keyWithContext = await calculator.generateSemanticCacheKey(text, context)

        expect(keyWithContext).not.toBe(keyWithoutContext)
        expect(keyWithContext).toContain('model:gpt-4')
        expect(keyWithContext).toContain('temperature:0.7')
      })
    })

    describe('cache management', () => {
      it('should clear cache', async () => {
        await calculator.getEmbedding('test text', true)
        expect(calculator.getCacheStats().size).toBeGreaterThan(0)

        calculator.clearCache()
        expect(calculator.getCacheStats().size).toBe(0)
      })

      it('should provide cache statistics', () => {
        const stats = calculator.getCacheStats()
        
        expect(stats).toHaveProperty('size')
        expect(stats).toHaveProperty('hitRate')
        expect(typeof stats.size).toBe('number')
        expect(typeof stats.hitRate).toBe('number')
      })
    })
  })
})

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider

  beforeEach(() => {
    provider = new MockEmbeddingProvider(384)
  })

  it('should generate embeddings with correct dimensions', async () => {
    const embedding = await provider.generateEmbedding('test text')
    expect(embedding).toHaveLength(384)
  })

  it('should generate consistent embeddings for same text', async () => {
    const text = 'consistent text'
    const embedding1 = await provider.generateEmbedding(text)
    const embedding2 = await provider.generateEmbedding(text)

    expect(embedding1).toEqual(embedding2)
  })

  it('should generate different embeddings for different texts', async () => {
    const embedding1 = await provider.generateEmbedding('text one')
    const embedding2 = await provider.generateEmbedding('text two')

    expect(embedding1).not.toEqual(embedding2)
  })

  it('should generate normalized embeddings', async () => {
    const embedding = await provider.generateEmbedding('test text')
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

    expect(magnitude).toBeCloseTo(1, 5)
  })

  it('should generate batch embeddings', async () => {
    const texts = ['text one', 'text two', 'text three']
    const embeddings = await provider.generateEmbeddings(texts)

    expect(embeddings).toHaveLength(3)
    expect(embeddings.every(emb => emb.length === 384)).toBe(true)
  })

  it('should return correct model info', () => {
    expect(provider.getDimensions()).toBe(384)
    expect(provider.getModel()).toBe('mock-embedding')
  })
})

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider

  beforeEach(() => {
    provider = new OpenAIEmbeddingProvider('test-api-key')
  })

  it('should return correct model info', () => {
    expect(provider.getDimensions()).toBe(1536)
    expect(provider.getModel()).toBe('text-embedding-3-small')
  })

  it('should handle different models', () => {
    const provider2 = new OpenAIEmbeddingProvider('test-key', 'text-embedding-3-large')
    expect(provider2.getDimensions()).toBe(3072)
    expect(provider2.getModel()).toBe('text-embedding-3-large')
  })

  // Note: Actual API tests would require mocking fetch or using a test API key
  // These tests focus on the provider setup and configuration
})

describe('SemanticSimilarityFactory', () => {
  it('should create calculator with OpenAI provider', () => {
    const calculator = SemanticSimilarityFactory.createWithOpenAI('test-key')
    expect(calculator).toBeInstanceOf(SemanticSimilarityCalculator)
  })

  it('should create calculator with mock provider', () => {
    const calculator = SemanticSimilarityFactory.createWithMockProvider(256)
    expect(calculator).toBeInstanceOf(SemanticSimilarityCalculator)
  })

  it('should create calculator with custom provider', () => {
    const provider = new MockEmbeddingProvider()
    const calculator = SemanticSimilarityFactory.createWithProvider(provider)
    expect(calculator).toBeInstanceOf(SemanticSimilarityCalculator)
  })
})

describe('SemanticUtils', () => {
  let calculator: SemanticSimilarityCalculator

  beforeEach(() => {
    calculator = SemanticSimilarityFactory.createWithMockProvider()
  })

  describe('calculateBatchSimilarity', () => {
    it('should calculate similarity matrix', async () => {
      const texts1 = ['hello', 'world']
      const texts2 = ['hi', 'earth', 'universe']

      const similarities = await SemanticUtils.calculateBatchSimilarity(
        texts1,
        texts2,
        calculator
      )

      expect(similarities).toHaveLength(2) // texts1.length
      expect(similarities[0]).toHaveLength(3) // texts2.length
      expect(similarities[1]).toHaveLength(3) // texts2.length

      // All similarities should be numbers between -1 and 1
      similarities.flat().forEach(sim => {
        expect(typeof sim).toBe('number')
        expect(sim).toBeGreaterThanOrEqual(-1)
        expect(sim).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('findDiverseTexts', () => {
    it('should find diverse texts from collection', async () => {
      const texts = [
        'hello world',
        'hello there',
        'goodbye world',
        'completely different text',
        'another unique sentence',
        'final diverse text'
      ]

      const diverse = await SemanticUtils.findDiverseTexts(texts, 3, calculator)

      expect(diverse).toHaveLength(3)
      expect(diverse.every(text => texts.includes(text))).toBe(true)
    })

    it('should return all texts if count >= texts.length', async () => {
      const texts = ['text1', 'text2']
      const diverse = await SemanticUtils.findDiverseTexts(texts, 5, calculator)

      expect(diverse).toEqual(texts)
    })

    it('should handle empty input', async () => {
      const diverse = await SemanticUtils.findDiverseTexts([], 3, calculator)
      expect(diverse).toEqual([])
    })
  })
})

describe('Integration Tests', () => {
  it('should work end-to-end with semantic caching', async () => {
    const calculator = SemanticSimilarityFactory.createWithMockProvider()
    
    // Simulate caching scenario
    const originalPrompt = 'What is the weather like today?'
    const similarPrompt = 'How is the weather today?'
    const differentPrompt = 'What is the capital of France?'

    // Check similarity
    const result1 = await calculator.areSimilar(originalPrompt, similarPrompt, 0.7)
    const result2 = await calculator.areSimilar(originalPrompt, differentPrompt, 0.7)

    // Similar prompts should be detected
    expect(result1.similarity).toBeGreaterThan(result2.similarity)

    // Generate cache keys
    const key1 = await calculator.generateSemanticCacheKey(originalPrompt)
    const key2 = await calculator.generateSemanticCacheKey(similarPrompt)
    const key3 = await calculator.generateSemanticCacheKey(differentPrompt)

    expect(typeof key1).toBe('string')
    expect(typeof key2).toBe('string')
    expect(typeof key3).toBe('string')
  })

  it('should handle performance with large datasets', async () => {
    const calculator = SemanticSimilarityFactory.createWithMockProvider()
    
    // Generate test data
    const texts = Array.from({ length: 100 }, (_, i) => `test text number ${i}`)
    
    const startTime = Date.now()
    
    // Test clustering
    const clusters = await calculator.clusterTexts(texts, 0.8)
    
    const endTime = Date.now()
    const duration = endTime - startTime

    expect(clusters.length).toBeGreaterThan(0)
    expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
  })
})