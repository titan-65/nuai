# AI Nuxt Module

The main Nuxt module for the AI Nuxt framework, providing seamless integration of AI capabilities into your Nuxt.js applications.

## Features

- 🤖 **Multiple AI Providers**: Support for OpenAI, Anthropic, and Ollama
- 🔄 **Streaming Support**: Real-time streaming via Server-Sent Events (SSE) and WebSockets
- 🛡️ **Security Features**: Prompt injection detection, PII scrubbing, content filtering
- 📊 **Caching System**: Intelligent response caching with TTL and semantic similarity
- 🔌 **Auto-imports**: Automatic imports for all composables
- 🎯 **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @ai-nuxt/module
```

## Configuration

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@ai-nuxt/module'],
  aiNuxt: {
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-4', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4'
      }
    ],
    defaultProvider: 'openai',
    streaming: {
      enabled: true,
      transport: 'websocket' // or 'sse'
    },
    caching: {
      enabled: true,
      ttl: 3600
    },
    security: {
      promptInjectionDetection: true,
      piiScrubbing: true,
      rateLimit: {
        enabled: true,
        maxRequests: 60,
        windowMs: 60000
      }
    }
  }
})
```

## Usage

### Basic Chat

```vue
<template>
  <div>
    <div v-for="message in messages" :key="message.id">
      <strong>{{ message.role }}:</strong> {{ message.content }}
    </div>
    <div v-if="currentMessage">
      <strong>Assistant:</strong> {{ currentMessage }}
    </div>
    <input 
      v-model="input" 
      @keyup.enter="sendMessage(input)" 
      :disabled="isStreaming"
      placeholder="Type your message..."
    />
  </div>
</template>

<script setup>
const input = ref('')

// Using Server-Sent Events (SSE)
const { 
  messages, 
  currentMessage, 
  isStreaming, 
  sendMessage 
} = useAIStreamingChat({
  transport: 'sse',
  provider: 'openai',
  temperature: 0.7
})
</script>
```

### WebSocket Streaming

```vue
<template>
  <div>
    <div class="connection-status">
      Status: {{ isConnected ? 'Connected' : 'Disconnected' }}
      <span v-if="reconnectAttempts > 0">
        (Reconnect attempts: {{ reconnectAttempts }})
      </span>
    </div>
    
    <div v-for="message in messages" :key="message.id">
      <strong>{{ message.role }}:</strong> {{ message.content }}
    </div>
    
    <div v-if="currentMessage">
      <strong>Assistant:</strong> {{ currentMessage }}
    </div>
    
    <input 
      v-model="input" 
      @keyup.enter="handleSend" 
      :disabled="isStreaming || !isConnected"
      placeholder="Type your message..."
    />
    
    <button @click="cancelStream" v-if="isStreaming">
      Cancel
    </button>
  </div>
</template>

<script setup>
const input = ref('')

// Using WebSocket for bidirectional streaming
const { 
  messages, 
  currentMessage, 
  isStreaming,
  isConnected,
  reconnectAttempts,
  sendMessage,
  cancelStream
} = useAIStreamingChat({
  transport: 'websocket',
  provider: 'openai',
  temperature: 0.7,
  autoConnect: true
})

const handleSend = async () => {
  if (input.value.trim()) {
    await sendMessage(input.value)
    input.value = ''
  }
}
</script>
```

### Direct WebSocket Usage

```vue
<script setup>
const {
  isConnected,
  isConnecting,
  activeStreams,
  sendChat,
  sendCompletion,
  cancelStream,
  onChatChunk,
  onStreamComplete,
  onError
} = useAISocket({
  autoReconnect: true,
  maxReconnectAttempts: 5
})

// Handle chat chunks
onChatChunk((chunk, streamId) => {
  console.log('Received chunk:', chunk.delta)
})

// Handle stream completion
onStreamComplete((data, streamId) => {
  console.log('Stream completed:', data)
})

// Handle errors
onError((error, streamId) => {
  console.error('Stream error:', error)
})

// Send a chat message
const sendChatMessage = async () => {
  const streamId = await sendChat([
    { role: 'user', content: 'Hello, how are you?' }
  ], {
    provider: 'openai',
    temperature: 0.7
  })
  
  console.log('Started stream:', streamId)
}

// Send a completion request
const sendCompletionRequest = async () => {
  const streamId = await sendCompletion('Complete this sentence: The future of AI is', {
    provider: 'openai',
    maxTokens: 100
  })
  
  console.log('Started completion stream:', streamId)
}
</script>
```

## API Routes

The module automatically creates the following API routes:

- `GET /api/ai/health` - Health check and status
- `GET /api/ai/providers` - List available providers
- `POST /api/ai/chat` - Chat completions
- `POST /api/ai/completion` - Text completions
- `POST /api/ai/embedding` - Generate embeddings
- `POST /api/ai/stream` - Streaming responses (SSE)
- `WebSocket /api/ai/ws` - WebSocket streaming

## WebSocket Protocol

The WebSocket connection uses a JSON message protocol:

### Client Messages

```typescript
// Chat request
{
  id: 'unique-message-id',
  type: 'chat',
  data: {
    messages: [
      { role: 'user', content: 'Hello' }
    ],
    provider: 'openai',
    temperature: 0.7
  },
  timestamp: 1234567890
}

// Completion request
{
  id: 'unique-message-id',
  type: 'completion',
  data: {
    prompt: 'Complete this sentence',
    provider: 'openai',
    maxTokens: 100
  },
  timestamp: 1234567890
}

// Cancel stream
{
  id: 'unique-message-id',
  type: 'cancel',
  data: {
    streamId: 'stream-to-cancel'
  },
  timestamp: 1234567890
}
```

### Server Responses

```typescript
// Chat chunk
{
  id: 'stream-id',
  type: 'chat_chunk',
  data: {
    content: 'Hello',
    delta: 'Hello',
    finished: false,
    chunkIndex: 1,
    provider: 'openai'
  },
  timestamp: 1234567890
}

// Stream completion
{
  id: 'stream-id',
  type: 'stream_complete',
  data: {
    totalChunks: 5,
    duration: 1000,
    provider: 'openai'
  },
  timestamp: 1234567890
}

// Error
{
  id: 'stream-id',
  type: 'error',
  data: {
    error: 'Error message',
    provider: 'openai'
  },
  timestamp: 1234567890
}
```

## Security Features

### Rate Limiting

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  aiNuxt: {
    security: {
      rateLimit: {
        enabled: true,
        maxRequests: 60,    // requests per window
        windowMs: 60000     // 1 minute window
      }
    }
  }
})
```

### Content Security

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  aiNuxt: {
    security: {
      promptInjectionDetection: true,  // Detect prompt injection attempts
      piiScrubbing: true,              // Remove PII from requests
      contentFiltering: true           // Filter inappropriate content
    }
  }
})
```

## Composables

- `useAI()` - Core AI interface
- `useAIChat()` - Chat functionality
- `useAICompletion()` - Text completions
- `useAIEmbedding()` - Generate embeddings
- `useAIStream()` - Streaming responses
- `useAIStreamingChat()` - Streaming chat with message management
- `useAISocket()` - Direct WebSocket access
- `useAIProvider()` - Provider management

## Error Handling

All composables provide comprehensive error handling:

```vue
<script setup>
const { error, isStreaming, sendMessage } = useAIStreamingChat()

// Handle errors
watch(error, (newError) => {
  if (newError) {
    console.error('AI Error:', newError)
    // Show user-friendly error message
  }
})
</script>
```

## Development

```bash
# Install dependencies
pnpm install

# Build the module
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## License

MIT