import { ref } from 'vue'

interface Model {
  id: string
  name: string
  provider: string
}

interface Template {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  config: any
}

interface CompletionRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  temperature: number
  max_tokens: number
  top_p: number
  frequency_penalty: number
}

interface CompletionResponse {
  content: string
  usage?: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
  cost?: number
}

const availableModels = ref<Model[]>([])
const templates = ref<Template[]>([])

export function useAIPlayground() {
  async function fetchAvailableModels() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/playground/models')
      const data = await response.json()
      availableModels.value = data
    } catch (error) {
      console.error('Failed to fetch models:', error)
      // Mock data for development
      availableModels.value = [
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
        { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
        { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' }
      ]
    }
  }

  async function fetchTemplates() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/playground/templates')
      const data = await response.json()
      templates.value = data
    } catch (error) {
      console.error('Failed to fetch templates:', error)
      // Mock data for development
      templates.value = [
        {
          id: '1',
          name: 'Code Review',
          systemPrompt: 'You are a senior software engineer reviewing code. Provide constructive feedback.',
          userPrompt: 'Please review this code:\n\n```javascript\n// Your code here\n```',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.3,
            maxTokens: 1000,
            topP: 1,
            frequencyPenalty: 0
          }
        },
        {
          id: '2',
          name: 'Creative Writing',
          systemPrompt: 'You are a creative writing assistant. Help with storytelling and narrative.',
          userPrompt: 'Write a short story about...',
          config: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            temperature: 0.8,
            maxTokens: 1500,
            topP: 0.9,
            frequencyPenalty: 0.5
          }
        }
      ]
    }
  }

  async function runCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/playground/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      throw new Error(`Failed to run completion: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function saveTemplate(template: Template) {
    try {
      await fetch('/__ai_nuxt_devtools/api/playground/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      })
      templates.value.push(template)
    } catch (error) {
      console.error('Failed to save template:', error)
      throw error
    }
  }

  function estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4)
  }

  function estimateCost(tokens: number, model: string): number {
    // Simple cost estimation based on model
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 }
    }
    
    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo']
    return (tokens / 1000) * modelPricing.input
  }

  // Initialize data
  fetchAvailableModels()
  fetchTemplates()

  return {
    availableModels,
    templates,
    runCompletion,
    saveTemplate,
    estimateTokens,
    estimateCost
  }
}