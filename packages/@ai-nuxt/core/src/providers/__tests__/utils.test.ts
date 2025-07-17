import { describe, it, expect, beforeEach } from 'vitest'
import { getProvider, getDefaultProvider, initializeProviders, hasCapability, getProvidersWithCapability, getProviderStats } from '../utils'
import { providerRegistry } from '../registry'
import { BaseAIProvider } from '../base'
import type { ProviderConfig, ChatOptions, ChatResponse, CompletionOptions, CompletionResponse, EmbeddingOptions, EmbeddingResponse } from '../../types'

// Mock provider for testing
class MockProvider extends BaseAIProvider {
  readonly id = 'mock'
  readonly name = 'Mock Provider'
  readonly models = ['mock-model-1']
  readonly defaultModel = 'mock-model-1'
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.validateConfig(config)
    this.config = config
    this.initialized = true
  }
  
  readonly chat = {
    async create(options: ChatOptions): Promise<ChatResponse> {
      return {
        message: { id: 'test', role: 'assistant' as const, content: 'Mock', timestamp: new Date() },
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: this.defaultModel,
        provider: this.id
      }
    },
    async *stream() { yield { content: 'Mock', delta: 'Mock', finished: true } }
  }
  
  readonly completion = {
    async create(): Promise<CompletionResponse> {
      return {
        text: 'Mock',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: this.defaultModel,
        provider: this.id
      }
    },
    async *stream() { yield { text: 'Mock', delta: 'Mock', finished: true } }
  }
  
  readonly embedding = {
    async create(): Promise<EmbeddingResponse> {
      return {
        embeddings: [[0.1]],
        usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
        model: this.defaultModel,
        provider: this.id
      }
    }
  }
  
  protected requiresApiKey(): boolean {
    return false
  }
}

describe('Provider Utils', () => {
  let mockProvider: MockProvider
  
  beforeEach(() => {
    providerRegistry.clear()
    mockProvider = new MockProvider()
  })
  
  describe('getProvider', () => {
    it('should return configured provider', async () => {
      providerRegistry.register(mockProvider)
      await providerRegistry.configure({ id: 'mock', name: 'Mock Provider' })
      
      const provider = getProvider('mock')
      expect(provider).toBe(mockProvider)
    })
    
    it('should throw error for unregistered provider', () => {
      expect(() => getProvider('nonexistent')).toThrow('Provider nonexistent not found')
    })
    
    it('should throw error for unconfigured provider', () => {
      providerRegistry.register(mockProvider)
      expect(() => getProvider('mock')).toThrow('Provider mock is not configured')
    })
  })
  
  describe('getDefaultProvider', () => {
    it('should return first configured provider', async () => {
      providerRegistry.register(mockProvider)
      await providerRegistry.configure({ id: 'mock', name: 'Mock Provider' })
      
      const provider = getDefaultProvider()
      expect(provider).toBe(mockProvider)
    })
    
    it('should throw error when no providers configured', () => {
      expect(() => getDefaultProvider()).toThrow('No providers are configured')
    })
  })
  
  describe('initializeProviders', () => {
    it('should initialize multiple providers', async () => {
      providerRegistry.register(mockProvider)
      
      const configs: ProviderConfig[] = [
        { id: 'mock', name: 'Mock Provider' }
      ]
      
      await initializeProviders(configs)
      expect(providerRegistry.isConfigured('mock')).toBe(true)
    })
  })
  
  describe('hasCapability', () => {
    it('should return true for existing capabilities', () => {
      expect(hasCapability(mockProvider, 'chat')).toBe(true)
      expect(hasCapability(mockProvider, 'completion')).toBe(true)
      expect(hasCapability(mockProvider, 'embedding')).toBe(true)
    })
    
    it('should return false for missing capabilities', () => {
      expect(hasCapability(mockProvider, 'vision')).toBe(false)
      expect(hasCapability(mockProvider, 'audio')).toBe(false)
    })
  })
  
  describe('getProvidersWithCapability', () => {
    it('should return providers with specific capability', async () => {
      providerRegistry.register(mockProvider)
      await providerRegistry.configure({ id: 'mock', name: 'Mock Provider' })
      
      const chatProviders = getProvidersWithCapability('chat')
      expect(chatProviders).toHaveLength(1)
      expect(chatProviders[0]).toBe(mockProvider)
      
      const visionProviders = getProvidersWithCapability('vision')
      expect(visionProviders).toHaveLength(0)
    })
  })
  
  describe('getProviderStats', () => {
    it('should return provider statistics', async () => {
      providerRegistry.register(mockProvider)
      await providerRegistry.configure({ id: 'mock', name: 'Mock Provider' })
      
      const stats = getProviderStats()
      expect(stats.total).toBe(1)
      expect(stats.configured).toBe(1)
      expect(stats.unconfigured).toBe(0)
      expect(stats.providers).toHaveLength(1)
      expect(stats.providers[0]).toMatchObject({
        id: 'mock',
        name: 'Mock Provider',
        configured: true,
        capabilities: {
          chat: true,
          completion: true,
          embedding: true,
          vision: false,
          audio: false
        }
      })
    })
  })
})