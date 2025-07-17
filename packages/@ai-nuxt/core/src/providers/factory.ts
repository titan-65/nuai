import type { AIProvider, ProviderConfig } from '../types'
import { providerRegistry } from './registry'
import { ProviderValidator } from './validation'

export class ProviderFactory {
  static async create(config: ProviderConfig): Promise<AIProvider> {
    // Validate configuration
    const validation = ProviderValidator.validateConfig(config)
    if (!validation.valid) {
      throw new ProviderConfigError(
        `Invalid provider configuration: ${validation.errors.join(', ')}`,
        config.id,
        validation.errors
      )
    }
    
    // Get provider from registry
    const provider = providerRegistry.get(config.id)
    
    // Initialize provider
    try {
      await provider.initialize(config)
      return provider
    } catch (error) {
      throw new ProviderInitializationError(
        `Failed to initialize provider ${config.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        config.id,
        error instanceof Error ? error : new Error('Unknown error')
      )
    }
  }
  
  static async createMultiple(configs: ProviderConfig[]): Promise<Map<string, AIProvider>> {
    const providers = new Map<string, AIProvider>()
    const errors: Array<{ id: string; error: Error }> = []
    
    await Promise.allSettled(
      configs.map(async (config) => {
        try {
          const provider = await this.create(config)
          providers.set(config.id, provider)
        } catch (error) {
          errors.push({
            id: config.id,
            error: error instanceof Error ? error : new Error('Unknown error')
          })
        }
      })
    )
    
    if (errors.length > 0) {
      throw new MultipleProviderError(
        `Failed to initialize ${errors.length} provider(s)`,
        errors
      )
    }
    
    return providers
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class ProviderConfigError extends ProviderError {
  constructor(
    message: string,
    providerId: string,
    public readonly validationErrors: string[]
  ) {
    super(message, providerId)
    this.name = 'ProviderConfigError'
  }
}

export class ProviderInitializationError extends ProviderError {
  constructor(
    message: string,
    providerId: string,
    originalError: Error
  ) {
    super(message, providerId, originalError)
    this.name = 'ProviderInitializationError'
  }
}

export class MultipleProviderError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ id: string; error: Error }>
  ) {
    super(message)
    this.name = 'MultipleProviderError'
  }
}

export class ProviderNotFoundError extends ProviderError {
  constructor(providerId: string) {
    super(`Provider ${providerId} not found`, providerId)
    this.name = 'ProviderNotFoundError'
  }
}

export class ProviderNotConfiguredError extends ProviderError {
  constructor(providerId: string) {
    super(`Provider ${providerId} is not configured`, providerId)
    this.name = 'ProviderNotConfiguredError'
  }
}