import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { 
  providerRegistry, 
  OpenAIProvider, 
  AnthropicProvider, 
  OllamaProvider 
} from '@ai-nuxt/core'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const aiConfig = config.public.aiNuxt
  
  // Register available providers
  const openaiProvider = new OpenAIProvider()
  const anthropicProvider = new AnthropicProvider()
  const ollamaProvider = new OllamaProvider()
  
  providerRegistry.register(openaiProvider)
  providerRegistry.register(anthropicProvider)
  providerRegistry.register(ollamaProvider)
  
  // Initialize providers based on configuration
  // Note: API keys should be handled server-side for security
  const availableProviders = providerRegistry.list().map(p => p.id)
  
  if (aiConfig.debug) {
    console.log('🤖 AI Nuxt client initialized')
    console.log('Available providers:', availableProviders)
    console.log('Default provider:', aiConfig.defaultProvider)
  }
  
  return {
    provide: {
      ai: {
        initialized: true,
        providers: availableProviders,
        defaultProvider: aiConfig.defaultProvider,
        streaming: aiConfig.streaming,
        caching: aiConfig.caching
      }
    }
  }
})