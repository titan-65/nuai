import type { AIProvider, ProviderConfig } from '../types'
import { BaseAIProvider } from './base'

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>()
  private configs = new Map<string, ProviderConfig>()
  
  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
  }
  
  unregister(providerId: string): void {
    this.providers.delete(providerId)
    this.configs.delete(providerId)
  }
  
  async configure(config: ProviderConfig): Promise<void> {
    const provider = this.providers.get(config.id)
    if (!provider) {
      throw new Error(`Provider ${config.id} is not registered`)
    }
    
    await provider.initialize(config)
    this.configs.set(config.id, config)
  }
  
  get(providerId: string): AIProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} is not registered`)
    }
    return provider
  }
  
  getConfig(providerId: string): ProviderConfig | undefined {
    return this.configs.get(providerId)
  }
  
  list(): AIProvider[] {
    return Array.from(this.providers.values())
  }
  
  listConfigured(): AIProvider[] {
    return Array.from(this.configs.keys())
      .map(id => this.providers.get(id))
      .filter(Boolean) as AIProvider[]
  }
  
  has(providerId: string): boolean {
    return this.providers.has(providerId)
  }
  
  isConfigured(providerId: string): boolean {
    return this.configs.has(providerId)
  }
  
  clear(): void {
    this.providers.clear()
    this.configs.clear()
  }
}

// Global registry instance
export const providerRegistry = new ProviderRegistry()