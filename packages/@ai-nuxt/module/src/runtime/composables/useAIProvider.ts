import { ref, computed } from 'vue'
import { useRuntimeConfig, useNuxtApp } from '#app'

/**
 * Composable for managing AI provider information and switching
 */
export function useAIProvider() {
  const config = useRuntimeConfig()
  const { $ai } = useNuxtApp()
  
  // Reactive state
  const currentProvider = ref(config.public.aiNuxt.defaultProvider)
  
  // Computed properties
  const availableProviders = computed(() => {
    return $ai?.providers || []
  })
  
  const isProviderAvailable = computed(() => {
    return (providerId: string) => availableProviders.value.includes(providerId)
  })
  
  const providerInfo = computed(() => {
    return {
      current: currentProvider.value,
      available: availableProviders.value,
      streaming: config.public.aiNuxt.streaming,
      caching: config.public.aiNuxt.caching,
      debug: config.public.aiNuxt.debug
    }
  })
  
  // Methods
  const switchProvider = (providerId: string) => {
    if (!isProviderAvailable.value(providerId)) {
      throw new Error(`Provider ${providerId} is not available`)
    }
    
    currentProvider.value = providerId
    
    if (config.public.aiNuxt.debug) {
      console.log(`🔄 Switched to AI provider: ${providerId}`)
    }
  }
  
  const resetToDefault = () => {
    currentProvider.value = config.public.aiNuxt.defaultProvider
  }
  
  const getProviderCapabilities = (providerId?: string) => {
    const provider = providerId || currentProvider.value
    
    // This would ideally come from the server or be configured
    // For now, we'll return a basic capability map
    const capabilities = {
      openai: {
        chat: true,
        completion: true,
        embedding: true,
        vision: false,
        audio: false,
        streaming: true
      },
      anthropic: {
        chat: true,
        completion: true,
        embedding: false,
        vision: false,
        audio: false,
        streaming: true
      },
      ollama: {
        chat: true,
        completion: true,
        embedding: true,
        vision: false,
        audio: false,
        streaming: true
      }
    }
    
    return capabilities[provider as keyof typeof capabilities] || {
      chat: false,
      completion: false,
      embedding: false,
      vision: false,
      audio: false,
      streaming: false
    }
  }
  
  const isCapabilitySupported = (capability: string, providerId?: string) => {
    const caps = getProviderCapabilities(providerId)
    return caps[capability as keyof typeof caps] || false
  }
  
  return {
    // State
    currentProvider: readonly(currentProvider),
    availableProviders,
    isProviderAvailable,
    providerInfo,
    
    // Methods
    switchProvider,
    resetToDefault,
    getProviderCapabilities,
    isCapabilitySupported
  }
}