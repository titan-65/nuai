import { vi } from 'vitest'
import type { AIProvider } from '../providers/base'
import type { AIAgent, AgentConfig } from '../agents'
import type { AgentTool } from '../agents'
import { MockAIProvider, createMockProvider } from './mock-providers'
import { DefaultAIAgent } from '../agent-implementation'

/**
 * Test utilities for AI Nuxt components and composables
 */

/**
 * Mock composable return values
 */
export interface MockComposableOptions {
  /** Mock loading state */
  loading?: boolean
  /** Mock error state */
  error?: string | null
  /** Mock data */
  data?: any
  /** Mock methods */
  methods?: Record<string, any>
}

/**
 * Create a mock AI provider for testing
 */
export function createTestProvider(overrides?: Partial<Parameters<typeof createMockProvider>[0]>): MockAIProvider {
  return createMockProvider({
    name: 'test-provider',
    responses: {
      chat: { text: 'Test response', finishReason: 'stop' },
      completion: { text: 'Test completion', finishReason: 'stop' },
      embedding: { embedding: Array.from({ length: 1536 }, () => 0.1) }
    },
    ...overrides
  })
}

/**
 * Create a mock AI agent for testing
 */
export function createTestAgent(config?: Partial<AgentConfig>, provider?: AIProvider): DefaultAIAgent {
  const defaultConfig: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    role: 'test assistant',
    systemPrompt: 'You are a test assistant.',
    capabilities: {
      canUseTool: true,
      canCommunicate: true,
      canMakeDecisions: false,
      canLearn: false
    },
    tools: [],
    provider: {
      name: 'test',
      model: 'test-model'
    },
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...config
  }

  const testProvider = provider || createTestProvider()
  return new DefaultAIAgent(defaultConfig, testProvider)
}

/**
 * Create a mock tool for testing
 */
export function createTestTool(overrides?: Partial<AgentTool>): AgentTool {
  return {
    id: 'test-tool',
    name: 'Test Tool',
    description: 'A test tool',
    inputSchema: {
      input: { type: 'string', required: true }
    },
    execute: vi.fn().mockResolvedValue('Test tool result'),
    ...overrides
  }
}

/**
 * Mock useAI composable
 */
export function mockUseAI(options: MockComposableOptions = {}) {
  return {
    ai: {
      chat: vi.fn().mockResolvedValue({
        text: options.data?.text || 'Mock AI response',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      }),
      completion: vi.fn().mockResolvedValue({
        text: options.data?.completion || 'Mock completion',
        model: 'mock-model'
      }),
      embedding: vi.fn().mockResolvedValue({
        embedding: options.data?.embedding || Array.from({ length: 1536 }, () => 0.1),
        model: 'mock-embedding-model'
      }),
      setModel: vi.fn(),
      setProvider: vi.fn()
    },
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    ...options.methods
  }
}

/**
 * Mock useAIChat composable
 */
export function mockUseAIChat(options: MockComposableOptions = {}) {
  return {
    messages: ref(options.data?.messages || []),
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    sendMessage: vi.fn().mockImplementation(async (message: string) => {
      const messages = options.data?.messages || []
      messages.push(
        { role: 'user', content: message },
        { role: 'assistant', content: 'Mock response' }
      )
      return 'Mock response'
    }),
    clearMessages: vi.fn().mockImplementation(() => {
      if (options.data?.messages) {
        options.data.messages.length = 0
      }
    }),
    ...options.methods
  }
}

/**
 * Mock useAICompletion composable
 */
export function mockUseAICompletion(options: MockComposableOptions = {}) {
  return {
    completion: ref(options.data?.completion || ''),
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    complete: vi.fn().mockImplementation(async (prompt: string) => {
      const result = `Mock completion for: ${prompt}`
      if (options.data) {
        options.data.completion = result
      }
      return result
    }),
    ...options.methods
  }
}

/**
 * Mock useAIEmbedding composable
 */
export function mockUseAIEmbedding(options: MockComposableOptions = {}) {
  return {
    embedding: ref(options.data?.embedding || null),
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    generateEmbedding: vi.fn().mockImplementation(async (text: string) => {
      const result = Array.from({ length: 1536 }, () => Math.random())
      if (options.data) {
        options.data.embedding = result
      }
      return result
    }),
    ...options.methods
  }
}

/**
 * Mock useAIStream composable
 */
export function mockUseAIStream(options: MockComposableOptions = {}) {
  return {
    content: ref(options.data?.content || ''),
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    isStreaming: ref(false),
    startStream: vi.fn().mockImplementation(async function* () {
      const words = ['Mock', 'streaming', 'response', 'for', 'testing']
      for (const word of words) {
        yield { content: word + ' ' }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }),
    stopStream: vi.fn(),
    ...options.methods
  }
}

/**
 * Mock useAIVectorStore composable
 */
export function mockUseAIVectorStore(options: MockComposableOptions = {}) {
  return {
    documents: ref(options.data?.documents || []),
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    addDocument: vi.fn().mockResolvedValue(undefined),
    searchDocuments: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    clearDocuments: vi.fn().mockResolvedValue(undefined),
    ...options.methods
  }
}

/**
 * Mock useAIRAG composable
 */
export function mockUseAIRAG(options: MockComposableOptions = {}) {
  return {
    loading: ref(options.loading || false),
    error: ref(options.error || null),
    documentCount: ref(options.data?.documentCount || 0),
    addDocument: vi.fn().mockResolvedValue(undefined),
    enhanceChat: vi.fn().mockResolvedValue({
      messages: options.data?.messages || [],
      context: { retrievedDocuments: [] }
    }),
    clearDocuments: vi.fn().mockResolvedValue(undefined),
    initializeRAG: vi.fn().mockResolvedValue(undefined),
    ...options.methods
  }
}

/**
 * Test helper for component testing
 */
export class ComponentTestHelper {
  private mocks: Map<string, any> = new Map()

  /**
   * Mock a composable
   */
  mockComposable(name: string, implementation: any): this {
    this.mocks.set(name, implementation)
    vi.doMock(name, () => ({ default: implementation }))
    return this
  }

  /**
   * Mock useAI composable
   */
  mockUseAI(options?: MockComposableOptions): this {
    return this.mockComposable('useAI', () => mockUseAI(options))
  }

  /**
   * Mock useAIChat composable
   */
  mockUseAIChat(options?: MockComposableOptions): this {
    return this.mockComposable('useAIChat', () => mockUseAIChat(options))
  }

  /**
   * Mock multiple composables at once
   */
  mockAll(mocks: Record<string, MockComposableOptions>): this {
    Object.entries(mocks).forEach(([name, options]) => {
      switch (name) {
        case 'useAI':
          this.mockUseAI(options)
          break
        case 'useAIChat':
          this.mockUseAIChat(options)
          break
        case 'useAICompletion':
          this.mockComposable('useAICompletion', () => mockUseAICompletion(options))
          break
        case 'useAIEmbedding':
          this.mockComposable('useAIEmbedding', () => mockUseAIEmbedding(options))
          break
        case 'useAIStream':
          this.mockComposable('useAIStream', () => mockUseAIStream(options))
          break
        case 'useAIVectorStore':
          this.mockComposable('useAIVectorStore', () => mockUseAIVectorStore(options))
          break
        case 'useAIRAG':
          this.mockComposable('useAIRAG', () => mockUseAIRAG(options))
          break
      }
    })
    return this
  }

  /**
   * Clear all mocks
   */
  clearMocks(): this {
    this.mocks.clear()
    vi.clearAllMocks()
    return this
  }

  /**
   * Get a mock by name
   */
  getMock(name: string): any {
    return this.mocks.get(name)
  }
}

/**
 * Create a component test helper
 */
export function createComponentTestHelper(): ComponentTestHelper {
  return new ComponentTestHelper()
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Wait for next tick (useful for Vue reactivity)
 */
export async function waitForNextTick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Create a test timeout
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms)
  })
}

/**
 * Race a promise against a timeout
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, createTimeout(ms)])
}

/**
 * Mock fetch for HTTP requests
 */
export function mockFetch(responses: Record<string, any> = {}): void {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const response = responses[url] || { ok: true, json: () => Promise.resolve({}) }
    return Promise.resolve({
      ok: response.ok !== false,
      status: response.status || 200,
      json: () => Promise.resolve(response.data || response),
      text: () => Promise.resolve(JSON.stringify(response.data || response)),
      ...response
    })
  })
}

/**
 * Mock localStorage
 */
export function mockLocalStorage(): void {
  const store: Record<string, string> = {}
  
  global.localStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    length: 0,
    key: vi.fn()
  }
}

/**
 * Mock console methods
 */
export function mockConsole(): {
  log: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  info: ReturnType<typeof vi.fn>
} {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {})
  }
}

/**
 * Create a test environment setup
 */
export function setupTestEnvironment(): {
  helper: ComponentTestHelper
  cleanup: () => void
} {
  const helper = createComponentTestHelper()
  
  // Mock common browser APIs
  mockLocalStorage()
  mockFetch()
  
  const cleanup = () => {
    helper.clearMocks()
    vi.restoreAllMocks()
  }
  
  return { helper, cleanup }
}

// Re-export ref for convenience
export { ref } from 'vue'