import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OllamaProvider } from '../ollama'
import type { ProviderConfig, ChatOptions, CompletionOptions, EmbeddingOptions } from '../../types'

// Mock ofetch
vi.mock('ofetch', () => ({
  ofetch: vi.fn()
}))

// Mock fetch for streaming
global.fetch = vi.fn()

describe('OllamaProvider', () => {
  let provider: OllamaProvider
  let mockConfig: ProviderConfig
  
  beforeEach(() => {
    provider = new OllamaProvider()
    mockConfig = {
      id: 'ollama',
      name: 'Ollama',
      baseURL: 'http://localhost:11434'
    }
    vi.clearAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      // Mock the models API call
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({
        models: [
          { name: 'llama2', modified_at: '2023-01-01', size: 1000000, digest: 'abc123', details: {} },
          { name: 'codellama', modified_at: '2023-01-01', size: 1000000, digest: 'def456', details: {} }
        ]
      })
      
      await provider.initialize(mockConfig)
      expect(provider.id).toBe('ollama')
      expect(provider.name).toBe('Ollama')
      expect(provider.getAvailableModels()).toContain('llama2')
      expect(provider.getAvailableModels()).toContain('codellama')
    })
    
    it('should not require API key', async () => {
      const configWithoutKey = { ...mockConfig }
      delete configWithoutKey.apiKey
      
      // Mock the models API call
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [] })
      
      await expect(provider.initialize(configWithoutKey)).resolves.not.toThrow()
    })
    
    it('should handle failed model fetching gracefully', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue(new Error('Connection failed'))
      
      // Should not throw, but warn
      await expect(provider.initialize(mockConfig)).resolves.not.toThrow()
    })
    
    it('should use custom base URL', async () => {
      const customConfig = {
        ...mockConfig,
        baseURL: 'http://custom-ollama:11434'
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [] })
      
      await provider.initialize(customConfig)
      // Base URL should be set internally
    })
  })
  
  describe('chat completion', () => {
    beforeEach(async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [{ name: 'llama2' }] })
      await provider.initialize(mockConfig)
    })
    
    it('should create chat completion', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant' as const,
          content: 'Hello! How can I help you today?'
        },
        done: true,
        total_duration: 1000000,
        load_duration: 500000,
        prompt_eval_count: 10,
        prompt_eval_duration: 200000,
        eval_count: 15,
        eval_duration: 300000
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
      expect(result.usage.totalTokens).toBe(25)
      expect(result.model).toBe('llama2')
      expect(result.provider).toBe('ollama')
    })
    
    it('should include system prompt', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant' as const,
          content: 'I am a helpful assistant.'
        },
        done: true,
        prompt_eval_count: 15,
        eval_count: 8
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
        expect.stringContaining('/api/chat'),
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
                value: new TextEncoder().encode('{"message":{"content":"Hello"},"done":false}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"message":{"content":" there"},"done":false}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"done":true}\n')
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
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [{ name: 'llama2' }] })
      await provider.initialize(mockConfig)
    })
    
    it('should create text completion', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        response: 'This is a completion from Ollama.',
        done: true,
        context: [1, 2, 3],
        total_duration: 1000000,
        load_duration: 500000,
        prompt_eval_count: 5,
        prompt_eval_duration: 200000,
        eval_count: 8,
        eval_duration: 300000
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: CompletionOptions = {
        prompt: 'Complete this text:'
      }
      
      const result = await provider.completion.create(options)
      
      expect(result.text).toBe('This is a completion from Ollama.')
      expect(result.usage.totalTokens).toBe(13)
      expect(result.model).toBe('llama2')
      expect(result.provider).toBe('ollama')
    })
    
    it('should handle streaming completion', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"response":"Hello","done":false}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"response":" world","done":false}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('{"done":true}\n')
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
      
      const options: CompletionOptions = {
        prompt: 'Say hello'
      }
      
      const chunks: any[] = []
      for await (const chunk of provider.completion.stream(options)) {
        chunks.push(chunk)
      }
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual({ text: 'Hello', delta: 'Hello', finished: false })
      expect(chunks[1]).toEqual({ text: ' world', delta: ' world', finished: false })
      expect(chunks[2]).toEqual({ text: '', delta: '', finished: true })
    })
  })
  
  describe('embeddings', () => {
    beforeEach(async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [{ name: 'nomic-embed-text' }] })
      await provider.initialize(mockConfig)
    })
    
    it('should create embeddings for single input', async () => {
      const mockResponse = {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      }
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue(mockResponse)
      
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      const result = await provider.embedding.create(options)
      
      expect(result.embeddings).toHaveLength(1)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
      expect(result.model).toBe('nomic-embed-text')
      expect(result.provider).toBe('ollama')
    })
    
    it('should create embeddings for multiple inputs', async () => {
      const mockResponses = [
        { embedding: [0.1, 0.2, 0.3] },
        { embedding: [0.4, 0.5, 0.6] }
      ]
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch)
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
      
      const options: EmbeddingOptions = {
        input: ['First text', 'Second text']
      }
      
      const result = await provider.embedding.create(options)
      
      expect(result.embeddings).toHaveLength(2)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
      expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6])
    })
  })
  
  describe('model management', () => {
    beforeEach(async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [] })
      await provider.initialize(mockConfig)
    })
    
    it('should list available models', async () => {
      const mockModels = [
        {
          name: 'llama2',
          modified_at: '2023-01-01T00:00:00Z',
          size: 1000000,
          digest: 'abc123',
          details: {
            format: 'gguf',
            family: 'llama',
            families: ['llama'],
            parameter_size: '7B',
            quantization_level: 'Q4_0'
          }
        }
      ]
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: mockModels })
      
      const models = await provider.listModels()
      
      expect(models).toHaveLength(1)
      expect(models[0].name).toBe('llama2')
      expect(models[0].details.parameter_size).toBe('7B')
    })
    
    it('should pull a model', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as any)
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [{ name: 'llama2' }] })
      
      await expect(provider.pullModel('llama2')).resolves.not.toThrow()
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pull'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'llama2' })
        })
      )
    })
    
    it('should delete a model', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as any)
      
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [] })
      
      await expect(provider.deleteModel('llama2')).resolves.not.toThrow()
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/delete'),
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ name: 'llama2' })
        })
      )
    })
  })
  
  describe('error handling', () => {
    beforeEach(async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({ models: [] })
      await provider.initialize(mockConfig)
    })
    
    it('should handle connection refused error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ code: 'ECONNREFUSED' })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('Ollama server is not running')
    })
    
    it('should handle 404 model not found error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({ status: 404 })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('Ollama model not found')
    })
    
    it('should handle 400 bad request error', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue({
        status: 400,
        data: { error: 'Invalid parameters' }
      })
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(provider.chat.create(options)).rejects.toThrow('Ollama API error: Invalid parameters')
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
      
      await expect(provider.chat.create(options)).rejects.toThrow('Ollama server error')
    })
  })
  
  describe('provider not initialized', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedProvider = new OllamaProvider()
      
      const options: ChatOptions = {
        messages: [{
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }]
      }
      
      await expect(uninitializedProvider.chat.create(options)).rejects.toThrow('Provider Ollama is not initialized')
    })
  })
  
  describe('model selection', () => {
    it('should use first available model as default when models are available', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockResolvedValue({
        models: [
          { name: 'custom-model' },
          { name: 'llama2' }
        ]
      })
      
      await provider.initialize(mockConfig)
      
      expect(provider.getAvailableModels()).toContain('custom-model')
      expect(provider.getAvailableModels()).toContain('llama2')
    })
    
    it('should fall back to default models when fetch fails', async () => {
      const { ofetch } = await import('ofetch')
      vi.mocked(ofetch).mockRejectedValue(new Error('Network error'))
      
      await provider.initialize(mockConfig)
      
      const availableModels = provider.getAvailableModels()
      expect(availableModels).toContain('llama2')
      expect(availableModels).toContain('codellama')
      expect(availableModels).toContain('mistral')
    })
  })
})