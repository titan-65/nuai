import { ref } from 'vue'

interface Model {
  id: string
  name: string
  provider: string
  type: string
  active: boolean
  contextLength: number
  maxOutput: number
  pricing: {
    input: number
    output: number
  }
  capabilities: string[]
  stats: {
    requests: number
    avgLatency: number
    successRate: number
    totalCost: number
  }
}

const models = ref<Model[]>([])

export function useAIModels() {
  async function fetchModels() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/models')
      const data = await response.json()
      models.value = data
    } catch (error) {
      console.error('Failed to fetch models:', error)
      // Mock data for development
      models.value = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          type: 'chat',
          active: true,
          contextLength: 8192,
          maxOutput: 4096,
          pricing: {
            input: 0.03,
            output: 0.06
          },
          capabilities: ['chat', 'completion', 'function-calling'],
          stats: {
            requests: 25,
            avgLatency: 1450,
            successRate: 96.0,
            totalCost: 0.0156
          }
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          type: 'chat',
          active: true,
          contextLength: 4096,
          maxOutput: 4096,
          pricing: {
            input: 0.0015,
            output: 0.002
          },
          capabilities: ['chat', 'completion', 'function-calling'],
          stats: {
            requests: 17,
            avgLatency: 850,
            successRate: 98.5,
            totalCost: 0.0078
          }
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'anthropic',
          type: 'chat',
          active: false,
          contextLength: 200000,
          maxOutput: 4096,
          pricing: {
            input: 0.015,
            output: 0.075
          },
          capabilities: ['chat', 'completion', 'analysis'],
          stats: {
            requests: 0,
            avgLatency: 0,
            successRate: 0,
            totalCost: 0
          }
        }
      ]
    }
  }

  async function testModel(modelId: string) {
    try {
      const response = await fetch(`/__ai_nuxt_devtools/api/models/${modelId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'Hello, this is a test message. Please respond briefly.'
        })
      })
      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        responseTime: 0,
        tokensUsed: 0,
        cost: 0,
        prompt: 'Hello, this is a test message. Please respond briefly.',
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  return {
    models,
    fetchModels,
    testModel
  }
}