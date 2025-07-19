import { ref } from 'vue'

interface AIRequest {
  id: string
  provider: string
  model: string
  operation: string
  prompt: string
  response: string
  status: 'success' | 'error'
  timestamp: Date
  duration: number
  tokens?: number
  cost?: number
  options?: Record<string, any>
  error?: string
}

const requests = ref<AIRequest[]>([])

export function useAIRequests() {
  async function fetchRequests() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/requests')
      const data = await response.json()
      requests.value = data.map((req: any) => ({
        ...req,
        timestamp: new Date(req.timestamp)
      }))
    } catch (error) {
      console.error('Failed to fetch AI requests:', error)
    }
  }

  async function clearAllRequests() {
    try {
      await fetch('/__ai_nuxt_devtools/api/requests', {
        method: 'DELETE'
      })
      requests.value = []
    } catch (error) {
      console.error('Failed to clear requests:', error)
    }
  }

  return {
    requests,
    fetchRequests,
    clearAllRequests
  }
}