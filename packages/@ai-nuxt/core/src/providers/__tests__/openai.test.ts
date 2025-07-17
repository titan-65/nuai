import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OpenAIProvider } from '../openai'
import type { ProviderConfig, ChatOptions, CompletionOptions, EmbeddingOptions } from '../../types'

// Mock ofetch
vi.mock('ofetch', () => ({
  ofetch: vi.fn()
}))

// Mock fetch for streaming
global.fetch = vi.fn()

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  let mockConfig: ProviderConfig
  
  beforeEach(() => {
    provider = new OpenAIProvider()
    mockConfig = {
      id: 'openai',
      name: 'OpenAI',
      apiKey: 'test-api-key'
    }
    vi.clearAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await provider.initialize(mockConfig)
      expect(provider.id).toBe('openai')
      expect(provider.name).toBe('OpenAI')
      expect(provider.models).toContain('gpt-3.5-turbo')
      expect(provider.defaultModel).toBe('gpt-3.5-turbo')
    })
    
    it('should throw error without API key', async () => {
      const invalidConfig = { ...mockConfig, apiKey: undefined }
      await expect(provider.initialize(invalidConfig)).rejects.toThrow('API key is required')
    })
    
    it('should use custom base URL', async () => {
      const configWithBaseURL = {
        ...mockConfig,
        baseURL: 'https://custom.openai.com/v1'
      }
      await provider.initialize(configWithBaseURL)
      // Base URL should be set internally
    })
  })
  
  describe('chat completion', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should create chat completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 12,
          total_tokens: 21
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      const result = await provider.chat.create(options)
      
      expect(result.message.content).toBe('Hello! How can I help you today?')
      expect(result.message.role).toBe('assistant')
      expect(result.usage.totalTokens).toBe(21)
      expect(result.model).toBe('gpt-3.5-turbo')
      expect(result.provider).toBe('openai')
    })
    
    it('should include system prompt', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'I am a helpful assistant.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          total_tokens: 23
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Who are you?',
          timestamp: new Date()
        }],
        systemPrompt: 'You are a helpful assistant.'
      }
      
      await provider.chat.create(options)
      
      expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          body: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'system',
                content: 'You are a helpful assistant.'
              })
            ])
          })
        })
      )
    })
    
    it('should handle streaming chat completion', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" there"}}]}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"finish_reason":"stop"}]}\n\n')
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
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }],
        stream: true
      }
      
      const chunks: any[] = []
      for await (const chunk of provider.chat.stream(options)) {
        chunks.push(chunk)
      }
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual({ content: 'Hello', delta: 'Hello', finished: false })
      expect(chunks[1]).toEqual({ content: ' there', delta: ' there', finished: false })
      expect(chunks[2]).toEqual({ content: '', delta: '', finished: true })
    })
  })
  
  describe('text completion', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should create text completion', async () => {
      const mockResponse = {
        id: 'cmpl-123',
        object: 'text_completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo-instruct',
        choices: [{
          text: 'This is a completion.',
          index: 0,
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: CompletionOptions = {
        prompt: 'Complete this text:'
      }
      
      const result = await provider.completion.create(options)
      
      expect(result.text).toBe('This is a completion.')
      expect(result.usage.totalTokens).toBe(10)
      expect(result.model).toBe('gpt-3.5-turbo-instruct')
      expect(result.provider).toBe('openai')
    })
  })
  
  describe('embeddings', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should create embeddings for single input', async () => {
      const mockResponse = {
        object: 'list',
        data: [{
          object: 'embedding',
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          index: 0
        }],
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 8,
          total_tokens: 8
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      const result = await provider.embedding.create(options)
      
      expect(result.embeddings).toHaveLength(1)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
      expect(result.usage.promptTokens).toBe(8)
      expect(result.model).toBe('text-embedding-ada-002')
      expect(result.provider).toBe('openai')
    })
    
    it('should create embeddings for multiple inputs', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0
          },
          {
            object: 'embedding',
            embedding: [0.4, 0.5, 0.6],
            index: 1
          }
        ],
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 12,
          total_tokens: 12
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: EmbeddingOptions = {
        input: ['First text', 'Second text']
      }
      
      const result = await provider.embedding.create(options)
      
      expect(result.embeddings).toHaveLength(2)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
      expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6])
    })
  })
  
  describe('error handling', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should handle 401 unauthorized error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ status: 401 })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('Invalid OpenAI API key')
    })
    
    it('should handle 429 rate limit error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ status: 429 })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('OpenAI rate limit exceeded')
    })
    
    it('should handle 400 bad request error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({
        status: 400,
        data: { error: { message: 'Invalid model specified' } }
      })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('OpenAI API error: Invalid model specified')
    })
    
    it('should handle 500 server error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ status: 500 })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('OpenAI service unavailable')
    })
  })
  
  describe('provider not initialized', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedProvider = new OpenAIProvider()
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(uninitializedProvider.chat.create(options)).rejects.toThrow('Provider OpenAI is not initialized')
    })
  })
})