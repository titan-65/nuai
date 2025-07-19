import { createError } from 'h3'
import type { ChatOptions, CompletionOptions, EmbeddingOptions } from '@ai-nuxt/core'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class APIValidator {
  static validateChatRequest(body: any): ValidationResult {
    const errors: string[] = []
    
    if (!body.messages || !Array.isArray(body.messages)) {
      errors.push('Messages array is required')
    } else if (body.messages.length === 0) {
      errors.push('Messages array cannot be empty')
    } else {
      // Validate each message
      body.messages.forEach((msg: any, index: number) => {
        if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
          errors.push(`Message ${index}: role must be 'system', 'user', or 'assistant'`)
        }
        if (!msg.content || typeof msg.content !== 'string') {
          errors.push(`Message ${index}: content is required and must be a string`)
        }
        if (msg.content && msg.content.length > 100000) {
          errors.push(`Message ${index}: content exceeds maximum length of 100,000 characters`)
        }
      })
    }
    
    if (body.temperature !== undefined) {
      if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2')
      }
    }
    
    if (body.maxTokens !== undefined) {
      if (typeof body.maxTokens !== 'number' || body.maxTokens < 1 || body.maxTokens > 100000) {
        errors.push('Max tokens must be a number between 1 and 100,000')
      }
    }
    
    if (body.systemPrompt !== undefined) {
      if (typeof body.systemPrompt !== 'string') {
        errors.push('System prompt must be a string')
      } else if (body.systemPrompt.length > 10000) {
        errors.push('System prompt exceeds maximum length of 10,000 characters')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateCompletionRequest(body: any): ValidationResult {
    const errors: string[] = []
    
    if (!body.prompt || typeof body.prompt !== 'string') {
      errors.push('Prompt is required and must be a string')
    } else if (body.prompt.length > 50000) {
      errors.push('Prompt exceeds maximum length of 50,000 characters')
    }
    
    if (body.temperature !== undefined) {
      if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2')
      }
    }
    
    if (body.maxTokens !== undefined) {
      if (typeof body.maxTokens !== 'number' || body.maxTokens < 1 || body.maxTokens > 100000) {
        errors.push('Max tokens must be a number between 1 and 100,000')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateEmbeddingRequest(body: any): ValidationResult {
    const errors: string[] = []
    
    if (!body.input) {
      errors.push('Input is required')
    } else if (typeof body.input !== 'string' && !Array.isArray(body.input)) {
      errors.push('Input must be a string or array of strings')
    } else if (Array.isArray(body.input)) {
      if (body.input.length === 0) {
        errors.push('Input array cannot be empty')
      } else if (body.input.length > 100) {
        errors.push('Input array cannot contain more than 100 items')
      } else if (!body.input.every((item: any) => typeof item === 'string')) {
        errors.push('All input array items must be strings')
      } else {
        // Check individual string lengths
        body.input.forEach((item: string, index: number) => {
          if (item.length > 10000) {
            errors.push(`Input ${index} exceeds maximum length of 10,000 characters`)
          }
        })
      }
    } else if (typeof body.input === 'string' && body.input.length > 10000) {
      errors.push('Input exceeds maximum length of 10,000 characters')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateProvider(providerId?: string): ValidationResult {
    const errors: string[] = []
    
    if (providerId && typeof providerId !== 'string') {
      errors.push('Provider ID must be a string')
    }
    
    if (providerId && !['openai', 'anthropic', 'ollama'].includes(providerId)) {
      errors.push('Provider must be one of: openai, anthropic, ollama')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static throwValidationError(errors: string[]): never {
    throw createError({
      statusCode: 400,
      statusMessage: `Validation failed: ${errors.join(', ')}`
    })
  }
}