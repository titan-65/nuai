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

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicChatResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: string
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

interface AnthropicCompletionResponse {
  completion: string
  stop_reason: string
  model: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class AnthropicProvider extends BaseAIProvider {
  readonly id = 'anthropic'
  readonly name = 'Anthropic'
  readonly models = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ]
  readonly defaultModel = 'claude-3-sonnet-20240229'
  
  private apiKey = ''
  private baseURL = 'https://api.anthropic.com/v1'
  private version = '2023-06-01'
  
  async initialize(config: ProviderConfig): Promise<void> {
    this.validateConfig(config)
    
    this.apiKey = config.apiKey!
    this.baseURL = config.baseURL || this.baseURL
    this.version = config.options?.version || this.version
    this.config = config
    this.initialized = true
  }
  
  readonly chat = {
    create: async (options: ChatOptions): Promise<ChatResponse> => {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      const systemPrompt = options.systemPrompt || this.extractSystemMessage(options.messages)
      
      const response = await this.makeRequest<AnthropicChatResponse>('/messages', {
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature,
        system: systemPrompt,
        messages,
        stream: false
      })
      
      return this.convertChatResponse(response)
    },
    
    stream: async function* (options: ChatOptions): AsyncIterator<ChatChunk> {
      this.ensureInitialized()
      
      const messages = this.convertMessages(options.messages)
      const systemPrompt = options.systemPrompt || this.extractSystemMessage(options.messages)
      
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': this.version,
          'anthropic-beta': 'messages-2023-12-15'
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature,
          system: systemPrompt,
          messages,
          stream: true
        })
      })
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
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
            if (trimmed === '' || !trimmed.startsWith('data: ')) continue
            
            try {
              const data = JSON.parse(trimmed.slice(6))
              
              if (data.type === 'content_block_delta' && data.delta?.text) {
                yield {
                  content: data.delta.text,
                  delta: data.delta.text,
                  finished: false
                }
              }
              
              if (data.type === 'message_stop') {
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
      } finally {
        reader.releaseLock()
      }
    }.bind(this)
  }
  
  readonly completion = {
    create: async (options: CompletionOptions): Promise<CompletionResponse> => {
      this.ensureInitialized()
      
      // Anthropic uses a different endpoint for legacy completions
      const response = await this.makeRequest<AnthropicCompletionResponse>('/complete', {
        model: options.model || 'claude-2.1',
        prompt: `\n\nHuman: ${options.prompt}\n\nAssistant:`,
        max_tokens_to_sample: options.maxTokens || 1000,
        temperature: options.temperature,
        stream: false
      })
      
      return this.convertCompletionResponse(response)
    },
    
    stream: async function* (options: CompletionOptions): AsyncIterator<CompletionChunk> {
      this.ensureInitialized()
      
      const response = await fetch(`${this.baseURL}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': this.version
        },
        body: JSON.stringify({
          model: options.model || 'claude-2.1',
          prompt: `\n\nHuman: ${options.prompt}\n\nAssistant:`,
          max_tokens_to_sample: options.maxTokens || 1000,
          temperature: options.temperature,
          stream: true
        })
      })
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
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
            if (trimmed === '' || !trimmed.startsWith('data: ')) continue
            
            try {
              const data = JSON.parse(trimmed.slice(6))
              
              if (data.completion) {
                yield {
                  text: data.completion,
                  delta: data.completion,
                  finished: false
                }
              }
              
              if (data.stop_reason) {
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
      } finally {
        reader.releaseLock()
      }
    }.bind(this)
  }
  
  readonly embedding = {
    create: async (options: EmbeddingOptions): Promise<EmbeddingResponse> => {
      // Anthropic doesn't provide embedding models, so we'll throw an error
      throw new Error('Anthropic provider does not support embeddings. Use OpenAI or another provider for embeddings.')
    }
  }
  
  private async makeRequest<T>(endpoint: string, body: any): Promise<T> {
    try {
      return await ofetch<T>(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': this.version,
          ...(endpoint === '/messages' && { 'anthropic-beta': 'messages-2023-12-15' })
        },
        body
      })
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  private convertMessages(messages: Message[]): AnthropicMessage[] {
    return messages
      .filter(msg => msg.role !== 'system') // System messages are handled separately
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
  }
  
  private extractSystemMessage(messages: Message[]): string | undefined {
    const systemMessage = messages.find(msg => msg.role === 'system')
    return systemMessage?.content
  }
  
  private convertChatResponse(response: AnthropicChatResponse): ChatResponse {
    const content = response.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('No text content in Anthropic response')
    }
    
    return {
      message: {
        id: generateId(),
        role: 'assistant',
        content: content.text,
        timestamp: new Date(),
        metadata: {
          tokens: response.usage.output_tokens,
          model: response.model,
          provider: this.id
        }
      },
      usage: this.convertUsage(response.usage),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertCompletionResponse(response: AnthropicCompletionResponse): CompletionResponse {
    return {
      text: response.completion,
      usage: this.convertUsage(response.usage),
      model: response.model,
      provider: this.id
    }
  }
  
  private convertUsage(usage: { input_tokens: number; output_tokens: number }): TokenUsage {
    return {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens
    }
  }
  
  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('Invalid Anthropic API key')
    }
    
    if (error.status === 429) {
      return new Error('Anthropic rate limit exceeded')
    }
    
    if (error.status === 400) {
      return new Error(`Anthropic API error: ${error.data?.error?.message || 'Bad request'}`)
    }
    
    if (error.status === 403) {
      return new Error('Anthropic API access forbidden. Check your API key permissions.')
    }
    
    if (error.status >= 500) {
      return new Error('Anthropic service unavailable')
    }
    
    return new Error(`Anthropic API error: ${error.message || 'Unknown error'}`)
  }
}