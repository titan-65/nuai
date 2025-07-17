import type { AIProvider, ProviderConfig } from '../types'
import { providerRegistry } from './registry'
import { ProviderFactory, ProviderNotFoundError, ProviderNotConfiguredError } from './factory'

/**
 * Get a configured AI provider by ID
 */
export function getProvider(providerId: string): AIProvider {
  if (!providerRegistry.has(providerId)) {
    throw new ProviderNotFoundError(providerId)
  }
  
  if (!providerRegistry.isConfigured(providerId)) {
    throw new ProviderNotConfiguredError(providerId)
  }
  
  return providerRegistry.get(providerId)
}

/**
 * Get the first available configured provider
 */
export function getDefaultProvider(): AIProvider {
  const configured = providerRegistry.listConfigured()
  if (configured.length === 0) {
    throw new Error('No providers are configured')
  }
  
  return configured[0]
}

/**
 * Initialize multiple providers from configurations
 */
export async function initializeProviders(configs: ProviderConfig[]): Promise<void> {
  await Promise.all(
    configs.map(config => providerRegistry.configure(config))
  )
}

/**
 * Check if a provider supports a specific capability
 */
export function hasCapability(provider: AIProvider, capability: keyof AIProvider): boolean {
  return provider[capability] !== undefined
}

/**
 * Get all providers that support a specific capability
 */
export function getProvidersWithCapability(capability: keyof AIProvider): AIProvider[] {
  return providerRegistry.listConfigured().filter(provider => hasCapability(provider, capability))
}

/**
 * Get provider statistics
 */
export function getProviderStats() {
  const registered = providerRegistry.list()
  const configured = providerRegistry.listConfigured()
  
  return {
    total: registered.length,
    configured: configured.length,
    unconfigured: registered.length - configured.length,
    providers: registered.map(provider => ({
      id: provider.id,
      name: provider.name,
      models: provider.models,
      defaultModel: provider.defaultModel,
      configured: providerRegistry.isConfigured(provider.id),
      capabilities: {
        chat: !!provider.chat,
        completion: !!provider.completion,
        embedding: !!provider.embedding,
        vision: !!provider.vision,
        audio: !!provider.audio
      }
    }))
  }
}