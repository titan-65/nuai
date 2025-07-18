import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { 
  providerRegistry, 
  OpenAIProvider, 
  AnthropicProvider, 
  OllamaProvider,
  ProviderFactory
} from '@ai-nuxt/core'
import type { ProviderConfig } from '@ai-nuxt/core'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Register available providers
  const openaiProvider = new OpenAIProvider()
  const anthropicProvider = new AnthropicProvider()
  const ollamaProvider = new OllamaProvider()
  
  providerRegistry.register(openaiProvider)
  providerRegistry.register(anthropicProvider)
  providerRegistry.register(ollamaProvider)
  
  // Initialize configured providers with API keys
  if (aiConfig.providers && aiConfig.providers.length > 0) {
    try {
      for (const providerConfig of aiConfig.providers as ProviderConfig[]) {
        // Merge with API keys from runtime config
        const configWithApiKey = {
          ...providerConfig,
          apiKey: providerConfig.apiKey || aiConfig.apiKeys?.[providerConfig.id]
        }
        
        await providerRegistry.configure(configWithApiKey)
        
        if (aiConfig.debug) {
          console.log(`✅ Initialized ${providerConfig.id} provider`)
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize AI providers:', error)
    }
  }
  
  const configuredProviders = providerRegistry.listConfigured().map(p => p.id)
  
  if (aiConfig.debug) {
    console.log('🤖 AI Nuxt server initialized')
    console.log('Configured providers:', configuredProviders)
    console.log('Default provider:', aiConfig.defaultProvider)
  }
  
  return {
    provide: {
      ai: {
        initialized: true,
        providers: configuredProviders,
        defaultProvider: aiConfig.defaultProvider
      }
    }
  }
})