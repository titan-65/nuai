import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AnthropicProvider } from '../anthropic'
import type { ProviderConfig, ChatOptions, CompletionOptions, EmbeddingOptions } from '../../types'

// Mock ofetch
vi.mock('ofetch', () => ({
  ofetch: vi.fn()
}))

// Mock fetch for streaming
global.fetch = vi.fn()

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  let mockConfig: ProviderConfig
  
  beforeEach(() => {
    provider = new AnthropicProvider()
    mockConfig = {
      id: 'anthropic',
      name: 'Anthropic',
      apiKey: 'test-api-key'
    }
    vi.clearAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await provider.initialize(mockConfig)
      expect(provider.id).toBe('anthropic')
      expect(provider.name).toBe('Anthropic')
      expect(provider.models).toContain('claude-3-sonnet-20240229')
      expect(provider.defaultModel).toBe('claude-3-sonnet-20240229')
    })
    
    it('should throw error without API key', async () => {
      const invalidConfig = { ...mockConfig, apiKey: undefined }
      await expect(provider.initialize(invalidConfig)).rejects.toThrow('API key is required')
    })
    
    it('should use custom base URL and version', async () => {
      const configWithOptions = {
        ...mockConfig,
        baseURL: 'https://custom.anthropic.com/v1',
        options: { version: '2024-01-01' }
      }
      await provider.initialize(configWithOptions)
      // Configuration should be set internally
    })
  })
  
  describe('chat completion', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should create chat completion', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Hello! I am Claude, an AI assistant created by Anthropic.'
        }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello, who are you?',
          timestamp: new Date()
        }]
      }
      
      const result = await provider.chat.create(options)
      
      expect(result.message.content).toBe('Hello! I am Claude, an AI assistant created by Anthropic.')
      expect(result.message.role).toBe('assistant')
      expect(result.usage.totalTokens).toBe(25)
      expect(result.model).toBe('claude-3-sonnet-20240229')
      expect(result.provider).toBe('anthropic')
    })
    
    it('should handle system prompt', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'I am a helpful assistant.'
        }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 8
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
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.objectContaining({
            system: 'You are a helpful assistant.',
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Who are you?'
              })
            ])
          })
        })
      )
    })
    
    it('should extract system message from messages array', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'I understand.'
        }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 15,
          output_tokens: 5
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: ChatOptions = {
        messages: [
          {
            id: '1',
            role: 'system',
            content: 'You are a helpful assistant.',
            timestamp: new Date()
          },
          {
            id: '2',
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          }
        ]
      }
      
      await provider.chat.create(options)
      
      expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.objectContaining({
            system: 'You are a helpful assistant.',
            messages: [
              expect.objectContaining({
                role: 'user',
                content: 'Hello'
              })
            ]
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
                value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":" there"}}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"message_stop"}\n\n')
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
        completion: ' This is a completion from Claude.',
        stop_reason: 'stop_sequence',
        model: 'claude-2.1',
        usage: {
          input_tokens: 8,
          output_tokens: 7
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: CompletionOptions = {
        prompt: 'Complete this text:'
      }
      
      const result = await provider.completion.create(options)
      
      expect(result.text).toBe(' This is a completion from Claude.')
      expect(result.usage.totalTokens).toBe(15)
      expect(result.model).toBe('claude-2.1')
      expect(result.provider).toBe('anthropic')
    })
    
    it('should format prompt correctly', async () => {
      const mockResponse = {
        completion: ' Response',
        stop_reason: 'stop_sequence',
        model: 'claude-2.1',
        usage: {
          input_tokens: 10,
          output_tokens: 2
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: CompletionOptions = {
        prompt: 'What is AI?'
      }
      
      await provider.completion.create(options)
      
      expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
        expect.stringContaining('/complete'),
        expect.objectContaining({
          body: expect.objectContaining({
            prompt: '\n\nHuman: What is AI?\n\nAssistant:'
          })
        })
      )
    })
  })
  
  describe('embeddings', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should throw error for embeddings', async () => {
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      await expect(provider.embedding.create(options)).rejects.toThrow(
        'Anthropic provider does not support embeddings'
      )
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
      
      await expect(provider.chat.create(options)).rejects.toThrow('Invalid Anthropic API key')
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
      
      await expect(provider.chat.create(options)).rejects.toThrow('Anthropic rate limit exceeded')
    })
    
    it('should handle 403 forbidden error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ status: 403 })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('Anthropic API access forbidden')
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
      
      await expect(provider.chat.create(options)).rejects.toThrow('Anthropic API error: Invalid model specified')
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
      
      await expect(provider.chat.create(options)).rejects.toThrow('Anthropic service unavailable')
    })
  })
  
  describe('provider not initialized', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedProvider = new AnthropicProvider()
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(uninitializedProvider.chat.create(options)).rejects.toThrow('Provider Anthropic is not initialized')
    })
  })
  
  describe('message conversion', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig)
    })
    
    it('should filter out system messages from message array', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: 'Response'
        }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 5,
          output_tokens: 3
        }
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: ChatOptions = {
        messages: [
          {
            id: '1',
            role: 'system',
            content: 'You are helpful.',
            timestamp: new Date()
          },
          {
            id: '2',
            role: 'user',
            content: 'Hello',
            timestamp: new Date()
          },
          {
            id: '3',
            role: 'assistant',
            content: 'Hi there!',
            timestamp: new Date()
          }
        ]
      }
      
      await provider.chat.create(options)
      
      expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.objectContaining({
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there!' }
            ]
          })
        })
      )
    })
  })
})