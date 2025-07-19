# Getting Started with AI Nuxt

Welcome to AI Nuxt! This guide will help you get up and running with AI-powered Nuxt applications in minutes.

## Prerequisites

- Node.js 16 or higher
- A Nuxt 3 project
- API keys for your chosen AI providers

## Installation

### 1. Install the Module

```bash
# Using npm
npm install @ai-nuxt/module

# Using yarn
yarn add @ai-nuxt/module

# Using pnpm
pnpm add @ai-nuxt/module
```

### 2. Add to Nuxt Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@ai-nuxt/module'
  ],
  
  aiNuxt: {
    // Basic configuration
    defaultProvider: 'openai',
    
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY
      }
    }
  }
})
```

### 3. Environment Variables

Create a `.env` file in your project root:

```bash
# .env
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
OLLAMA_HOST=http://localhost:11434
```

## Your First AI Component

### Simple Chat Interface

Create a new page with a basic chat interface:

```vue
<!-- pages/chat.vue -->
<template>
  <div class="container mx-auto p-8">
    <h1 class="text-3xl font-bold mb-8">AI Chat</h1>
    
    <!-- Pre-built chat component -->
    <AIChat 
      :model="'gpt-3.5-turbo'"
      :temperature="0.7"
      placeholder="Ask me anything..."
    />
  </div>
</template>
```

### Using Composables

For more control, use the AI composables directly:

```vue
<!-- pages/custom-chat.vue -->
<template>
  <div class="space-y-4">
    <div class="messages">
      <div 
        v-for="message in messages" 
        :key="message.id"
        :class="message.role === 'user' ? 'text-right' : 'text-left'"
      >
        <div class="inline-block p-3 rounded-lg" 
             :class="message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'">
          {{ message.content }}
        </div>
      </div>
    </div>
    
    <div class="flex space-x-2">
      <input 
        v-model="input" 
        @keyup.enter="sendMessage"
        placeholder="Type your message..."
        class="flex-1 p-2 border rounded"
      />
      <button 
        @click="sendMessage"
        :disabled="loading"
        class="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {{ loading ? 'Sending...' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<script setup>
const { chat } = useAI()
const { messages, loading, sendMessage: send } = useAIChat()

const input = ref('')

async function sendMessage() {
  if (!input.value.trim()) return
  
  const message = input.value
  input.value = ''
  
  await send(message)
}
</script>
```

## Basic Configuration Options

### Provider Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  aiNuxt: {
    // Default provider to use
    defaultProvider: 'openai',
    
    // Provider configurations
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        models: {
          chat: 'gpt-4',
          completion: 'gpt-3.5-turbo',
          embedding: 'text-embedding-ada-002'
        }
      },
      
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: {
          chat: 'claude-3-opus-20240229'
        }
      },
      
      ollama: {
        host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        models: {
          chat: 'llama2',
          embedding: 'nomic-embed-text'
        }
      }
    }
  }
})
```

### Caching Configuration

```typescript
aiNuxt: {
  caching: {
    enabled: true,
    semantic: true,
    ttl: 3600, // 1 hour
    maxSize: 100,
    semanticThreshold: 0.95
  }
}
```

### Streaming Configuration

```typescript
aiNuxt: {
  streaming: {
    enabled: true,
    transport: 'sse' // or 'websocket'
  }
}
```

## Available Composables

### Core Composables

- `useAI()` - Main AI interface
- `useAIChat()` - Chat functionality
- `useAICompletion()` - Text completion
- `useAIEmbedding()` - Text embeddings
- `useAIStream()` - Streaming responses

### Advanced Composables

- `useAIAgent()` - AI agents
- `useAIVectorStore()` - Vector storage
- `useAICache()` - Caching control
- `useAIProvider()` - Provider switching

## Available Components

### Chat Components

- `<AIChat />` - Complete chat interface
- `<AIMessageList />` - Message display
- `<AIInput />` - Message input
- `<AIPromptBuilder />` - Prompt construction

### Utility Components

- `<AIModelSelector />` - Model switching
- `<AIDebugger />` - Debug information
- `<AILoadingSpinner />` - Loading states

## Next Steps

Now that you have AI Nuxt set up, explore these topics:

1. **[Configuration](./configuration.md)** - Detailed configuration options
2. **[Providers](./providers.md)** - Working with different AI services
3. **[Components](./components.md)** - Using pre-built UI components
4. **[Composables](./composables.md)** - Vue composables reference
5. **[Examples](../examples/)** - Complete example applications

## Common Issues

### API Key Not Working

Make sure your API key is correctly set in your `.env` file and that the file is in your project root.

### Module Not Loading

Ensure you've added `@ai-nuxt/module` to your `modules` array in `nuxt.config.ts`.

### TypeScript Errors

If you're using TypeScript, make sure to restart your development server after installing the module.

### CORS Issues

If you're experiencing CORS issues, make sure you're making requests from the server side or through the provided API routes.

## Getting Help

- 📖 [Full Documentation](https://ai-nuxt.dev)
- 💬 [Discord Community](https://discord.gg/ai-nuxt)
- 🐛 [GitHub Issues](https://github.com/ai-nuxt/ai-nuxt/issues)
- 📧 [Email Support](mailto:support@ai-nuxt.dev)