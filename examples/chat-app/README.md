# AI Chat Application Example

A complete chat application built with AI Nuxt, featuring real-time conversations, multiple AI providers, and conversation management.

## Features

- 💬 Real-time AI chat with streaming responses
- 🔄 Multiple AI provider support (OpenAI, Anthropic, Ollama)
- 📱 Responsive design with mobile support
- 💾 Conversation persistence and history
- 🎨 Customizable themes and UI
- 🔒 Rate limiting and security features
- 📊 Usage analytics and monitoring

## Quick Start

### 1. Clone and Install

```bash
# Clone the example
git clone https://github.com/ai-nuxt/ai-nuxt.git
cd ai-nuxt/examples/chat-app

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Add your API keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
OLLAMA_HOST=http://localhost:11434
```

### 3. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

Visit `http://localhost:3000` to see the chat application.

## Project Structure

```
chat-app/
├── components/
│   ├── Chat/
│   │   ├── ChatInterface.vue      # Main chat component
│   │   ├── MessageList.vue        # Message display
│   │   ├── MessageInput.vue       # Input component
│   │   └── TypingIndicator.vue    # Typing animation
│   ├── Layout/
│   │   ├── Header.vue             # App header
│   │   ├── Sidebar.vue            # Conversation sidebar
│   │   └── Footer.vue             # App footer
│   └── Settings/
│       ├── ModelSelector.vue      # AI model selection
│       ├── ThemeSelector.vue      # Theme switching
│       └── SettingsPanel.vue      # Settings interface
├── pages/
│   ├── index.vue                  # Home page
│   ├── chat/
│   │   ├── [id].vue              # Individual chat page
│   │   └── new.vue               # New chat page
│   └── settings.vue              # Settings page
├── stores/
│   ├── chat.ts                   # Chat state management
│   ├── settings.ts               # App settings
│   └── auth.ts                   # Authentication
├── server/
│   └── api/
│       ├── chat/                 # Chat API endpoints
│       └── conversations/        # Conversation management
└── assets/
    ├── css/                      # Stylesheets
    └── images/                   # Images and icons
```

## Key Components

### ChatInterface.vue

The main chat component that orchestrates the entire chat experience:

```vue
<template>
  <div class="chat-interface">
    <ChatHeader 
      :conversation="currentConversation"
      @settings="showSettings = true"
    />
    
    <MessageList 
      :messages="messages"
      :loading="loading"
      class="flex-1"
    />
    
    <MessageInput 
      @send="sendMessage"
      :disabled="loading"
      :placeholder="inputPlaceholder"
    />
    
    <SettingsPanel 
      v-if="showSettings"
      @close="showSettings = false"
    />
  </div>
</template>

<script setup>
const { messages, loading, sendMessage } = useAIChat({
  provider: 'openai',
  model: 'gpt-4',
  streaming: true
})

const currentConversation = ref(null)
const showSettings = ref(false)

const inputPlaceholder = computed(() => {
  return loading.value ? 'AI is thinking...' : 'Type your message...'
})
</script>
```

### MessageList.vue

Displays chat messages with proper formatting and animations:

```vue
<template>
  <div class="message-list" ref="messageContainer">
    <div
      v-for="message in messages"
      :key="message.id"
      :class="messageClasses(message)"
      class="message-wrapper"
    >
      <div class="message-content">
        <div class="message-text" v-html="formatMessage(message.content)" />
        <div class="message-meta">
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          <span v-if="message.tokens" class="message-tokens">
            {{ message.tokens }} tokens
          </span>
        </div>
      </div>
    </div>
    
    <TypingIndicator v-if="loading" />
  </div>
</template>

<script setup>
import { marked } from 'marked'

const props = defineProps(['messages', 'loading'])

const messageContainer = ref(null)

const messageClasses = (message) => ({
  'message-user': message.role === 'user',
  'message-assistant': message.role === 'assistant',
  'message-system': message.role === 'system'
})

const formatMessage = (content) => {
  return marked(content, { breaks: true })
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Auto-scroll to bottom when new messages arrive
watch(() => props.messages.length, () => {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
})
</script>
```

## Advanced Features

### Conversation Management

```typescript
// stores/chat.ts
export const useChatStore = defineStore('chat', () => {
  const conversations = ref([])
  const activeConversation = ref(null)
  
  const createConversation = async (title = 'New Chat') => {
    const conversation = {
      id: generateId(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7
      }
    }
    
    conversations.value.unshift(conversation)
    activeConversation.value = conversation
    
    // Persist to localStorage
    await saveConversations()
    
    return conversation
  }
  
  const updateConversation = async (id, updates) => {
    const conversation = conversations.value.find(c => c.id === id)
    if (conversation) {
      Object.assign(conversation, updates, { updatedAt: new Date() })
      await saveConversations()
    }
  }
  
  const deleteConversation = async (id) => {
    const index = conversations.value.findIndex(c => c.id === id)
    if (index > -1) {
      conversations.value.splice(index, 1)
      
      if (activeConversation.value?.id === id) {
        activeConversation.value = conversations.value[0] || null
      }
      
      await saveConversations()
    }
  }
  
  const saveConversations = async () => {
    if (process.client) {
      localStorage.setItem('ai-chat-conversations', JSON.stringify(conversations.value))
    }
  }
  
  const loadConversations = async () => {
    if (process.client) {
      const saved = localStorage.getItem('ai-chat-conversations')
      if (saved) {
        conversations.value = JSON.parse(saved)
      }
    }
  }
  
  return {
    conversations: readonly(conversations),
    activeConversation: readonly(activeConversation),
    createConversation,
    updateConversation,
    deleteConversation,
    loadConversations
  }
})
```

### Real-time Streaming

```vue
<!-- components/Chat/StreamingMessage.vue -->
<template>
  <div class="streaming-message">
    <div class="message-content">
      <div class="streaming-text">{{ displayText }}</div>
      <div class="streaming-cursor" v-if="isStreaming">|</div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['content', 'isStreaming'])

const displayText = ref('')
const animationSpeed = 50 // ms per character

// Animate text appearance
watch(() => props.content, (newContent) => {
  if (props.isStreaming) {
    animateText(newContent)
  } else {
    displayText.value = newContent
  }
})

const animateText = (targetText) => {
  const currentLength = displayText.value.length
  const targetLength = targetText.length
  
  if (currentLength < targetLength) {
    displayText.value = targetText.substring(0, currentLength + 1)
    setTimeout(() => animateText(targetText), animationSpeed)
  }
}
</script>
```

### Provider Switching

```vue
<!-- components/Settings/ModelSelector.vue -->
<template>
  <div class="model-selector">
    <div class="provider-selection">
      <label>AI Provider</label>
      <select v-model="selectedProvider" @change="onProviderChange">
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>
    
    <div class="model-selection">
      <label>Model</label>
      <select v-model="selectedModel" @change="onModelChange">
        <option 
          v-for="model in availableModels" 
          :key="model.id" 
          :value="model.id"
        >
          {{ model.name }} - {{ model.description }}
        </option>
      </select>
    </div>
    
    <div class="model-settings">
      <div class="setting-group">
        <label>Temperature: {{ temperature }}</label>
        <input 
          type="range" 
          v-model="temperature" 
          min="0" 
          max="2" 
          step="0.1"
          @input="onSettingChange"
        />
      </div>
      
      <div class="setting-group">
        <label>Max Tokens</label>
        <input 
          type="number" 
          v-model="maxTokens" 
          min="1" 
          max="4000"
          @input="onSettingChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const { updateProvider, updateModel, updateSettings } = useAI()

const selectedProvider = ref('openai')
const selectedModel = ref('gpt-4')
const temperature = ref(0.7)
const maxTokens = ref(1000)

const availableModels = computed(() => {
  const modelMap = {
    openai: [
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' }
    ],
    anthropic: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Most powerful Claude model' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Balanced performance' }
    ],
    ollama: [
      { id: 'llama2', name: 'Llama 2', description: 'Open source model' },
      { id: 'codellama', name: 'Code Llama', description: 'Code generation' }
    ]
  }
  
  return modelMap[selectedProvider.value] || []
})

const onProviderChange = () => {
  selectedModel.value = availableModels.value[0]?.id
  updateProvider(selectedProvider.value)
}

const onModelChange = () => {
  updateModel(selectedModel.value)
}

const onSettingChange = () => {
  updateSettings({
    temperature: temperature.value,
    maxTokens: maxTokens.value
  })
}
</script>
```

## Deployment

### Development

```bash
npm run dev
```

### Production

```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Optional
OLLAMA_HOST=http://localhost:11434
NUXT_SECRET_KEY=your-secret-key
DATABASE_URL=your-database-url

# Monitoring
OTEL_EXPORTER_OTLP_ENDPOINT=your-telemetry-endpoint
OTEL_EXPORTER_OTLP_HEADERS=your-telemetry-headers
```

## Customization

### Themes

The chat app supports multiple themes. Create custom themes by extending the base theme:

```css
/* assets/css/themes/dark.css */
.theme-dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #cccccc;
  --accent-color: #3b82f6;
  --border-color: #404040;
}
```

### Custom Components

Replace default components with your own:

```vue
<!-- components/Chat/CustomMessageInput.vue -->
<template>
  <div class="custom-message-input">
    <!-- Your custom input implementation -->
  </div>
</template>
```

## Performance Optimization

### Lazy Loading

```vue
<script setup>
// Lazy load heavy components
const MessageList = defineAsyncComponent(() => import('~/components/Chat/MessageList.vue'))
const SettingsPanel = defineAsyncComponent(() => import('~/components/Settings/SettingsPanel.vue'))
</script>
```

### Virtual Scrolling

For large conversation histories:

```vue
<template>
  <RecycleScroller
    class="message-list"
    :items="messages"
    :item-size="80"
    key-field="id"
    v-slot="{ item }"
  >
    <MessageItem :message="item" />
  </RecycleScroller>
</template>
```

## Testing

```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details.