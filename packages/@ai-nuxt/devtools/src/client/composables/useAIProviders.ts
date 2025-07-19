import { ref } from 'vue'

interface Provider {
  id: string
  name: string
  active: boolean
  stats: {
    requests: number
    errors: number
    avgLatency: number
    cost: number
  }
  models: Array<{
    id: string
    name: string
    type: string
  }>
  config: {
    apiKey: string
    baseURL?: string
    organization?: string
  }
}

const providers = ref<Provider[]>([])

export function useAIProviders() {
  async function fetchProviders() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/providers')
      const data = await response.json()
      providers.value = data
    } catch (error) {
      console.error('Failed to fetch providers:', error)
      // Mock data for development
      providers.value = [
        {
          id: 'openai',
          name: 'OpenAI',
          active: true,
          stats: {
            requests: 42,
            errors: 2,
            avgLatency: 1250,
            cost: 0.0234
          },
          models: [
            { id: 'gpt-4', name: 'GPT-4', type: 'chat' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', type: 'chat' }
          ],
          config: {
            apiKey: 'sk-1234567890abcdef'
          }
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          active: false,
          stats: {
            requests: 0,
            errors: 0,
            avgLatency: 0,
            cost: 0
          },
          models: [
            { id: 'claude-3-opus', name: 'Claude 3 Opus', type: 'chat' },
            { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', type: 'chat' }
          ],
          config: {
            apiKey: ''
          }
        }
      ]
    }
  }

  async function testProviderConnection(providerId: string) {
    try {
      const response = await fetch(`/__ai_nuxt_devtools/api/providers/${providerId}/test`, {
        method: 'POST'
      })
      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  return {
    providers,
    fetchProviders,
    testProviderConnection
  }
}