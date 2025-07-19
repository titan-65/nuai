import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#nitro'

/**
 * Get available AI providers and their status
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Get configured providers
  const providers = aiConfig.providers?.map((provider: any) => ({
    id: provider.id,
    name: provider.name,
    models: provider.models || [],
    defaultModel: provider.defaultModel,
    configured: !!provider.apiKey
  })) || []
  
  return {
    providers,
    defaultProvider: aiConfig.defaultProvider,
    total: providers.length,
    configured: providers.filter(p => p.configured).length
  }
})