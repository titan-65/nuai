# AI Nuxt Framework - Design Document

## Overview

AI Nuxt is a comprehensive AI framework built on top of Nuxt.js that provides unified AI capabilities to Vue.js developers. The framework follows a modular monorepo architecture with multiple packages, each serving specific functionality while maintaining a cohesive developer experience.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[Vue Components] --> B[Composables]
        B --> C[AI Store/Pinia]
    end
    
    subgraph "Nuxt Module Layer"
        D[@ai-nuxt/module] --> E[Auto-imports]
        D --> F[Server API Routes]
        D --> G[DevTools Integration]
    end
    
    subgraph "Core Layer"
        H[@ai-nuxt/core] --> I[Provider Abstraction]
        I --> J[OpenAI Provider]
        I --> K[Anthropic Provider]
        I --> L[Ollama Provider]
        H --> M[Caching System]
        H --> N[Vector Store]
        H --> O[Agent System]
    end
    
    subgraph "External Services"
        P[OpenAI API]
        Q[Anthropic API]
        R[Ollama Local]
        S[Vector Databases]
    end
    
    A --> D
    F --> H
    J --> P
    K --> Q
    L --> R
    N --> S
```

### Package Structure

The framework follows a monorepo structure using pnpm workspaces:

```
packages/
├── @ai-nuxt/core         # Core runtime and utilities
├── @ai-nuxt/module       # Main Nuxt module
├── @ai-nuxt/ui           # Vue components
├── @ai-nuxt/devtools     # DevTools extension
└── @ai-nuxt/cli          # CLI tools
```

## Components and Interfaces

### Core Provider Interface

The provider system uses a unified interface that abstracts different AI services:

```typescript
export interface AIProvider {
  id: string
  name: string
  initialize(config: ProviderConfig): Promise<void>
  chat: ChatInterface
  completion: CompletionInterface
  embedding: EmbeddingInterface
  vision?: VisionInterface
  audio?: AudioInterface
}

export interface ChatInterface {
  create(options: ChatOptions): Promise<ChatResponse>
  stream(options: ChatOptions): AsyncIterator<ChatChunk>
}

export interface CompletionInterface {
  create(options: CompletionOptions): Promise<CompletionResponse>
  stream(options: CompletionOptions): AsyncIterator<CompletionChunk>
}

export interface EmbeddingInterface {
  create(options: EmbeddingOptions): Promise<EmbeddingResponse>
}
```

### Nuxt Module Configuration

The main module provides configuration options and integrates with Nuxt's lifecycle:

```typescript
export interface ModuleOptions {
  providers: ProviderConfig[]
  defaultProvider: string
  streaming: {
    enabled: boolean
    transport: 'sse' | 'websocket'
  }
  caching: {
    enabled: boolean
    semantic: boolean
    ttl: number
    maxSize: number
  }
  vectorStore: {
    provider: 'memory' | 'pinecone' | 'weaviate'
    config: Record<string, any>
  }
  security: {
    promptInjectionDetection: boolean
    piiScrubbing: boolean
    contentFiltering: boolean
  }
}
```

### Composables Architecture

The framework provides reactive composables that integrate with Vue's composition API:

```typescript
// Core AI composable
export function useAI(provider?: string) {
  const config = useRuntimeConfig()
  const client = getAIClient(provider || config.aiNuxt.defaultProvider)
  
  return {
    chat: useAIChat(client),
    completion: useAICompletion(client),
    embedding: useAIEmbedding(client),
    vision: useAIVision(client),
    agents: useAIAgents(client)
  }
}

// Chat-specific composable
export function useAIChat(options?: ChatOptions) {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const usage = ref<TokenUsage | null>(null)
  
  const send = async (content: string) => {
    isLoading.value = true
    error.value = null
    
    try {
      const userMessage = { role: 'user', content }
      messages.value.push(userMessage)
      
      const response = await client.chat.create({
        messages: messages.value,
        ...options
      })
      
      messages.value.push(response.message)
      usage.value = response.usage
    } catch (err) {
      error.value = err as Error
    } finally {
      isLoading.value = false
    }
  }
  
  const stream = async (content: string) => {
    // Streaming implementation
  }
  
  return { messages, isLoading, error, usage, send, stream }
}
```

### Component Library Design

Vue components provide ready-to-use UI elements:

```vue
<!-- AIChat.vue -->
<template>
  <div class="ai-chat" :class="{ 'ai-chat--loading': isLoading }">
    <AIMessageList 
      :messages="messages" 
      :loading="isLoading"
      @retry="retryMessage"
    />
    <AIInput 
      v-model="input" 
      @submit="sendMessage"
      :disabled="isLoading"
      :placeholder="placeholder"
    />
    <AIDebugPanel 
      v-if="debug" 
      :usage="usage" 
      :error="error"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  debug?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  temperature: 0.7,
  maxTokens: 2000,
  placeholder: 'Type your message...'
})

const { messages, isLoading, error, usage, send } = useAIChat({
  provider: props.provider,
  systemPrompt: props.systemPrompt,
  temperature: props.temperature,
  maxTokens: props.maxTokens
})

const input = ref('')

const sendMessage = async () => {
  if (!input.value.trim()) return
  
  await send(input.value)
  input.value = ''
}

const retryMessage = async (messageIndex: number) => {
  // Retry logic
}
</script>
```

## Data Models

### Message and Conversation Models

```typescript
export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    tokens?: number
    model?: string
    provider?: string
    cost?: number
  }
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  settings: ConversationSettings
  createdAt: Date
  updatedAt: Date
}

export interface ConversationSettings {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
}
```

### Agent System Models

```typescript
export interface AIAgent {
  id: string
  name: string
  role: string
  description: string
  capabilities: string[]
  systemPrompt: string
  tools: AITool[]
  config: AgentConfig
}

export interface AITool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any) => Promise<any>
}

export interface AgentConfig {
  temperature: number
  maxTokens: number
  maxIterations: number
  timeoutMs: number
}
```

### Vector Store Models

```typescript
export interface Document {
  id: string
  content: string
  metadata: Record<string, any>
  embedding?: number[]
}

export interface VectorSearchResult {
  document: Document
  score: number
  distance: number
}

export interface VectorStoreConfig {
  provider: 'memory' | 'pinecone' | 'weaviate'
  dimensions: number
  metric: 'cosine' | 'euclidean' | 'dot'
  config: Record<string, any>
}
```

## Caching System Design

### Multi-Layer Caching Architecture

```typescript
export class CacheManager {
  private memoryCache: LRUCache<string, CachedResponse>
  private semanticCache: SemanticCache
  private persistentCache?: PersistentCache
  
  constructor(options: CacheOptions) {
    this.memoryCache = new LRUCache({
      max: options.maxSize,
      ttl: options.ttl
    })
    
    this.semanticCache = new SemanticCache({
      threshold: options.semanticThreshold,
      embeddingProvider: options.embeddingProvider
    })
    
    if (options.persistent) {
      this.persistentCache = new PersistentCache(options.persistentConfig)
    }
  }
  
  async get(key: string, prompt?: string): Promise<CachedResponse | null> {
    // 1. Check memory cache first
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult) return memoryResult
    
    // 2. Check semantic cache if prompt provided
    if (prompt) {
      const semanticResult = await this.semanticCache.get(prompt)
      if (semanticResult) {
        // Promote to memory cache
        this.memoryCache.set(key, semanticResult)
        return semanticResult
      }
    }
    
    // 3. Check persistent cache
    if (this.persistentCache) {
      const persistentResult = await this.persistentCache.get(key)
      if (persistentResult) {
        // Promote to memory cache
        this.memoryCache.set(key, persistentResult)
        return persistentResult
      }
    }
    
    return null
  }
  
  async set(key: string, response: any, prompt?: string): Promise<void> {
    const cached: CachedResponse = {
      response,
      timestamp: Date.now(),
      metadata: {
        provider: response.provider,
        model: response.model,
        tokens: response.usage?.totalTokens
      }
    }
    
    // Store in all cache layers
    this.memoryCache.set(key, cached)
    
    if (prompt) {
      await this.semanticCache.set(prompt, cached)
    }
    
    if (this.persistentCache) {
      await this.persistentCache.set(key, cached)
    }
  }
}
```

## Streaming Implementation

### Server-Sent Events (SSE) Design

```typescript
// Server API route for streaming
export default defineEventHandler(async (event) => {
  const { messages, provider, options } = await readBody(event)
  
  if (options.stream) {
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    
    const ai = useAI(provider)
    const stream = await ai.chat.stream({ messages, ...options })
    
    return sendStream(event, async function* () {
      for await (const chunk of stream) {
        yield `data: ${JSON.stringify(chunk)}\n\n`
      }
      yield 'data: [DONE]\n\n'
    }())
  }
  
  const ai = useAI(provider)
  return ai.chat.create({ messages, ...options })
})
```

### WebSocket Implementation

```typescript
export function useAISocket(options: SocketOptions = {}) {
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const messages = ref<Message[]>([])
  const error = ref<Error | null>(null)
  
  const connect = () => {
    socket.value = new WebSocket(options.url || '/api/ai/socket')
    
    socket.value.onopen = () => {
      isConnected.value = true
      error.value = null
    }
    
    socket.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'message') {
        messages.value.push(data.message)
      }
    }
    
    socket.value.onerror = (err) => {
      error.value = new Error('WebSocket error')
    }
    
    socket.value.onclose = () => {
      isConnected.value = false
      // Implement reconnection logic
      setTimeout(connect, 1000)
    }
  }
  
  const send = (message: any) => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(message))
    }
  }
  
  onMounted(connect)
  onUnmounted(() => socket.value?.close())
  
  return { isConnected, messages, error, send }
}
```

## Error Handling

### Unified Error System

```typescript
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'AIError'
  }
}

export const ErrorCodes = {
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  API_KEY_MISSING: 'API_KEY_MISSING',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED'
} as const

export function handleAIError(error: unknown, provider: string): AIError {
  if (error instanceof AIError) return error
  
  if (error instanceof Error) {
    // Map provider-specific errors to unified error codes
    if (error.message.includes('rate limit')) {
      return new AIError(
        'Rate limit exceeded. Please try again later.',
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        provider,
        error
      )
    }
    
    if (error.message.includes('API key')) {
      return new AIError(
        'Invalid or missing API key.',
        ErrorCodes.API_KEY_MISSING,
        provider,
        error
      )
    }
  }
  
  return new AIError(
    'An unexpected error occurred.',
    'UNKNOWN_ERROR',
    provider,
    error as Error
  )
}
```

## Testing Strategy

### Unit Testing Approach

```typescript
// Mock AI provider for testing
export function createMockAIProvider(): AIProvider {
  return {
    id: 'mock',
    name: 'Mock Provider',
    initialize: vi.fn().mockResolvedValue(undefined),
    chat: {
      create: vi.fn().mockResolvedValue({
        message: { role: 'assistant', content: 'Mock response' },
        usage: { totalTokens: 100 }
      }),
      stream: vi.fn().mockImplementation(async function* () {
        yield { content: 'Mock', delta: 'Mock' }
        yield { content: ' response', delta: ' response' }
      })
    },
    completion: {
      create: vi.fn().mockResolvedValue({
        text: 'Mock completion',
        usage: { totalTokens: 50 }
      }),
      stream: vi.fn()
    },
    embedding: {
      create: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        usage: { totalTokens: 10 }
      })
    }
  }
}

// Test utilities
export function createTestWrapper(options: TestWrapperOptions = {}) {
  const mockProvider = createMockAIProvider()
  
  return {
    wrapper: ({ children }: { children: any }) => (
      <NuxtTestProvider 
        aiProvider={mockProvider}
        {...options}
      >
        {children}
      </NuxtTestProvider>
    ),
    mockProvider
  }
}
```

### Integration Testing

```typescript
// Test real provider integration
describe('Provider Integration', () => {
  test('OpenAI provider chat completion', async () => {
    const provider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    await provider.initialize()
    
    const response = await provider.chat.create({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-3.5-turbo'
    })
    
    expect(response.message.content).toBeTruthy()
    expect(response.usage.totalTokens).toBeGreaterThan(0)
  })
})
```

## Security Considerations

### Prompt Injection Detection

```typescript
export class PromptInjectionDetector {
  private patterns: RegExp[]
  
  constructor() {
    this.patterns = [
      /ignore\s+previous\s+instructions/i,
      /forget\s+everything/i,
      /system\s*:\s*you\s+are/i,
      /\[INST\]/i,
      /<\|im_start\|>/i
    ]
  }
  
  detect(prompt: string): boolean {
    return this.patterns.some(pattern => pattern.test(prompt))
  }
  
  sanitize(prompt: string): string {
    // Remove or escape potentially dangerous patterns
    let sanitized = prompt
    
    // Remove system-like instructions
    sanitized = sanitized.replace(/system\s*:\s*/gi, 'user: ')
    
    // Escape special tokens
    sanitized = sanitized.replace(/\[INST\]/gi, '[USER]')
    
    return sanitized
  }
}
```

### PII Scrubbing

```typescript
export class PIIScrubber {
  private patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
  }
  
  scrub(text: string): string {
    let scrubbed = text
    
    scrubbed = scrubbed.replace(this.patterns.email, '[EMAIL]')
    scrubbed = scrubbed.replace(this.patterns.phone, '[PHONE]')
    scrubbed = scrubbed.replace(this.patterns.ssn, '[SSN]')
    scrubbed = scrubbed.replace(this.patterns.creditCard, '[CREDIT_CARD]')
    
    return scrubbed
  }
}
```

## Performance Optimizations

### Bundle Size Optimization

- Tree-shaking support for unused providers
- Dynamic imports for heavy components
- Separate chunks for different AI capabilities
- Minimal core bundle (<50KB gzipped)

### Runtime Performance

- Request deduplication for identical prompts
- Connection pooling for HTTP requests
- WebGPU acceleration for local processing
- Lazy loading of AI models

### Edge Deployment Support

```typescript
// Nitro preset for edge deployment
export default defineNitroPreset({
  extends: 'cloudflare-pages',
  hooks: {
    'compiled'(nitro) {
      // Configure AI services for edge runtime
      nitro.options.runtimeConfig.aiNuxt = {
        ...nitro.options.runtimeConfig.aiNuxt,
        edge: true,
        providers: filterEdgeCompatibleProviders(
          nitro.options.runtimeConfig.aiNuxt.providers
        )
      }
    }
  },
  rollupConfig: {
    external: ['node:fs', 'node:path'],
    output: {
      format: 'esm'
    }
  }
})
```

This design provides a comprehensive foundation for building the AI Nuxt framework with scalable architecture, robust error handling, and excellent developer experience.