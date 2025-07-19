import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAI } from '../useAI'
import type { ChatOptions, CompletionOptions, EmbeddingOptions } from '@ai-nuxt/core'

// Mock Nuxt composables
vi.mock('#app', () => ({
  useRuntimeConfig: vi.fn(() => ({
    public: {
      aiNuxt: {
        defaultProvider: 'openai',
        streaming: { enabled: true, transport: 'sse' },
        caching: { enabled: true, ttl: 3600 },
        debug: false
      }
    }
  })),
  useNuxtApp: vi.fn(() => ({
    $ai: {
      providers: ['openai', 'anthropic', 'ollama'],
      initialized: true
    }
  }))
}))

// Mock AI core functions
vi.mock('@ai-nuxt/core', () => ({
  getProvider: vi.fn(),
  getDefaultProvider: vi.fn()
}))

// Mock global fetch
global.fetch = vi.fn()
global.$fetch = vi.fn()

// Mock process.client
Object.defineProperty(global, 'process', {
  value: { client: true },
  writable: true
})

describe('useAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with default provider', () => {
      const ai = useAI()
      
      expect(ai.currentProvider.value).toBe('openai')
      expect(ai.providerInfo.value.current).toBe('openai')
      expect(ai.providerInfo.value.available).toEqual(['openai', 'anthropic', 'ollama'])
    })
    
    it('should initialize with custom provider', () => {
      const ai = useAI({ provider: 'anthropic' })
      
      expect(ai.currentProvider.value).toBe('anthropic')
    })
    
    it('should initialize with custom options', () => {
      const ai = useAI({
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.8,
        maxTokens: 2000,
        retries: 5,
        timeout: 60000
      })
      
      expect(ai.currentProvider.value).toBe('openai')
    })
  })
  
  describe('provider management', () => {
    it('should switch provider successfully', () => {
      const ai = useAI()
      
      ai.switchProvider('anthropic')
      expect(ai.currentProvider.value).toBe('anthropic')
    })
    
    it('should throw error when switching to unavailable provider', () => {
      const ai = useAI()
      
      expect(() => ai.switchProvider('invalid-provider')).toThrow('Provider invalid-provider is not available')
    })
    
    it('should get provider capabilities', () => {
      const ai = useAI()
      
      const openaiCaps = ai.providerInfo.value.capabilities
      expect(openaiCaps.chat).toBe(true)
      expect(openaiCaps.embedding).toBe(true)
      expect(openaiCaps.streaming).toBe(true)
    })
  })
  
  describe('chat completion', () => {
    it('should create chat completion successfully', async () => {
      const mockResponse = {
        message: {
          id: 'test-id',
          role: 'assistant' as const,
          content: 'Hello! How can I help you?',
          timestamp: new Date()
        },
        usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      vi.mocked($fetch).mockResolvedValue(mockResponse)
      
      const ai = useAI()
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      const result = await ai.chat.create(options)
      
      expect(result).toEqual(mockResponse)
      expect(ai.stats.value.requests).toBe(1)
      expect(ai.stats.value.tokens).toBe(18)
      expect($fetch).toHaveBeenCalledWith('/api/ai/chat', {
        method: 'POST',
        body: expect.objectContaining({
          messages: options.messages,
          provider: 'openai'
        }),
        timeout: 30000
      })
    })
    
    it('should handle chat completion errors', async () => {
      const mockError = new Error('API Error')
      vi.mocked($fetch).mockRejectedValue(mockError)
      
      const ai = useAI()
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(ai.chat.create(options)).rejects.toThrow('Chat completion failed')
      expect(ai.error.value).toBeTruthy()
      expect(ai.error.value?.provider).toBe('openai')
    })
    
    it('should use cache for repeated requests', async () => {
      const mockResponse = {
        message: {
          id: 'test-id',
          role: 'assistant' as const,
          content: 'Cached response',
          timestamp: new Date()
        },
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      vi.mocked($fetch).mockResolvedValue(mockResponse)
      
      const ai = useAI({ caching: true })
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Same question',
          timestamp: new Date()
        }]
      }
      
      // First request
      const result1 = await ai.chat.create(options)
      expect(result1).toEqual(mockResponse)
      expect($fetch).toHaveBeenCalledTimes(1)
      
      // Second request should use cache
      const result2 = await ai.chat.create(options)
      expect(result2).toEqual(mockResponse)
      expect($fetch).toHaveBeenCalledTimes(1) // Still only called once
    })
    
    it('should handle streaming chat completion', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":"Hello","delta":"Hello","finished":false}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":" there","delta":" there","finished":false}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"content":"","delta":"","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const ai = useAI()
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      const chunks: any[] = []
      for await (const chunk of ai.chat.stream(options)) {
        chunks.push(chunk)
      }
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual({ content: 'Hello', delta: 'Hello', finished: false })
      expect(chunks[1]).toEqual({ content: ' there', delta: ' there', finished: false })
      expect(chunks[2]).toEqual({ content: '', delta: '', finished: true })
    })
  })
  
  describe('text completion', () => {
    it('should create text completion successfully', async () => {
      const mockResponse = {
        text: 'This is a completion.',
        usage: { promptTokens: 5, completionTokens: 4, totalTokens: 9 },
        model: 'gpt-3.5-turbo-instruct',
        provider: 'openai'
      }
      
      vi.mocked($fetch).mockResolvedValue(mockResponse)
      
      const ai = useAI()
      const options: CompletionOptions = {
        prompt: 'Complete this:'
      }
      
      const result = await ai.completion.create(options)
      
      expect(result).toEqual(mockResponse)
      expect(ai.stats.value.requests).toBe(1)
      expect(ai.stats.value.tokens).toBe(9)
    })
    
    it('should handle completion errors', async () => {
      const mockError = new Error('Completion Error')
      vi.mocked($fetch).mockRejectedValue(mockError)
      
      const ai = useAI()
      const options: CompletionOptions = {
        prompt: 'Complete this:'
      }
      
      await expect(ai.completion.create(options)).rejects.toThrow('Text completion failed')
      expect(ai.error.value).toBeTruthy()
    })
  })
  
  describe('embeddings', () => {
    it('should create embeddings successfully', async () => {
      const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
        model: 'text-embedding-ada-002',
        provider: 'openai'
      }
      
      vi.mocked($fetch).mockResolvedValue(mockResponse)
      
      const ai = useAI()
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      const result = await ai.embedding.create(options)
      
      expect(result).toEqual(mockResponse)
      expect(ai.stats.value.requests).toBe(1)
      expect(ai.stats.value.tokens).toBe(3)
    })
    
    it('should handle embedding errors', async () => {
      const mockError = new Error('Embedding Error')
      vi.mocked($fetch).mockRejectedValue(mockError)
      
      const ai = useAI()
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      await expect(ai.embedding.create(options)).rejects.toThrow('Embedding creation failed')
      expect(ai.error.value).toBeTruthy()
    })
  })
  
  describe('retry mechanism', () => {
    it('should retry on server errors', async () => {
      const mockError = { statusCode: 500, message: 'Server Error' }
      const mockResponse = {
        message: {
          id: 'test-id',
          role: 'assistant' as const,
          content: 'Success after retry',
          timestamp: new Date()
        },
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      vi.mocked($fetch)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockResponse)
      
      const ai = useAI({ retries: 3 })
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      const result = await ai.chat.create(options)
      
      expect(result).toEqual(mockResponse)
      expect($fetch).toHaveBeenCalledTimes(3)
    })
    
    it('should not retry on client errors', async () => {
      const mockError = { statusCode: 400, message: 'Bad Request' }
      
      vi.mocked($fetch).mockRejectedValue(mockError)
      
      const ai = useAI({ retries: 3 })
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(ai.chat.create(options)).rejects.toThrow()
      expect($fetch).toHaveBeenCalledTimes(1) // No retries for 4xx errors
    })
  })
  
  describe('utility methods', () => {
    it('should clear cache', () => {
      const ai = useAI()
      
      // Add something to cache first
      ai.clearCache()
      
      // Should not throw
      expect(() => ai.clearCache()).not.toThrow()
    })
    
    it('should reset stats', () => {
      const ai = useAI()
      
      ai.resetStats()
      
      expect(ai.stats.value.requests).toBe(0)
      expect(ai.stats.value.tokens).toBe(0)
    })
    
    it('should track loading state', async () => {
      const mockResponse = {
        message: {
          id: 'test-id',
          role: 'assistant' as const,
          content: 'Response',
          timestamp: new Date()
        },
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      // Mock a delayed response
      vi.mocked($fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      )
      
      const ai = useAI()
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      const promise = ai.chat.create(options)
      
      // Should be loading
      expect(ai.isLoading.value).toBe(true)
      
      await promise
      
      // Should not be loading anymore
      expect(ai.isLoading.value).toBe(false)
    })
  })
  
  describe('server-side behavior', () => {
    it('should use direct provider access on server', () => {
      // Mock server environment
      Object.defineProperty(global, 'process', {
        value: { client: false },
        writable: true
      })
      
      const mockProvider = {
        chat: { create: vi.fn(), stream: vi.fn() },
        completion: { create: vi.fn(), stream: vi.fn() },
        embedding: { create: vi.fn() },
        vision: undefined,
        audio: undefined
      }
      
      const { getDefaultProvider } = require('@ai-nuxt/core')
      vi.mocked(getDefaultProvider).mockReturnValue(mockProvider)
      
      const ai = useAI()
      
      expect(ai.chat).toBe(mockProvider.chat)
      expect(ai.completion).toBe(mockProvider.completion)
      expect(ai.embedding).toBe(mockProvider.embedding)
      
      // Reset to client environment
      Object.defineProperty(global, 'process', {
        value: { client: true },
        writable: true
      })
    })
  })
})