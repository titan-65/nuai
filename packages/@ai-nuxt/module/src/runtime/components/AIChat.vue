<template>
  <div class="ai-chat" :class="{ 'ai-chat--disabled': disabled }">
    <!-- Header -->
    <div v-if="showHeader" class="ai-chat__header">
      <h3 class="ai-chat__title">{{ title }}</h3>
      <div class="ai-chat__status">
        <span 
          class="ai-chat__status-indicator" 
          :class="{
            'ai-chat__status-indicator--connected': isConnected,
            'ai-chat__status-indicator--connecting': isConnecting,
            'ai-chat__status-indicator--error': !!error
          }"
        ></span>
        <span class="ai-chat__status-text">
          {{ statusText }}
        </span>
      </div>
    </div>

    <!-- Messages Container -->
    <div 
      ref="messagesContainer"
      class="ai-chat__messages"
      :style="{ height: height }"
    >
      <!-- Welcome Message -->
      <div v-if="messages.length === 0 && welcomeMessage" class="ai-chat__welcome">
        <p>{{ welcomeMessage }}</p>
      </div>

      <!-- Messages -->
      <div
        v-for="message in messages"
        :key="message.id"
        class="ai-chat__message"
        :class="`ai-chat__message--${message.role}`"
      >
        <div class="ai-chat__message-avatar">
          <slot :name="`avatar-${message.role}`" :message="message">
            <div class="ai-chat__message-avatar-default">
              {{ message.role === 'user' ? '👤' : '🤖' }}
            </div>
          </slot>
        </div>
        <div class="ai-chat__message-content">
          <div class="ai-chat__message-header">
            <span class="ai-chat__message-role">{{ message.role }}</span>
            <span class="ai-chat__message-time">
              {{ formatTime(message.timestamp) }}
            </span>
          </div>
          <div class="ai-chat__message-text">
            <slot name="message" :message="message">
              {{ message.content }}
            </slot>
          </div>
          <div v-if="message.metadata" class="ai-chat__message-metadata">
            <small>
              <span v-if="message.metadata.tokens">
                Tokens: {{ message.metadata.tokens }}
              </span>
              <span v-if="message.metadata.model">
                Model: {{ message.metadata.model }}
              </span>
              <span v-if="message.metadata.provider">
                Provider: {{ message.metadata.provider }}
              </span>
            </small>
          </div>
        </div>
      </div>

      <!-- Current Streaming Message -->
      <div
        v-if="currentMessage && isStreaming"
        class="ai-chat__message ai-chat__message--assistant ai-chat__message--streaming"
      >
        <div class="ai-chat__message-avatar">
          <slot name="avatar-assistant">
            <div class="ai-chat__message-avatar-default">🤖</div>
          </slot>
        </div>
        <div class="ai-chat__message-content">
          <div class="ai-chat__message-header">
            <span class="ai-chat__message-role">assistant</span>
            <span class="ai-chat__message-status">typing...</span>
          </div>
          <div class="ai-chat__message-text">
            {{ currentMessage }}
            <span class="ai-chat__cursor">|</span>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isStreaming && !currentMessage" class="ai-chat__loading">
        <div class="ai-chat__loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>AI is thinking...</span>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="ai-chat__error">
      <div class="ai-chat__error-content">
        <span class="ai-chat__error-icon">⚠️</span>
        <span class="ai-chat__error-message">{{ error }}</span>
        <button 
          v-if="showRetry"
          @click="handleRetry"
          class="ai-chat__error-retry"
          type="button"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Input Area -->
    <div class="ai-chat__input-area">
      <div class="ai-chat__input-container">
        <textarea
          ref="inputElement"
          v-model="inputMessage"
          class="ai-chat__input"
          :placeholder="placeholder"
          :disabled="disabled || isStreaming"
          :rows="inputRows"
          @keydown="handleKeydown"
          @input="handleInput"
        ></textarea>
        
        <div class="ai-chat__input-actions">
          <button
            v-if="isStreaming"
            @click="handleCancel"
            class="ai-chat__button ai-chat__button--cancel"
            type="button"
          >
            <span class="ai-chat__button-icon">⏹️</span>
            Cancel
          </button>
          
          <button
            v-else
            @click="handleSend"
            :disabled="!canSend"
            class="ai-chat__button ai-chat__button--send"
            type="button"
          >
            <span class="ai-chat__button-icon">📤</span>
            Send
          </button>
        </div>
      </div>
      
      <!-- Input Footer -->
      <div v-if="showInputFooter" class="ai-chat__input-footer">
        <div class="ai-chat__input-info">
          <span v-if="characterCount > 0">
            {{ characterCount }} characters
          </span>
          <span v-if="provider">
            Provider: {{ provider }}
          </span>
          <span v-if="model">
            Model: {{ model }}
          </span>
        </div>
        
        <button
          v-if="messages.length > 0"
          @click="handleClear"
          class="ai-chat__button ai-chat__button--clear"
          type="button"
        >
          Clear Chat
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAIStreamingChat } from '../composables/useAIStreamingChat'
import type { Message } from '@ai-nuxt/core'

export interface AIChatProps {
  // Streaming options
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  transport?: 'sse' | 'websocket'
  
  // UI options
  title?: string
  welcomeMessage?: string
  placeholder?: string
  height?: string
  showHeader?: boolean
  showInputFooter?: boolean
  showRetry?: boolean
  disabled?: boolean
  
  // Input options
  maxLength?: number
  autoResize?: boolean
  submitOnEnter?: boolean
  
  // Initial messages
  initialMessages?: Message[]
}

const props = withDefaults(defineProps<AIChatProps>(), {
  title: 'AI Chat',
  welcomeMessage: 'Hello! How can I help you today?',
  placeholder: 'Type your message here...',
  height: '400px',
  showHeader: true,
  showInputFooter: true,
  showRetry: true,
  disabled: false,
  maxLength: 4000,
  autoResize: true,
  submitOnEnter: true,
  transport: 'sse'
})

// Emits
const emit = defineEmits<{
  message: [message: Message]
  error: [error: string]
  clear: []
  retry: []
}>()

// Refs
const messagesContainer = ref<HTMLElement>()
const inputElement = ref<HTMLTextAreaElement>()
const inputMessage = ref('')
const lastFailedMessage = ref('')

// Streaming chat composable
const {
  messages,
  currentMessage,
  isStreaming,
  isConnected,
  error,
  sendMessage,
  clearMessages,
  cancelStream,
  connect,
  disconnect,
  reconnectAttempts
} = useAIStreamingChat({
  provider: props.provider,
  model: props.model,
  temperature: props.temperature,
  maxTokens: props.maxTokens,
  systemPrompt: props.systemPrompt,
  transport: props.transport,
  autoConnect: true
})

// Computed properties
const isConnecting = computed(() => {
  return props.transport === 'websocket' && !isConnected.value && reconnectAttempts.value === 0
})

const statusText = computed(() => {
  if (props.transport === 'sse') return 'Ready'
  if (isConnected.value) return 'Connected'
  if (isConnecting.value) return 'Connecting...'
  if (reconnectAttempts.value > 0) return `Reconnecting... (${reconnectAttempts.value})`
  return 'Disconnected'
})

const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && 
         !isStreaming.value && 
         !props.disabled &&
         (props.transport === 'sse' || isConnected.value)
})

const characterCount = computed(() => inputMessage.value.length)

const inputRows = computed(() => {
  if (!props.autoResize) return 1
  const lines = inputMessage.value.split('\n').length
  return Math.min(Math.max(lines, 1), 4)
})

// Methods
const formatTime = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const handleSend = async () => {
  if (!canSend.value) return
  
  const message = inputMessage.value.trim()
  if (!message) return
  
  try {
    lastFailedMessage.value = message
    inputMessage.value = ''
    await sendMessage(message)
    lastFailedMessage.value = ''
  } catch (err: any) {
    console.error('Failed to send message:', err)
    // Restore the message to input on error
    inputMessage.value = lastFailedMessage.value
  }
}

const handleCancel = () => {
  cancelStream()
}

const handleClear = () => {
  clearMessages()
  emit('clear')
}

const handleRetry = async () => {
  if (lastFailedMessage.value) {
    inputMessage.value = lastFailedMessage.value
    emit('retry')
    await handleSend()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.submitOnEnter && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleInput = () => {
  if (props.maxLength && inputMessage.value.length > props.maxLength) {
    inputMessage.value = inputMessage.value.slice(0, props.maxLength)
  }
}

const focusInput = () => {
  nextTick(() => {
    inputElement.value?.focus()
  })
}

// Watchers
watch(messages, () => {
  scrollToBottom()
  // Emit the latest message
  const latestMessage = messages.value[messages.value.length - 1]
  if (latestMessage) {
    emit('message', latestMessage)
  }
}, { deep: true })

watch(currentMessage, () => {
  scrollToBottom()
})

watch(error, (newError) => {
  if (newError) {
    emit('error', newError)
  }
})

// Initialize with initial messages
onMounted(() => {
  if (props.initialMessages?.length) {
    messages.value.push(...props.initialMessages)
    scrollToBottom()
  }
  focusInput()
})

// Expose methods for parent components
defineExpose({
  sendMessage: handleSend,
  clearMessages: handleClear,
  focusInput,
  connect,
  disconnect,
  messages,
  isStreaming,
  isConnected,
  error
})
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ai-chat--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* Header */
.ai-chat__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.ai-chat__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.ai-chat__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #64748b;
}

.ai-chat__status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.ai-chat__status-indicator--connected {
  background: #10b981;
}

.ai-chat__status-indicator--connecting {
  background: #f59e0b;
  animation: pulse 2s infinite;
}

.ai-chat__status-indicator--error {
  background: #ef4444;
}

/* Messages */
.ai-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-chat__welcome {
  text-align: center;
  color: #64748b;
  font-style: italic;
  padding: 32px 16px;
}

.ai-chat__message {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.ai-chat__message--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.ai-chat__message--assistant {
  align-self: flex-start;
}

.ai-chat__message--streaming {
  opacity: 0.8;
}

.ai-chat__message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}

.ai-chat__message-avatar-default {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.ai-chat__message-content {
  flex: 1;
  min-width: 0;
}

.ai-chat__message--user .ai-chat__message-content {
  text-align: right;
}

.ai-chat__message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: #64748b;
}

.ai-chat__message--user .ai-chat__message-header {
  flex-direction: row-reverse;
}

.ai-chat__message-role {
  font-weight: 600;
  text-transform: capitalize;
}

.ai-chat__message-text {
  background: #f1f5f9;
  padding: 12px 16px;
  border-radius: 16px;
  line-height: 1.5;
  word-wrap: break-word;
}

.ai-chat__message--user .ai-chat__message-text {
  background: #3b82f6;
  color: white;
}

.ai-chat__message-metadata {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.ai-chat__cursor {
  animation: blink 1s infinite;
}

/* Loading */
.ai-chat__loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 14px;
}

.ai-chat__loading-dots {
  display: flex;
  gap: 4px;
}

.ai-chat__loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: bounce 1.4s infinite ease-in-out both;
}

.ai-chat__loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.ai-chat__loading-dots span:nth-child(2) { animation-delay: -0.16s; }

/* Error */
.ai-chat__error {
  padding: 12px 16px;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
}

.ai-chat__error-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #dc2626;
  font-size: 14px;
}

.ai-chat__error-retry {
  margin-left: auto;
  padding: 4px 8px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.ai-chat__error-retry:hover {
  background: #b91c1c;
}

/* Input Area */
.ai-chat__input-area {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.ai-chat__input-container {
  display: flex;
  gap: 12px;
  padding: 16px;
  align-items: flex-end;
}

.ai-chat__input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  min-height: 44px;
}

.ai-chat__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.ai-chat__input:disabled {
  background: #f3f4f6;
  color: #9ca3af;
}

.ai-chat__input-actions {
  display: flex;
  gap: 8px;
}

.ai-chat__button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-chat__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-chat__button--send {
  background: #3b82f6;
  color: white;
}

.ai-chat__button--send:hover:not(:disabled) {
  background: #2563eb;
}

.ai-chat__button--cancel {
  background: #ef4444;
  color: white;
}

.ai-chat__button--cancel:hover {
  background: #dc2626;
}

.ai-chat__button--clear {
  background: #6b7280;
  color: white;
  font-size: 12px;
  padding: 4px 8px;
}

.ai-chat__button--clear:hover {
  background: #4b5563;
}

.ai-chat__input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 12px;
  color: #64748b;
  border-top: 1px solid #e2e8f0;
}

.ai-chat__input-info {
  display: flex;
  gap: 16px;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .ai-chat__message {
    max-width: 95%;
  }
  
  .ai-chat__input-container {
    flex-direction: column;
    align-items: stretch;
  }
  
  .ai-chat__input-actions {
    justify-content: flex-end;
  }
  
  .ai-chat__input-footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>