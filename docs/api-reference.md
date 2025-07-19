# API Reference

Complete API reference for AI Nuxt composables, components, and utilities.

## Composables

### useAI()

Main composable for AI operations.

```typescript
const { 
  chat, 
  completion, 
  embedding, 
  provider, 
  model,
  updateProvider,
  updateModel,
  updateSettings
} = useAI(options?)
```

#### Parameters

- `options` (optional): Configuration options
  - `provider`: AI provider to use ('openai', 'anthropic', 'ollama')
  - `model`: Model to use
  - `temperature`: Temperature setting (0-2)
  - `maxTokens`: Maximum tokens to generate

#### Returns

- `chat(messages, options?)`: Chat completion function
- `completion(prompt, options?)`: Text completion function
- `embedding(input, options?)`: Generate embeddings
- `provider`: Current provider (reactive)
- `model`: Current model (reactive)
- `updateProvider(provider)`: Update provider
- `updateModel(model)`: Update model
- `updateSettings(settings)`: Update settings

#### Example

```vue
<script setup>
const { chat, provider, updateProvider } = useAI({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7
})

const response = await chat([
  { role: 'user', content: 'Hello!' }
])

// Switch provider
updateProvider('anthropic')
</script>
```

### useAIChat()

Composable for chat functionality with message management.

```typescript
const {
  messages,
  loading,
  error,
  sendMessage,
  clearMessages,
  regenerateLastMessage,
  exportConversation
} = useAIChat(options?)
```

#### Parameters

- `options` (optional): Chat configuration
  - `provider`: AI provider
  - `model`: Model to use
  - `streaming`: Enable streaming responses
  - `systemPrompt`: System prompt
  - `maxHistory`: Maximum message history

#### Returns

- `messages`: Reactive array of messages
- `loading`: Loading state
- `error`: Error state
- `sendMessage(content)`: Send a message
- `clearMessages()`: Clear all messages
- `regenerateLastMessage()`: Regenerate last AI response
- `exportConversation()`: Export conversation

#### Example

```vue
<script setup>
const { messages, loading, sendMessage } = useAIChat({
  provider: 'openai',
  model: 'gpt-4',
  streaming: true,
  systemPrompt: 'You are a helpful assistant.'
})

await sendMessage('What is the weather like?')
</script>
```

### useAICompletion()

Composable for text completion.

```typescript
const {
  completion,
  loading,
  error,
  result,
  complete
} = useAICompletion(options?)
```

#### Parameters

- `options` (optional): Completion configuration
  - `provider`: AI provider
  - `model`: Model to use
  - `temperature`: Temperature setting
  - `maxTokens`: Maximum tokens

#### Returns

- `completion`: Completion function
- `loading`: Loading state
- `error`: Error state
- `result`: Last completion result
- `complete(prompt)`: Complete text

#### Example

```vue
<script setup>
const { complete, loading, result } = useAICompletion({
  provider: 'openai',
  model: 'gpt-3.5-turbo'
})

await complete('The future of AI is')
console.log(result.value) // Completion result
</script>
```

### useAIEmbedding()

Composable for generating embeddings.

```typescript
const {
  embedding,
  loading,
  error,
  result,
  generate
} = useAIEmbedding(options?)
```

#### Parameters

- `options` (optional): Embedding configuration
  - `provider`: AI provider
  - `model`: Embedding model

#### Returns

- `embedding`: Embedding function
- `loading`: Loading state
- `error`: Error state
- `result`: Last embedding result
- `generate(input)`: Generate embeddings

#### Example

```vue
<script setup>
const { generate, result } = useAIEmbedding({
  provider: 'openai',
  model: 'text-embedding-ada-002'
})

await generate('Hello world')
console.log(result.value) // Embedding vector
</script>
```

### useAIStream()

Composable for streaming AI responses.

```typescript
const {
  stream,
  loading,
  error,
  content,
  isStreaming,
  startStream,
  stopStream
} = useAIStream(options?)
```

#### Parameters

- `options` (optional): Streaming configuration
  - `provider`: AI provider
  - `model`: Model to use
  - `transport`: Transport method ('sse', 'websocket')

#### Returns

- `stream`: Stream function
- `loading`: Loading state
- `error`: Error state
- `content`: Streamed content
- `isStreaming`: Streaming state
- `startStream(prompt)`: Start streaming
- `stopStream()`: Stop streaming

#### Example

```vue
<script setup>
const { startStream, content, isStreaming } = useAIStream({
  provider: 'openai',
  transport: 'sse'
})

await startStream('Tell me a story')

watch(content, (newContent) => {
  console.log('Streamed content:', newContent)
})
</script>
```

### useAIAgent()

Composable for AI agent operations.

```typescript
const {
  agent,
  loading,
  error,
  result,
  execute,
  createAgent,
  listAgents
} = useAIAgent(options?)
```

#### Parameters

- `options` (optional): Agent configuration
  - `name`: Agent name
  - `type`: Agent type
  - `capabilities`: Agent capabilities

#### Returns

- `agent`: Current agent
- `loading`: Loading state
- `error`: Error state
- `result`: Execution result
- `execute(input)`: Execute agent
- `createAgent(config)`: Create new agent
- `listAgents()`: List available agents

#### Example

```vue
<script setup>
const { execute, createAgent } = useAIAgent()

// Create a research agent
const researchAgent = await createAgent({
  name: 'ResearchAgent',
  type: 'researcher',
  capabilities: ['web_search', 'summarization']
})

// Execute the agent
const result = await execute('Research the latest AI trends')
</script>
```

### useAIVectorStore()

Composable for vector store operations.

```typescript
const {
  vectorStore,
  loading,
  error,
  add,
  search,
  delete: deleteVector,
  clear
} = useAIVectorStore(options?)
```

#### Parameters

- `options` (optional): Vector store configuration
  - `provider`: Vector store provider
  - `dimensions`: Vector dimensions
  - `similarity`: Similarity metric

#### Returns

- `vectorStore`: Vector store instance
- `loading`: Loading state
- `error`: Error state
- `add(documents)`: Add documents
- `search(query, k?)`: Search vectors
- `delete(id)`: Delete vector
- `clear()`: Clear all vectors

#### Example

```vue
<script setup>
const { add, search } = useAIVectorStore({
  provider: 'memory',
  dimensions: 1536
})

// Add documents
await add([
  { id: '1', content: 'AI is transforming technology', metadata: { type: 'article' } },
  { id: '2', content: 'Machine learning enables automation', metadata: { type: 'blog' } }
])

// Search for similar content
const results = await search('artificial intelligence', 5)
</script>
```

### useAICache()

Composable for cache management.

```typescript
const {
  cache,
  get,
  set,
  delete: deleteCache,
  clear,
  stats
} = useAICache(options?)
```

#### Parameters

- `options` (optional): Cache configuration
  - `provider`: Cache provider
  - `ttl`: Time to live
  - `maxSize`: Maximum cache size

#### Returns

- `cache`: Cache instance
- `get(key)`: Get cached value
- `set(key, value, ttl?)`: Set cache value
- `delete(key)`: Delete cache entry
- `clear()`: Clear all cache
- `stats`: Cache statistics

#### Example

```vue
<script setup>
const { get, set, stats } = useAICache({
  provider: 'memory',
  ttl: 3600
})

// Cache a response
await set('chat:hello', 'Hello! How can I help you?')

// Retrieve from cache
const cached = await get('chat:hello')

// Check cache stats
console.log(stats.value) // { hits: 1, misses: 0, size: 1 }
</script>
```

## Components

### `<AIChat />`

Complete chat interface component.

#### Props

```typescript
interface AIChatProps {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  streaming?: boolean
  systemPrompt?: string
  placeholder?: string
  height?: string
  theme?: 'light' | 'dark' | 'auto'
  showModelSelector?: boolean
  showSettings?: boolean
}
```

#### Events

- `@message`: Emitted when a message is sent
- `@response`: Emitted when AI responds
- `@error`: Emitted on error

#### Example

```vue
<template>
  <AIChat
    provider="openai"
    model="gpt-4"
    :temperature="0.7"
    :streaming="true"
    placeholder="Ask me anything..."
    height="500px"
    theme="dark"
    :show-model-selector="true"
    @message="onMessage"
    @response="onResponse"
  />
</template>
```

### `<AIMessageList />`

Message display component.

#### Props

```typescript
interface AIMessageListProps {
  messages: Message[]
  loading?: boolean
  showTimestamps?: boolean
  showTokens?: boolean
  maxHeight?: string
  autoScroll?: boolean
}
```

#### Example

```vue
<template>
  <AIMessageList
    :messages="messages"
    :loading="loading"
    :show-timestamps="true"
    :show-tokens="true"
    max-height="400px"
    :auto-scroll="true"
  />
</template>
```

### `<AIInput />`

Message input component.

#### Props

```typescript
interface AIInputProps {
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  multiline?: boolean
  showSendButton?: boolean
  showAttachButton?: boolean
}
```

#### Events

- `@send`: Emitted when message is sent
- `@input`: Emitted on input change

#### Example

```vue
<template>
  <AIInput
    placeholder="Type your message..."
    :disabled="loading"
    :max-length="1000"
    :multiline="true"
    :show-send-button="true"
    @send="handleSend"
  />
</template>
```

### `<AIModelSelector />`

Model selection component.

#### Props

```typescript
interface AIModelSelectorProps {
  provider?: string
  model?: string
  showProvider?: boolean
  showSettings?: boolean
}
```

#### Events

- `@provider-change`: Emitted when provider changes
- `@model-change`: Emitted when model changes
- `@settings-change`: Emitted when settings change

#### Example

```vue
<template>
  <AIModelSelector
    :provider="currentProvider"
    :model="currentModel"
    :show-provider="true"
    :show-settings="true"
    @provider-change="updateProvider"
    @model-change="updateModel"
  />
</template>
```

### `<AIPromptBuilder />`

Visual prompt construction component.

#### Props

```typescript
interface AIPromptBuilderProps {
  initialPrompt?: string
  templates?: PromptTemplate[]
  showTemplates?: boolean
  showVariables?: boolean
}
```

#### Events

- `@prompt-change`: Emitted when prompt changes
- `@template-select`: Emitted when template is selected

#### Example

```vue
<template>
  <AIPromptBuilder
    :initial-prompt="prompt"
    :templates="promptTemplates"
    :show-templates="true"
    :show-variables="true"
    @prompt-change="updatePrompt"
  />
</template>
```

### `<AIDebugger />`

Debug information component.

#### Props

```typescript
interface AIDebuggerProps {
  showTokens?: boolean
  showLatency?: boolean
  showCost?: boolean
  showProvider?: boolean
  expanded?: boolean
}
```

#### Example

```vue
<template>
  <AIDebugger
    :show-tokens="true"
    :show-latency="true"
    :show-cost="true"
    :show-provider="true"
    :expanded="false"
  />
</template>
```

## Types

### Message

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tokens?: number
  cost?: number
  metadata?: Record<string, any>
}
```

### ChatResponse

```typescript
interface ChatResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason?: string
  metadata?: Record<string, any>
}
```

### CompletionResponse

```typescript
interface CompletionResponse {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason?: string
}
```

### EmbeddingResponse

```typescript
interface EmbeddingResponse {
  embeddings: number[][]
  usage: {
    promptTokens: number
    totalTokens: number
  }
  model: string
}
```

### Agent

```typescript
interface Agent {
  id: string
  name: string
  type: string
  description: string
  capabilities: string[]
  tools: Tool[]
  systemPrompt?: string
}
```

### Tool

```typescript
interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
  execute: (params: any) => Promise<any>
}
```

## Utilities

### generateId()

Generate unique identifier.

```typescript
const id = generateId() // Returns: string
```

### formatTokens()

Format token count for display.

```typescript
const formatted = formatTokens(1500) // Returns: "1.5K tokens"
```

### calculateCost()

Calculate API cost based on usage.

```typescript
const cost = calculateCost({
  provider: 'openai',
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50
}) // Returns: number (USD)
```

### validateApiKey()

Validate API key format.

```typescript
const isValid = validateApiKey('sk-...', 'openai') // Returns: boolean
```

### parseMarkdown()

Parse markdown content.

```typescript
const html = parseMarkdown('**Bold** text') // Returns: string (HTML)
```

## Error Handling

### AIError

Base error class for AI operations.

```typescript
class AIError extends Error {
  code: string
  provider: string
  details?: any
}
```

### Common Error Codes

- `INVALID_API_KEY`: Invalid API key
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `MODEL_NOT_FOUND`: Model not available
- `INSUFFICIENT_QUOTA`: Insufficient quota
- `NETWORK_ERROR`: Network connection error
- `TIMEOUT_ERROR`: Request timeout
- `VALIDATION_ERROR`: Input validation error

### Error Handling Example

```vue
<script setup>
const { chat } = useAI()

try {
  const response = await chat([
    { role: 'user', content: 'Hello' }
  ])
} catch (error) {
  if (error instanceof AIError) {
    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        console.log('Rate limit exceeded, please wait')
        break
      case 'INVALID_API_KEY':
        console.log('Please check your API key')
        break
      default:
        console.log('AI Error:', error.message)
    }
  }
}
</script>
```

## Configuration Types

### ModuleOptions

```typescript
interface ModuleOptions {
  providers: ProviderConfig[]
  defaultProvider: string
  streaming: StreamingConfig
  caching: CachingConfig
  vectorStore: VectorStoreConfig
  security: SecurityConfig
  monitoring: MonitoringConfig
  debug: boolean
}
```

### ProviderConfig

```typescript
interface ProviderConfig {
  apiKey: string
  baseURL?: string
  models: {
    chat?: string
    completion?: string
    embedding?: string
  }
  defaultOptions?: {
    temperature?: number
    maxTokens?: number
    topP?: number
  }
  rateLimits?: {
    requestsPerMinute?: number
    tokensPerMinute?: number
  }
}
```

## Server API

### Chat Endpoint

```http
POST /api/ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1000,
  "stream": false
}
```

### Completion Endpoint

```http
POST /api/ai/completion
Content-Type: application/json

{
  "prompt": "The future of AI is",
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "maxTokens": 100
}
```

### Embedding Endpoint

```http
POST /api/ai/embedding
Content-Type: application/json

{
  "input": ["Hello world", "AI is amazing"],
  "provider": "openai",
  "model": "text-embedding-ada-002"
}
```

### Health Check

```http
GET /api/ai/health
```

Response:
```json
{
  "status": "ok",
  "providers": {
    "openai": true,
    "anthropic": true,
    "ollama": false
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```