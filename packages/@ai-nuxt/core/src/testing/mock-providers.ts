import type { AIProvider, ChatMessage, ChatResponse, CompletionResponse, EmbeddingResponse } from '../providers/base'

/**
 * Mock provider configuration
 */
export interface MockProviderConfig {
  /** Provider name */
  name: string
  /** Default responses */
  responses?: {
    chat?: Partial<ChatResponse>
    completion?: Partial<CompletionResponse>
    embedding?: Partial<EmbeddingResponse>
  }
  /** Simulated delays in milliseconds */
  delays?: {
    chat?: number
    completion?: number
    embedding?: number
  }
  /** Error simulation */
  errors?: {
    chat?: Error | string
    completion?: Error | string
    embedding?: Error | string
  }
  /** Response patterns for dynamic responses */
  patterns?: {
    chat?: (messages: ChatMessage[]) => Partial<ChatResponse>
    completion?: (prompt: string) => Partial<CompletionResponse>
    embedding?: (input: string | string[]) => Partial<EmbeddingResponse>
  }
  /** Usage tracking */
  trackUsage?: boolean
}

/**
 * Mock provider usage statistics
 */
export interface MockProviderUsage {
  chatCalls: number
  completionCalls: number
  embeddingCalls: number
  totalTokens: number
  errors: number
  lastCall?: number
}

/**
 * Mock AI provider for testing
 */
export class MockAIProvider implements AIProvider {
  public readonly name: string
  private config: MockProviderConfig
  private usage: MockProviderUsage

  constructor(config: MockProviderConfig) {
    this.name = config.name
    this.config = config
    this.usage = {
      chatCalls: 0,
      completionCalls: 0,
      embeddingCalls: 0,
      totalTokens: 0,
      errors: 0
    }
  }

  async chat(options: {
    messages: ChatMessage[]
    model?: string
    temperature?: number
    maxTokens?: number
    stream?: boolean
    tools?: any[]
  }): Promise<ChatResponse> {
    this.usage.chatCalls++
    this.usage.lastCall = Date.now()

    // Simulate delay
    if (this.config.delays?.chat) {
      await this.delay(this.config.delays.chat)
    }

    // Simulate error
    if (this.config.errors?.chat) {
      this.usage.errors++
      const error = this.config.errors.chat
      throw typeof error === 'string' ? new Error(error) : error
    }

    // Generate response
    let response: ChatResponse

    if (this.config.patterns?.chat) {
      const patternResponse = this.config.patterns.chat(options.messages)
      response = this.buildChatResponse(patternResponse, options)
    } else if (this.config.responses?.chat) {
      response = this.buildChatResponse(this.config.responses.chat, options)
    } else {
      response = this.buildDefaultChatResponse(options)
    }

    // Track token usage
    if (response.usage) {
      this.usage.totalTokens += response.usage.totalTokens
    }

    return response
  }

  async completion(options: {
    prompt: string
    model?: string
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }): Promise<CompletionResponse> {
    this.usage.completionCalls++
    this.usage.lastCall = Date.now()

    // Simulate delay
    if (this.config.delays?.completion) {
      await this.delay(this.config.delays.completion)
    }

    // Simulate error
    if (this.config.errors?.completion) {
      this.usage.errors++
      const error = this.config.errors.completion
      throw typeof error === 'string' ? new Error(error) : error
    }

    // Generate response
    let response: CompletionResponse

    if (this.config.patterns?.completion) {
      const patternResponse = this.config.patterns.completion(options.prompt)
      response = this.buildCompletionResponse(patternResponse, options)
    } else if (this.config.responses?.completion) {
      response = this.buildCompletionResponse(this.config.responses.completion, options)
    } else {
      response = this.buildDefaultCompletionResponse(options)
    }

    // Track token usage
    if (response.usage) {
      this.usage.totalTokens += response.usage.totalTokens
    }

    return response
  }

  async embedding(options: {
    input: string | string[]
    model?: string
  }): Promise<EmbeddingResponse> {
    this.usage.embeddingCalls++
    this.usage.lastCall = Date.now()

    // Simulate delay
    if (this.config.delays?.embedding) {
      await this.delay(this.config.delays.embedding)
    }

    // Simulate error
    if (this.config.errors?.embedding) {
      this.usage.errors++
      const error = this.config.errors.embedding
      throw typeof error === 'string' ? new Error(error) : error
    }

    // Generate response
    let response: EmbeddingResponse

    if (this.config.patterns?.embedding) {
      const patternResponse = this.config.patterns.embedding(options.input)
      response = this.buildEmbeddingResponse(patternResponse, options)
    } else if (this.config.responses?.embedding) {
      response = this.buildEmbeddingResponse(this.config.responses.embedding, options)
    } else {
      response = this.buildDefaultEmbeddingResponse(options)
    }

    // Track token usage
    if (response.usage) {
      this.usage.totalTokens += response.usage.totalTokens
    }

    return response
  }

  async stream(options: any): Promise<AsyncIterable<any>> {
    // Simple mock stream implementation
    const response = await this.chat(options)
    
    async function* mockStream() {
      const words = response.text.split(' ')
      for (const word of words) {
        yield { delta: { content: word + ' ' } }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    return mockStream()
  }

  /**
   * Get usage statistics
   */
  getUsage(): MockProviderUsage {
    return { ...this.usage }
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.usage = {
      chatCalls: 0,
      completionCalls: 0,
      embeddingCalls: 0,
      totalTokens: 0,
      errors: 0
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private buildChatResponse(partial: Partial<ChatResponse>, options: any): ChatResponse {
    return {
      text: partial.text || this.generateMockText(options.messages),
      model: partial.model || options.model || 'mock-model',
      usage: partial.usage || {
        promptTokens: this.estimateTokens(JSON.stringify(options.messages)),
        completionTokens: this.estimateTokens(partial.text || 'Mock response'),
        totalTokens: 0
      },
      finishReason: partial.finishReason || 'stop',
      ...partial
    }
  }

  private buildCompletionResponse(partial: Partial<CompletionResponse>, options: any): CompletionResponse {
    return {
      text: partial.text || this.generateMockCompletion(options.prompt),
      model: partial.model || options.model || 'mock-model',
      usage: partial.usage || {
        promptTokens: this.estimateTokens(options.prompt),
        completionTokens: this.estimateTokens(partial.text || 'Mock completion'),
        totalTokens: 0
      },
      finishReason: partial.finishReason || 'stop',
      ...partial
    }
  }

  private buildEmbeddingResponse(partial: Partial<EmbeddingResponse>, options: any): EmbeddingResponse {
    const input = Array.isArray(options.input) ? options.input : [options.input]
    
    return {
      embedding: partial.embedding || this.generateMockEmbedding(),
      model: partial.model || options.model || 'mock-embedding-model',
      usage: partial.usage || {
        promptTokens: input.reduce((sum, text) => sum + this.estimateTokens(text), 0),
        totalTokens: 0
      },
      ...partial
    }
  }

  private buildDefaultChatResponse(options: any): ChatResponse {
    const lastMessage = options.messages[options.messages.length - 1]
    return {
      text: `Mock response to: ${lastMessage?.content || 'unknown'}`,
      model: options.model || 'mock-model',
      usage: {
        promptTokens: this.estimateTokens(JSON.stringify(options.messages)),
        completionTokens: 20,
        totalTokens: 0
      },
      finishReason: 'stop'
    }
  }

  private buildDefaultCompletionResponse(options: any): CompletionResponse {
    return {
      text: `Mock completion for: ${options.prompt.substring(0, 50)}...`,
      model: options.model || 'mock-model',
      usage: {
        promptTokens: this.estimateTokens(options.prompt),
        completionTokens: 25,
        totalTokens: 0
      },
      finishReason: 'stop'
    }
  }

  private buildDefaultEmbeddingResponse(options: any): EmbeddingResponse {
    return {
      embedding: this.generateMockEmbedding(),
      model: options.model || 'mock-embedding-model',
      usage: {
        promptTokens: this.estimateTokens(Array.isArray(options.input) ? options.input.join(' ') : options.input),
        totalTokens: 0
      }
    }
  }

  private generateMockText(messages: ChatMessage[]): string {
    const responses = [
      'This is a mock response from the AI provider.',
      'I understand your request and here is my mock response.',
      'Thank you for your question. This is a simulated answer.',
      'Based on your input, here is a mock AI response.',
      'This is a test response generated by the mock provider.'
    ]
    
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.content.toLowerCase().includes('hello')) {
      return 'Hello! This is a mock greeting response.'
    }
    
    return responses[Math.floor(Math.random() * responses.length)]
  }

  private generateMockCompletion(prompt: string): string {
    if (prompt.toLowerCase().includes('write')) {
      return 'This is a mock written response based on your prompt.'
    }
    if (prompt.toLowerCase().includes('explain')) {
      return 'This is a mock explanation generated for testing purposes.'
    }
    return `Mock completion: ${prompt.substring(0, 30)}... [continued]`
  }

  private generateMockEmbedding(): number[] {
    // Generate a mock 1536-dimensional embedding (OpenAI standard)
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
  }

  private estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Pre-configured mock providers
 */
export const mockProviders = {
  /**
   * Fast mock provider with minimal delays
   */
  fast: new MockAIProvider({
    name: 'mock-fast',
    delays: { chat: 10, completion: 10, embedding: 5 }
  }),

  /**
   * Slow mock provider for testing timeouts
   */
  slow: new MockAIProvider({
    name: 'mock-slow',
    delays: { chat: 2000, completion: 2000, embedding: 1000 }
  }),

  /**
   * Error-prone mock provider for testing error handling
   */
  unreliable: new MockAIProvider({
    name: 'mock-unreliable',
    errors: {
      chat: 'Random chat error',
      completion: new Error('Completion failed'),
      embedding: 'Embedding service unavailable'
    }
  }),

  /**
   * Pattern-based mock provider with intelligent responses
   */
  smart: new MockAIProvider({
    name: 'mock-smart',
    patterns: {
      chat: (messages) => {
        const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || ''
        
        if (lastMessage.includes('weather')) {
          return { text: 'The weather is sunny with a temperature of 72°F.' }
        }
        if (lastMessage.includes('time')) {
          return { text: `The current time is ${new Date().toLocaleTimeString()}.` }
        }
        if (lastMessage.includes('joke')) {
          return { text: 'Why did the AI cross the road? To get to the other dataset!' }
        }
        
        return { text: 'I understand your question and here is my thoughtful response.' }
      },
      completion: (prompt) => {
        if (prompt.toLowerCase().includes('story')) {
          return { text: 'Once upon a time, in a digital realm far away, there lived an AI who loved to help developers test their applications...' }
        }
        if (prompt.toLowerCase().includes('code')) {
          return { text: 'function mockFunction() {\n  return "This is mock code generated for testing";\n}' }
        }
        
        return { text: `Here is a mock completion for your prompt: "${prompt.substring(0, 50)}..."` }
      }
    }
  }),

  /**
   * High-usage mock provider for performance testing
   */
  heavy: new MockAIProvider({
    name: 'mock-heavy',
    responses: {
      chat: {
        text: 'This is a very long mock response that simulates a detailed AI response with lots of content. '.repeat(20),
        usage: { promptTokens: 100, completionTokens: 500, totalTokens: 600 }
      },
      completion: {
        text: 'Extended mock completion with substantial content. '.repeat(30),
        usage: { promptTokens: 150, completionTokens: 750, totalTokens: 900 }
      }
    }
  })
}

/**
 * Create a custom mock provider
 */
export function createMockProvider(config: MockProviderConfig): MockAIProvider {
  return new MockAIProvider(config)
}

/**
 * Mock provider factory for different scenarios
 */
export class MockProviderFactory {
  /**
   * Create a provider that always succeeds
   */
  static createSuccessProvider(name: string = 'mock-success'): MockAIProvider {
    return new MockAIProvider({
      name,
      responses: {
        chat: { text: 'Success response', finishReason: 'stop' },
        completion: { text: 'Success completion', finishReason: 'stop' },
        embedding: { embedding: Array.from({ length: 1536 }, () => 0.5) }
      }
    })
  }

  /**
   * Create a provider that always fails
   */
  static createErrorProvider(name: string = 'mock-error'): MockAIProvider {
    return new MockAIProvider({
      name,
      errors: {
        chat: 'Mock chat error',
        completion: 'Mock completion error',
        embedding: 'Mock embedding error'
      }
    })
  }

  /**
   * Create a provider with specific response patterns
   */
  static createPatternProvider(
    name: string,
    patterns: MockProviderConfig['patterns']
  ): MockAIProvider {
    return new MockAIProvider({ name, patterns })
  }

  /**
   * Create a provider with realistic delays
   */
  static createRealisticProvider(name: string = 'mock-realistic'): MockAIProvider {
    return new MockAIProvider({
      name,
      delays: {
        chat: 800 + Math.random() * 400, // 800-1200ms
        completion: 600 + Math.random() * 300, // 600-900ms
        embedding: 200 + Math.random() * 100 // 200-300ms
      },
      patterns: {
        chat: (messages) => ({
          text: `Realistic response to: ${messages[messages.length - 1]?.content}`,
          usage: {
            promptTokens: Math.floor(Math.random() * 100) + 50,
            completionTokens: Math.floor(Math.random() * 200) + 100,
            totalTokens: 0
          }
        })
      }
    })
  }
}