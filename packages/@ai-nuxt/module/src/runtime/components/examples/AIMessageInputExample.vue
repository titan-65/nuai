<template>
  <div class="ai-message-input-example">
    <h2>AIMessageList & AIInput Components Example</h2>
    
    <!-- Separate Components Example -->
    <div class="example-section">
      <h3>Separate Components</h3>
      <div class="chat-container">
        <!-- Message List -->
        <AIMessageList
          :messages="messages"
          :current-message="currentMessage"
          :is-loading="isLoading"
          height="300px"
          :show-metadata="showMetadata"
          :show-actions="showActions"
          :allow-copy="true"
          :allow-regenerate="true"
          :allow-delete="true"
          @copy="handleCopy"
          @regenerate="handleRegenerate"
          @delete="handleDelete"
        />
        
        <!-- Input -->
        <AIInput
          v-model="inputValue"
          :is-loading="isLoading"
          :error="error"
          :suggestions="suggestions"
          :allow-attachments="true"
          :allow-voice-input="true"
          placeholder="Type your message here..."
          @submit="handleSubmit"
          @cancel="handleCancel"
          @attachment="handleAttachment"
          @voice-start="handleVoiceStart"
          @voice-end="handleVoiceEnd"
        />
      </div>
    </div>
    
    <!-- Configuration Panel -->
    <div class="config-panel">
      <h3>Configuration</h3>
      <div class="config-grid">
        <label class="config-item">
          <input type="checkbox" v-model="showMetadata" />
          Show Metadata
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="showActions" />
          Show Actions
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="enableSuggestions" />
          Enable Suggestions
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="simulateErrors" />
          Simulate Errors
        </label>
      </div>
    </div>
    
    <!-- Event Log -->
    <div class="event-log">
      <h3>Event Log</h3>
      <div class="log-container">
        <div 
          v-for="(event, index) in eventLog" 
          :key="index"
          class="log-entry"
        >
          <span class="log-timestamp">{{ formatTime(event.timestamp) }}</span>
          <span class="log-type">{{ event.type }}</span>
          <span class="log-message">{{ event.message }}</span>
        </div>
      </div>
      <button @click="clearEventLog" class="clear-btn">Clear Log</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import AIMessageList from '../AIMessageList.vue'
import AIInput from '../AIInput.vue'
import type { Message } from '@ai-nuxt/core'

// State
const messages = ref<Message[]>([
  {
    id: '1',
    role: 'assistant',
    content: 'Hello! I\'m your AI assistant. How can I help you today?',
    timestamp: new Date(Date.now() - 60000),
    metadata: {
      tokens: 12,
      model: 'gpt-4',
      provider: 'openai'
    }
  }
])

const inputValue = ref('')
const currentMessage = ref('')
const isLoading = ref(false)
const error = ref('')

// Configuration
const showMetadata = ref(true)
const showActions = ref(true)
const enableSuggestions = ref(true)
const simulateErrors = ref(false)

// Event log
interface LogEvent {
  type: string
  message: string
  timestamp: Date
}

const eventLog = ref<LogEvent[]>([])

// Computed
const suggestions = computed(() => {
  if (!enableSuggestions.value) return []
  
  return [
    'Hello, how are you?',
    'What can you help me with?',
    'Can you explain this concept?',
    'Thank you for your help!'
  ]
})

// Methods
const addLogEvent = (type: string, message: string) => {
  eventLog.value.push({
    type,
    message,
    timestamp: new Date()
  })
}

const generateId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const simulateAIResponse = async (userMessage: string) => {
  // Simulate thinking time
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Simulate streaming response
  const responses = [
    'That\'s an interesting question! Let me think about that.',
    'I understand what you\'re asking. Here\'s my response:',
    'Great question! I\'d be happy to help you with that.',
    'Thanks for asking! Here\'s what I think about that topic.',
    'I see what you mean. Let me provide some insights on this.'
  ]
  
  const response = responses[Math.floor(Math.random() * responses.length)]
  const words = response.split(' ')
  
  currentMessage.value = ''
  
  // Stream word by word
  for (let i = 0; i < words.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 100))
    currentMessage.value += (i > 0 ? ' ' : '') + words[i]
  }
  
  // Add final message
  const assistantMessage: Message = {
    id: generateId(),
    role: 'assistant',
    content: response,
    timestamp: new Date(),
    metadata: {
      tokens: words.length + 5,
      model: 'gpt-4',
      provider: 'openai',
      cost: 0.0001
    }
  }
  
  messages.value.push(assistantMessage)
  currentMessage.value = ''
}

const handleSubmit = async (value: string) => {
  addLogEvent('SUBMIT', `User message: "${value}"`)
  
  // Add user message
  const userMessage: Message = {
    id: generateId(),
    role: 'user',
    content: value,
    timestamp: new Date()
  }
  
  messages.value.push(userMessage)
  
  // Simulate error if enabled
  if (simulateErrors.value && Math.random() < 0.3) {
    error.value = 'Simulated network error occurred'
    addLogEvent('ERROR', 'Simulated error triggered')
    return
  }
  
  error.value = ''
  isLoading.value = true
  
  try {
    await simulateAIResponse(value)
    addLogEvent('SUCCESS', 'AI response generated')
  } catch (err) {
    error.value = 'Failed to generate response'
    addLogEvent('ERROR', 'Failed to generate AI response')
  } finally {
    isLoading.value = false
  }
}

const handleCancel = () => {
  isLoading.value = false
  currentMessage.value = ''
  addLogEvent('CANCEL', 'Request cancelled')
}

const handleCopy = (message: Message) => {
  addLogEvent('COPY', `Copied message: "${message.content.substring(0, 50)}..."`)
}

const handleRegenerate = async (message: Message) => {
  addLogEvent('REGENERATE', `Regenerating message: ${message.id}`)
  
  // Remove the message and regenerate
  const messageIndex = messages.value.findIndex(m => m.id === message.id)
  if (messageIndex > 0) {
    const previousMessage = messages.value[messageIndex - 1]
    messages.value.splice(messageIndex, 1)
    
    isLoading.value = true
    try {
      await simulateAIResponse(previousMessage.content)
      addLogEvent('SUCCESS', 'Message regenerated')
    } catch (err) {
      error.value = 'Failed to regenerate response'
      addLogEvent('ERROR', 'Failed to regenerate message')
    } finally {
      isLoading.value = false
    }
  }
}

const handleDelete = (message: Message) => {
  const index = messages.value.findIndex(m => m.id === message.id)
  if (index !== -1) {
    messages.value.splice(index, 1)
    addLogEvent('DELETE', `Deleted message: ${message.id}`)
  }
}

const handleAttachment = (files: FileList) => {
  const fileNames = Array.from(files).map(f => f.name).join(', ')
  addLogEvent('ATTACHMENT', `Files attached: ${fileNames}`)
}

const handleVoiceStart = () => {
  addLogEvent('VOICE', 'Voice recording started')
}

const handleVoiceEnd = (transcript: string) => {
  addLogEvent('VOICE', `Voice recording ended: "${transcript}"`)
  inputValue.value = transcript
}

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString()
}

const clearEventLog = () => {
  eventLog.value = []
}
</script>

<style scoped>
.ai-message-input-example {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-message-input-example h2 {
  text-align: center;
  color: #1e293b;
  margin-bottom: 2rem;
}

.example-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.example-section h3 {
  margin: 0 0 1rem 0;
  color: #334155;
  font-size: 1.25rem;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
}

.config-panel {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
}

.config-panel h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.config-item input[type="checkbox"] {
  margin: 0;
}

.event-log {
  padding: 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
}

.event-log h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #f9fafb;
  margin-bottom: 1rem;
}

.log-entry {
  display: flex;
  gap: 1rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.75rem;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-timestamp {
  color: #6b7280;
  min-width: 80px;
}

.log-type {
  font-weight: 600;
  min-width: 80px;
  color: #059669;
}

.log-message {
  flex: 1;
  color: #374151;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: #4b5563;
}

/* Responsive design */
@media (max-width: 768px) {
  .ai-message-input-example {
    padding: 1rem;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .log-entry {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .log-timestamp,
  .log-type {
    min-width: auto;
  }
}
</style>