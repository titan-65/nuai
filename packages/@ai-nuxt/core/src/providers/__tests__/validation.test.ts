import { describe, it, expect } from 'vitest'
import { ProviderValidator } from '../validation'
import type { ProviderConfig, ChatOptions, CompletionOptions, EmbeddingOptions } from '../../types'

describe('ProviderValidator', () => {
  describe('validateConfig', () => {
    it('should validate valid provider config', () => {
      const config: ProviderConfig = {
        id: 'test-provider',
        name: 'Test Provider',
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
        models: ['model-1', 'model-2'],
        defaultModel: 'model-1'
      }
      
      const result = ProviderValidator.validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject config without id', () => {
      const config = {
        name: 'Test Provider'
      } as ProviderConfig
      
      const result = ProviderValidator.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Provider ID is required and must be a string')
    })
    
    it('should reject config without name', () => {
      const config = {
        id: 'test-provider'
      } as ProviderConfig
      
      const result = ProviderValidator.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Provider name is required and must be a string')
    })
    
    it('should reject config with invalid apiKey type', () => {
      const config = {
        id: 'test-provider',
        name: 'Test Provider',
        apiKey: 123
      } as any
      
      const result = ProviderValidator.validateConfig(config)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('API key must be a string')
    })
  })
  
  describe('validateChatOptions', () => {
    it('should validate valid chat options', () => {
      const options: ChatOptions = {
        messages: [
          { id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
        ],
        temperature: 0.7,
        maxTokens: 100
      }
      
      const result = ProviderValidator.validateChatOptions(options)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject options without messages', () => {
      const options = {} as ChatOptions
      
      const result = ProviderValidator.validateChatOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Messages array is required')
    })
    
    it('should reject options with empty messages array', () => {
      const options: ChatOptions = {
        messages: []
      }
      
      const result = ProviderValidator.validateChatOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one message is required')
    })
    
    it('should reject invalid temperature', () => {
      const options: ChatOptions = {
        messages: [
          { id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
        ],
        temperature: 3.0
      }
      
      const result = ProviderValidator.validateChatOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Temperature must be a number between 0 and 2')
    })
  })
  
  describe('validateCompletionOptions', () => {
    it('should validate valid completion options', () => {
      const options: CompletionOptions = {
        prompt: 'Complete this text',
        temperature: 0.5,
        maxTokens: 50
      }
      
      const result = ProviderValidator.validateCompletionOptions(options)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject options without prompt', () => {
      const options = {} as CompletionOptions
      
      const result = ProviderValidator.validateCompletionOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Prompt is required and must be a string')
    })
  })
  
  describe('validateEmbeddingOptions', () => {
    it('should validate valid embedding options with string input', () => {
      const options: EmbeddingOptions = {
        input: 'Text to embed'
      }
      
      const result = ProviderValidator.validateEmbeddingOptions(options)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should validate valid embedding options with array input', () => {
      const options: EmbeddingOptions = {
        input: ['Text 1', 'Text 2']
      }
      
      const result = ProviderValidator.validateEmbeddingOptions(options)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject options without input', () => {
      const options = {} as EmbeddingOptions
      
      const result = ProviderValidator.validateEmbeddingOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Input is required')
    })
    
    it('should reject empty array input', () => {
      const options: EmbeddingOptions = {
        input: []
      }
      
      const result = ProviderValidator.validateEmbeddingOptions(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Input array cannot be empty')
    })
  })
})