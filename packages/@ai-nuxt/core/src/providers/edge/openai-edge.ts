import { BaseAIProvider } from '../base'
import type { 
  ChatMessage, 
  ChatResponse, 
  CompletionResponse, 
  EmbeddingResponse,
  ProviderConfig 
} from '../../types'

/**
 * Edge-optimized OpenAI provider
 */
export class OpenAIEdgeProvider extends BaseAIProvider {
  private apiKey: string
  private baseURL: string
  private maxConcurrency: number
  private timeout: number

  constructor(config: ProviderConfig & { 
    apiKey: string
    maxConcurrency?: number
    timeout?: number
  }) {
    super('openai', config)
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.openai.com/v1'
    this.maxConcurrency = config.maxConcurrency || 10
    this.timeout = config.timeout || 30000
  }

  /**
   * Edge-compatible chat implementation
   */
  async chat(
    messages: ChatMessage[],
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
      stream?: boolean
    } = {}
  ): Promise<ChatResponse> {
    const model = options.model || 'gpt-3.5-turbo'
    
    // Edge-optimized request
    const response = await this.makeEdgeRequest('/chat/completions', {
      model,
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      stream: options.stream || false
    })

    if (options.stream) {
      return this.handleStreamingResponse(response)
    }

    const data = await response.json()
    
    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      finishReason: data.choices[0]?.finish_reason
    }
  }

  /**
   * Edge-compatible completion implementation
   */
  async completion(
    prompt: string,
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
    } = {}
  ): Promise<CompletionResponse> {
    // Use chat endpoint for completions (more efficient on edge)
    const chatResponse = await this.chat([
      { role: 'user', content: prompt }
    ], options)

    return {
      content: chatResponse.content,
      usage: chatResponse.usage,
      model: chatResponse.model,
      finishReason: chatResponse.finishReason
    }
  }

  /**
   * Edge-compatible embedding implementation
   */
  async embedding(
    input: string | string[],
    options: {
      model?: string
    } = {}
  ): Promise<EmbeddingResponse> {
    const model = options.model || 'text-embedding-ada-002'
    
    const response = await this.makeEdgeRequest('/embeddings', {
      model,
      input: Array.isArray(input) ? input : [input]
    })

    const data = await response.json()
    
    return {
      embeddings: data.data.map((item: any) => item.embedding),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model
    }
  }

  /**
   * Edge-optimized HTTP request
   */
  private async makeEdgeRequest(endpoint: string, body: any): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`
    
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Nuxt-Edge/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error(`OpenAI API timeout after ${this.timeout}ms`)
      }
      
      throw error
    }
  }

  /**
   * Handle streaming response for edge
   */
  private async handleStreamingResponse(response: Response): Promise<ChatResponse> {
    if (!response.body) {
      throw new Error('No response body for streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let content = ''
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let model = ''
    let finishReason = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              break
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              
              if (delta?.content) {
                content += delta.content
              }
              
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0
                }
              }
              
              if (parsed.model) {
                model = parsed.model
              }
              
              if (parsed.choices?.[0]?.finish_reason) {
                finishReason = parsed.choices[0].finish_reason
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      content,
      usage,
      model,
      finishReason
    }
  }

  /**
   * Edge-compatible health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'AI-Nuxt-Edge/1.0'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      return response.ok
    } catch {
      return false
    }
  }
}