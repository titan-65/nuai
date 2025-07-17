import { describe, it, expect, beforeEach } from 'vitest'
import { ProviderRegistry } from '../registry'
import { BaseAIProvider } from '../base'
import type { ProviderConfig, ChatOptions, ChatResponse, CompletionOptions, CompletionResponse, EmbeddingOptions, EmbeddingResponse } from '../../types'

// Mock provider for testing
class MockProvider extends BaseAIProvider {
  readonly id = 'mock'
  readonly name = 'Mock Provider'
  readonly models = ['mock-model-1', 'mock-model-2']
  readonly defaultModel = 'mock-model-1'
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.validateConfig(config)
    this.config = config
    this.initialized = true
  }
  
  readonly chat = {
    async create(options: ChatOptions): Promise<ChatResponse> {
      this.ensureInitialized()
      return {
        message: {
          id: 'test-id',
          role: 'assistant' as const,
          content: 'Mock response',
          timestamp: new Date()
        },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: this.defaultModel,
        provider: this.id
      }
    },
    
    async *stream(options: ChatOptions) {
      this.ensureInitialized()
      yield { content: 'Mock', delta: 'Mock', finished: false }
      yield { content: ' response', delta: ' response', finished: true }
    }
  }
  
  readonly completion = {
    async create(options: CompletionOptions): Promise<CompletionResponse> {
      this.ensureInitialized()
      return {
        text: 'Mock completion',
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        model: this.defaultModel,
        provider: this.id
      }
    },
    
    async *stream(options: CompletionOptions) {
      this.ensureInitialized()
      yield { text: 'Mock', delta: 'Mock', finished: false }
      yield { text: ' completion', delta: ' completion', finished: true }
    }
  }
  
  readonly embedding = {
    async create(options: EmbeddingOptions): Promise<EmbeddingResponse> {
      this.ensureInitialized()
      return {
        embeddings: [[0.1, 0.2, 0.3]],
        usage: { promptTokens: 2, completionTokens: 0, totalTokens: 2 },
        model: this.defaultModel,
        provider: this.id
      }
    }
  }
  
  protected requiresApiKey(): boolean {
    return false
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry
  let mockProvider: MockProvider
  
  beforeEach(() => {
    registry = new ProviderRegistry()
    mockProvider = new MockProvider()
  })
  
  describe('register', () => {
    it('should register a provider', () => {
      registry.register(mockProvider)
      expect(registry.has('mock')).toBe(true)
      expect(registry.get('mock')).toBe(mockProvider)
    })
  })
  
  describe('unregister', () => {
    it('should unregister a provider', () => {
      registry.register(mockProvider)
      registry.unregister('mock')
      expect(registry.has('mock')).toBe(false)
    })
  })
  
  describe('configure', () => {
    it('should configure a registered provider', async () => {
      registry.register(mockProvider)
      const config: ProviderConfig = {
        id: 'mock',
        name: 'Mock Provider'
      }
      
      await registry.configure(config)
      expect(registry.isConfigured('mock')).toBe(true)
      expect(registry.getConfig('mock')).toEqual(config)
    })
    
    it('should throw error for unregistered provider', async () => {
      const config: ProviderConfig = {
        id: 'nonexistent',
        name: 'Nonexistent Provider'
      }
      
      await expect(registry.configure(config)).rejects.toThrow('Provider nonexistent is not registered')
    })
  })
  
  describe('get', () => {
    it('should return registered provider', () => {
      registry.register(mockProvider)
      expect(registry.get('mock')).toBe(mockProvider)
    })
    
    it('should throw error for unregistered provider', () => {
      expect(() => registry.get('nonexistent')).toThrow('Provider nonexistent is not registered')
    })
  })
  
  describe('list', () => {
    it('should return all registered providers', () => {
      registry.register(mockProvider)
      const providers = registry.list()
      expect(providers).toHaveLength(1)
      expect(providers[0]).toBe(mockProvider)
    })
  })
  
  describe('listConfigured', () => {
    it('should return only configured providers', async () => {
      registry.register(mockProvider)
      
      // Initially no configured providers
      expect(registry.listConfigured()).toHaveLength(0)
      
      // Configure provider
      await registry.configure({ id: 'mock', name: 'Mock Provider' })
      const configured = registry.listConfigured()
      expect(configured).toHaveLength(1)
      expect(configured[0]).toBe(mockProvider)
    })
  })
  
  describe('clear', () => {
    it('should clear all providers and configurations', async () => {
      registry.register(mockProvider)
      await registry.configure({ id: 'mock', name: 'Mock Provider' })
      
      registry.clear()
      
      expect(registry.has('mock')).toBe(false)
      expect(registry.isConfigured('mock')).toBe(false)
      expect(registry.list()).toHaveLength(0)
    })
  })
})