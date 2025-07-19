# AIChat Component

The `AIChat` component is a comprehensive, ready-to-use chat interface for AI conversations. It supports both Server-Sent Events (SSE) and WebSocket streaming, with built-in message management, error handling, and customization options.

## Features

- 🔄 **Dual Transport Support**: SSE and WebSocket streaming
- 💬 **Message Management**: Automatic message history and display
- 🎨 **Customizable UI**: Slots, props, and CSS custom properties
- 🛡️ **Error Handling**: Built-in error display and retry functionality
- 📱 **Responsive Design**: Mobile-friendly interface
- ⚡ **Real-time Streaming**: Live message updates with typing indicators
- 🔌 **Connection Status**: Visual connection state indicators
- 🎯 **Accessibility**: ARIA labels and keyboard navigation

## Basic Usage

```vue
<template>
  <AIChat
    title="My AI Assistant"
    provider="openai"
    model="gpt-4"
    @message="handleMessage"
    @error="handleError"
  />
</template>

<script setup>
const handleMessage = (message) => {
  console.log('New message:', message)
}

const handleError = (error) => {
  console.error('Chat error:', error)
}
</script>
```

## Props

### AI Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `provider` | `string` | `undefined` | AI provider (openai, anthropic, ollama) |
| `model` | `string` | `undefined` | Model to use for generation |
| `temperature` | `number` | `undefined` | Sampling temperature (0-2) |
| `maxTokens` | `number` | `undefined` | Maximum tokens to generate |
| `systemPrompt` | `string` | `undefined` | System prompt for the AI |
| `transport` | `'sse' \| 'websocket'` | `'sse'` | Streaming transport method |

### UI Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'AI Chat'` | Chat window title |
| `welcomeMessage` | `string` | `'Hello! How can I help you today?'` | Welcome message |
| `placeholder` | `string` | `'Type your message here...'` | Input placeholder |
| `height` | `string` | `'400px'` | Chat window height |
| `showHeader` | `boolean` | `true` | Show header with title and status |
| `showInputFooter` | `boolean` | `true` | Show input footer with info |
| `showRetry` | `boolean` | `true` | Show retry button on errors |
| `disabled` | `boolean` | `false` | Disable the entire chat |

### Input Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxLength` | `number` | `4000` | Maximum input character length |
| `autoResize` | `boolean` | `true` | Auto-resize input textarea |
| `submitOnEnter` | `boolean` | `true` | Submit on Enter key (Shift+Enter for new line) |

### Initial Data

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialMessages` | `Message[]` | `undefined` | Pre-populate with messages |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `Message` | Emitted when a new message is added |
| `error` | `string` | Emitted when an error occurs |
| `clear` | - | Emitted when messages are cleared |
| `retry` | - | Emitted when retry button is clicked |

## Slots

### Avatar Slots

Customize user and assistant avatars:

```vue
<template>
  <AIChat>
    <template #avatar-user="{ message }">
      <img :src="userAvatar" alt="User" class="avatar" />
    </template>
    
    <template #avatar-assistant="{ message }">
      <div class="ai-avatar">🤖</div>
    </template>
  </AIChat>
</template>
```

### Message Slot

Customize message content display:

```vue
<template>
  <AIChat>
    <template #message="{ message }">
      <div v-if="message.role === 'assistant'" v-html="formatMarkdown(message.content)"></div>
      <div v-else>{{ message.content }}</div>
    </template>
  </AIChat>
</template>
```

## Exposed Methods

The component exposes methods via `defineExpose`:

```vue
<template>
  <AIChat ref="chatRef" />
  <button @click="sendCustomMessage">Send Custom</button>
</template>

<script setup>
const chatRef = ref()

const sendCustomMessage = () => {
  chatRef.value.sendMessage('Hello from parent!')
}

// Available methods:
// - sendMessage(content: string)
// - clearMessages()
// - focusInput()
// - connect() // WebSocket only
// - disconnect() // WebSocket only
</script>
```

## Styling

### CSS Custom Properties

The component uses CSS custom properties for theming:

```css
:root {
  --ai-nuxt-primary: #3b82f6;
  --ai-nuxt-primary-hover: #2563eb;
  --ai-nuxt-success: #10b981;
  --ai-nuxt-error: #ef4444;
  --ai-nuxt-gray-50: #f8fafc;
  --ai-nuxt-gray-800: #1e293b;
  /* ... more variables */
}
```

### Dark Theme

Enable dark theme by adding the data attribute:

```html
<div data-theme="dark">
  <AIChat />
</div>
```

### Custom Styling

Override component styles:

```vue
<style>
.ai-chat {
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.ai-chat__message--user .ai-chat__message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
```

## Advanced Examples

### WebSocket Chat with Custom Configuration

```vue
<template>
  <AIChat
    title="Advanced AI Assistant"
    transport="websocket"
    :provider="provider"
    :model="model"
    :temperature="0.8"
    :max-tokens="1000"
    :system-prompt="systemPrompt"
    height="600px"
    @message="logMessage"
    @error="handleError"
  >
    <template #avatar-assistant>
      <div class="custom-ai-avatar">
        <img src="/ai-avatar.png" alt="AI Assistant" />
      </div>
    </template>
  </AIChat>
</template>

<script setup>
const provider = ref('openai')
const model = ref('gpt-4')
const systemPrompt = ref(`
  You are a helpful AI assistant specialized in software development.
  Provide clear, concise answers with code examples when appropriate.
  Always explain your reasoning and suggest best practices.
`)

const logMessage = (message) => {
  console.log(`[${message.timestamp}] ${message.role}: ${message.content}`)
  
  // Save to local storage
  const history = JSON.parse(localStorage.getItem('chat-history') || '[]')
  history.push(message)
  localStorage.setItem('chat-history', JSON.stringify(history))
}

const handleError = (error) => {
  console.error('Chat error:', error)
  // Send to error tracking service
  // trackError('ai-chat-error', { error, provider: provider.value })
}
</script>
```

### Chat with Message Persistence

```vue
<template>
  <AIChat
    :initial-messages="savedMessages"
    @message="saveMessage"
    @clear="clearSavedMessages"
  />
</template>

<script setup>
const savedMessages = ref([])

// Load messages on mount
onMounted(() => {
  const saved = localStorage.getItem('ai-chat-messages')
  if (saved) {
    savedMessages.value = JSON.parse(saved)
  }
})

const saveMessage = (message) => {
  const messages = [...savedMessages.value, message]
  localStorage.setItem('ai-chat-messages', JSON.stringify(messages))
  savedMessages.value = messages
}

const clearSavedMessages = () => {
  localStorage.removeItem('ai-chat-messages')
  savedMessages.value = []
}
</script>
```

### Multi-Provider Chat

```vue
<template>
  <div class="multi-provider-chat">
    <div class="provider-selector">
      <label>
        Provider:
        <select v-model="selectedProvider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama</option>
        </select>
      </label>
      
      <label>
        Model:
        <select v-model="selectedModel">
          <option v-for="model in availableModels" :key="model" :value="model">
            {{ model }}
          </option>
        </select>
      </label>
    </div>
    
    <AIChat
      :key="`${selectedProvider}-${selectedModel}`"
      :provider="selectedProvider"
      :model="selectedModel"
      :title="`${selectedProvider} - ${selectedModel}`"
    />
  </div>
</template>

<script setup>
const selectedProvider = ref('openai')
const selectedModel = ref('gpt-4')

const providerModels = {
  openai: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  ollama: ['llama2', 'codellama', 'mistral']
}

const availableModels = computed(() => {
  return providerModels[selectedProvider.value] || []
})

// Update model when provider changes
watch(selectedProvider, (newProvider) => {
  const models = providerModels[newProvider]
  if (models && !models.includes(selectedModel.value)) {
    selectedModel.value = models[0]
  }
})
</script>
```

## Accessibility

The component includes accessibility features:

- **Keyboard Navigation**: Tab through interactive elements
- **ARIA Labels**: Screen reader support
- **Focus Management**: Proper focus handling
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects `prefers-reduced-motion`

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebSocket Support**: Required for WebSocket transport
- **EventSource Support**: Required for SSE transport
- **CSS Grid**: Used for responsive layout

## Performance

- **Lazy Loading**: Components load on demand
- **Virtual Scrolling**: For large message histories (planned)
- **Debounced Input**: Prevents excessive API calls
- **Memory Management**: Automatic cleanup on unmount

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if WebSocket endpoint is accessible
   - Verify CORS settings for cross-origin requests
   - Ensure proper authentication headers

2. **SSE Stream Interrupted**
   - Check network connectivity
   - Verify server-side event stream implementation
   - Check for proxy/firewall blocking

3. **Messages Not Displaying**
   - Verify message format matches `Message` interface
   - Check console for JavaScript errors
   - Ensure proper provider configuration

### Debug Mode

Enable debug logging:

```vue
<template>
  <AIChat :debug="true" />
</template>
```

This will log internal state changes and API calls to the console.