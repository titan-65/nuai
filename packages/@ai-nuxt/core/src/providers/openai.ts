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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAICompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    text: string
    index: number
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class OpenAIProvider extends BaseAIProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  readonly models = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'text-embedding-ada-002',
    'text-embedding-3-small',
    'text-embedding-3-large'
  ]
  readonly defaultModel = 'gpt-3.5-turbo'
  
  private apiKey = ''
  private baseURL = 'https://api.openai.com/v1'
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.validateConfig(config)
    
    this.apiKey = config.apiKey!
    this.baseURL = config.baseURL || this.baseURL
    this.config = config
    this.initialized = true
  }
  
  readonly chat = {
    create: async (options: ChatOptions): Promise<ChatResponse> => {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt })
      }
      
      const response = await this.makeRequest<OpenAIChatResponse>('/chat/completions', {
        model: options.model || this.defaultModel,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false
      })
      
      return this.convertChatResponse(response)
    },
    
    stream: async function* (options: ChatOptions): AsyncIterator<ChatChunk> {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt })
      }
      
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
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
            if (trimmed === '' || trimmed === 'data: [DONE]') continue
            
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                const delta = data.choices?.[0]?.delta?.content || ''
                
                if (delta) {
                  yield {
                    content: delta,
                    delta,
                    finished: false
                  }
                }
                
                if (data.choices?.[0]?.finish_reason) {
                  yield {
                    content: '',
                    delta: '',
                    finished: true
                  }
                }
              } catch (error) {
                console.warn('Failed to parse streaming chunk:', error)
              }
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
      
      const response = await this.makeRequest<OpenAICompletionResponse>('/completions', {
        model: options.model || 'gpt-3.5-turbo-instruct',
        prompt: options.prompt,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: false
      })
      
      return this.convertCompletionResponse(response)
    },
    
    stream: async function* (options: CompletionOptions): AsyncIterator<CompletionChunk> {
      this.ensureInitialized()
      
      const response = await fetch(`${this.baseURL}/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'gpt-3.5-turbo-instruct',
          prompt: options.prompt,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: true
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
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
            if (trimmed === '' || trimmed === 'data: [DONE]') continue
            
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                const delta = data.choices?.[0]?.text || ''
                
                if (delta) {
                  yield {
                    text: delta,
                    delta,
                    finished: false
                  }
                }
                
                if (data.choices?.[0]?.finish_reason) {
                  yield {
                    text: '',
                    delta: '',
                    finished: true
                  }
                }
              } catch (error) {
                console.warn('Failed to parse streaming chunk:', error)
              }
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
      
      const input = Array.isArray(options.input) ? options.input : [options.input]
      
      const response = await this.makeRequest<OpenAIEmbeddingResponse>('/embeddings', {
        model: options.model || 'text-embedding-ada-002',
        input
      })
      
      return this.convertEmbeddingResponse(response)
    }
  }
  
  private async makeRequest<T>(endpoint: string, body: any): Promise<T> {
    try {
      return await ofetch<T>(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  private convertMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }
  
  private convertChatResponse(response: OpenAIChatResponse): ChatResponse {
    const choice = response.choices[0]
    if (!choice) {
      throw new Error('No choices in OpenAI response')
    }
    
    return {
      message: {
        id: generateId(),
        role: 'assistant',
        content: choice.message.content,
        timestamp: new Date(),
        metadata: {
          tokens: response.usage.completion_tokens,
          model: response.model,
          provider: this.id
        }
      },
      usage: this.convertUsage(response.usage),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertCompletionResponse(response: OpenAICompletionResponse): CompletionResponse {
    const choice = response.choices[0]
    if (!choice) {
      throw new Error('No choices in OpenAI response')
    }
    
    return {
      text: choice.text,
      usage: this.convertUsage(response.usage),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertEmbeddingResponse(response: OpenAIEmbeddingResponse): EmbeddingResponse {
    return {
      embeddings: response.data.map(item => item.embedding),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: response.usage.total_tokens
      },
      model: response.model,
      provider: this.id
    }
  }
  
  private convertUsage(usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }): TokenUsage {
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens
    }
  }
  
  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('Invalid OpenAI API key')
    }
    
    if (error.status === 429) {
      return new Error('OpenAI rate limit exceeded')
    }
    
    if (error.status === 400) {
      return new Error(`OpenAI API error: ${error.data?.error?.message || 'Bad request'}`)
    }
    
    if (error.status >= 500) {
      return new Error('OpenAI service unavailable')
    }
    
    return new Error(`OpenAI API error: ${error.message || 'Unknown error'}`)
  }
}