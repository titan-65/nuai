import { ofetch } from 'ofetch'
import { BaseAIProvider } from './base'
import { generateId } from '../utils'
import type {
  ProviderConfig,
  ChatOptions,
  ChatResponse,
  ChatChunk,
  CompletionOptions,
  CompletionResponse,
  CompletionChunk,
  EmbeddingOptions,
  EmbeddingResponse,
  Message,
  TokenUsage
} from '../types'

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: 'assistant'
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

interface OllamaGenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

interface OllamaEmbeddingResponse {
  embedding: number[]
}

interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
  details: {
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}

interface OllamaModelsResponse {
  models: OllamaModel[]
}

export class OllamaProvider extends BaseAIProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama'
  readonly models: string[] = []
  readonly defaultModel = 'llama2'
  
  private baseURL = 'http://localhost:11434'
  private availableModels: string[] = []
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.validateConfig(config)
    
    this.baseURL = config.baseURL || this.baseURL
    this.config = config
    
    // Fetch available models from Ollama
    try {
      await this.fetchAvailableModels()
    } catch (error) {
      console.warn('Could not fetch Ollama models. Make sure Ollama is running.', error)
    }
    
    this.initialized = true
  }
  
  protected requiresApiKey(): boolean {
    return false // Ollama doesn't require API keys for local usage
  }
  
  readonly chat = {
    create: async (options: ChatOptions): Promise<ChatResponse> => {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt })
      }
      
      const response = await this.makeRequest<OllamaChatResponse>('/api/chat', {
        model: options.model || this.getDefaultModel(),
        messages,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens
        }
      })
      
      return this.convertChatResponse(response)
    },
    
    stream: async function* (options: ChatOptions): AsyncIterator<ChatChunk> {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt })
      }
      
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.getDefaultModel(),
          messages,
          stream: true,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed === '') continue
            
            try {
              const data = JSON.parse(trimmed) as OllamaChatResponse
              
              if (data.message?.content) {
                yield {
                  content: data.message.content,
                  delta: data.message.content,
                  finished: false
                }
              }
              
              if (data.done) {
                yield {
                  content: '',
                  delta: '',
                  finished: true
                }
                break
              }
            } catch (error) {
              console.warn('Failed to parse streaming chunk:', error)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    }.bind(this)
  }
  
  readonly completion = {
    create: async (options: CompletionOptions): Promise<CompletionResponse> => {
      this.ensureInitialized()
      
      const response = await this.makeRequest<OllamaGenerateResponse>('/api/generate', {
        model: options.model || this.getDefaultModel(),
        prompt: options.prompt,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens
        }
      })
      
      return this.convertCompletionResponse(response)
    },
    
    stream: async function* (options: CompletionOptions): AsyncIterator<CompletionChunk> {
      this.ensureInitialized()
      
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.getDefaultModel(),
          prompt: options.prompt,
          stream: true,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed === '') continue
            
            try {
              const data = JSON.parse(trimmed) as OllamaGenerateResponse
              
              if (data.response) {
                yield {
                  text: data.response,
                  delta: data.response,
                  finished: false
                }
              }
              
              if (data.done) {
                yield {
                  text: '',
                  delta: '',
                  finished: true
                }
                break
              }
            } catch (error) {
              console.warn('Failed to parse streaming chunk:', error)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    }.bind(this)
  }
  
  readonly embedding = {
    create: async (options: EmbeddingOptions): Promise<EmbeddingResponse> => {
      this.ensureInitialized()
      
      const inputs = Array.isArray(options.input) ? options.input : [options.input]
      const embeddings: number[][] = []
      
      // Ollama processes embeddings one at a time
      for (const input of inputs) {
        const response = await this.makeRequest<OllamaEmbeddingResponse>('/api/embeddings', {
          model: options.model || 'nomic-embed-text',
          prompt: input
        })
        
        embeddings.push(response.embedding)
      }
      
      return {
        embeddings,
        usage: {
          promptTokens: this.estimateTokens(inputs.join(' ')),
          completionTokens: 0,
          totalTokens: this.estimateTokens(inputs.join(' '))
        },
        model: options.model || 'nomic-embed-text',
        provider: this.id
      }
    }
  }
  
  // Ollama-specific methods
  async pullModel(modelName: string): Promise<void> {
    this.ensureInitialized()
    
    const response = await fetch(`${this.baseURL}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: modelName
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to pull model ${modelName}: ${response.status} ${response.statusText}`)
    }
    
    // Refresh available models after pulling
    await this.fetchAvailableModels()
  }
  
  async deleteModel(modelName: string): Promise<void> {
    this.ensureInitialized()
    
    const response = await fetch(`${this.baseURL}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: modelName
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to delete model ${modelName}: ${response.status} ${response.statusText}`)
    }
    
    // Refresh available models after deletion
    await this.fetchAvailableModels()
  }
  
  async listModels(): Promise<OllamaModel[]> {
    this.ensureInitialized()
    
    const response = await this.makeRequest<OllamaModelsResponse>('/api/tags')
    return response.models
  }
  
  getAvailableModels(): string[] {
    return this.availableModels
  }
  
  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await this.makeRequest<OllamaModelsResponse>('/api/tags')
      this.availableModels = response.models.map(model => model.name)
      
      // Update the models array
      ;(this as any).models = this.availableModels
    } catch (error) {
      console.warn('Failed to fetch Ollama models:', error)
      // Set some common default models if we can't fetch them
      this.availableModels = ['llama2', 'codellama', 'mistral', 'neural-chat']
      ;(this as any).models = this.availableModels
    }
  }
  
  private getDefaultModel(): string {
    if (this.availableModels.length > 0) {
      return this.availableModels[0]
    }
    return this.defaultModel
  }
  
  private async makeRequest<T>(endpoint: string, body?: any): Promise<T> {
    try {
      const url = `${this.baseURL}${endpoint}`
      
      if (body) {
        return await ofetch<T>(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body
        })
      } else {
        return await ofetch<T>(url)
      }
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }
  
  private convertChatResponse(response: OllamaChatResponse): ChatResponse {
    return {
      message: {
        id: generateId(),
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date(),
        metadata: {
          tokens: response.eval_count,
          model: response.model,
          provider: this.id
        }
      },
      usage: this.convertUsage(response),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertCompletionResponse(response: OllamaGenerateResponse): CompletionResponse {
    return {
      text: response.response,
      usage: this.convertUsage(response),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertUsage(response: OllamaChatResponse | OllamaGenerateResponse): TokenUsage {
    return {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
    }
  }
  
  private estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4)
  }
  
  private handleError(error: any): Error {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error('Ollama server is not running. Please start Ollama and try again.')
    }
    
    if (error.status === 404) {
      return new Error('Ollama model not found. You may need to pull the model first.')
    }
    
    if (error.status === 400) {
      return new Error(`Ollama API error: ${error.data?.error || 'Bad request'}`)
    }
    
    if (error.status >= 500) {
      return new Error('Ollama server error')
    }
    
    return new Error(`Ollama error: ${error.message || 'Unknown error'}`)
  }
}