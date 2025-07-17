import type { ProviderConfig, ChatOptions, CompletionOptions, EmbeddingOptions } from '../types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class ProviderValidator {
  static validateConfig(config: ProviderConfig): ValidationResult {
    const errors: string[] = []
    
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Provider ID is required and must be a string')
    }
    
    if (!config.name || typeof config.name !== 'string') {
      errors.push('Provider name is required and must be a string')
    }
    
    if (config.apiKey && typeof config.apiKey !== 'string') {
      errors.push('API key must be a string')
    }
    
    if (config.baseURL && typeof config.baseURL !== 'string') {
      errors.push('Base URL must be a string')
    }
    
    if (config.models && !Array.isArray(config.models)) {
      errors.push('Models must be an array')
    }
    
    if (config.defaultModel && typeof config.defaultModel !== 'string') {
      errors.push('Default model must be a string')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateChatOptions(options: ChatOptions): ValidationResult {
    const errors: string[] = []
    
    if (!options.messages || !Array.isArray(options.messages)) {
      errors.push('Messages array is required')
    } else if (options.messages.length === 0) {
      errors.push('At least one message is required')
    }
    
    if (options.temperature !== undefined) {
      if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2')
      }
    }
    
    if (options.maxTokens !== undefined) {
      if (typeof options.maxTokens !== 'number' || options.maxTokens < 1) {
        errors.push('Max tokens must be a positive number')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateCompletionOptions(options: CompletionOptions): ValidationResult {
    const errors: string[] = []
    
    if (!options.prompt || typeof options.prompt !== 'string') {
      errors.push('Prompt is required and must be a string')
    }
    
    if (options.temperature !== undefined) {
      if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2')
      }
    }
    
    if (options.maxTokens !== undefined) {
      if (typeof options.maxTokens !== 'number' || options.maxTokens < 1) {
        errors.push('Max tokens must be a positive number')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
  
  static validateEmbeddingOptions(options: EmbeddingOptions): ValidationResult {
    const errors: string[] = []
    
    if (!options.input) {
      errors.push('Input is required')
    } else if (typeof options.input !== 'string' && !Array.isArray(options.input)) {
      errors.push('Input must be a string or array of strings')
    } else if (Array.isArray(options.input)) {
      if (options.input.length === 0) {
        errors.push('Input array cannot be empty')
      } else if (!options.input.every(item => typeof item === 'string')) {
        errors.push('All input array items must be strings')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
}