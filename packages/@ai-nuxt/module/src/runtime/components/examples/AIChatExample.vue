<template>
  <div class="ai-chat-example">
    <h2>AI Chat Example</h2>
    
    <!-- Basic Chat -->
    <div class="example-section">
      <h3>Basic Chat (SSE)</h3>
      <AIChat
        title="Basic AI Assistant"
        welcome-message="Hello! I'm your AI assistant. How can I help you today?"
        :provider="provider"
        :model="model"
        transport="sse"
        @message="onMessage"
        @error="onError"
      />
    </div>
    
    <!-- WebSocket Chat -->
    <div class="example-section">
      <h3>WebSocket Chat</h3>
      <AIChat
        title="WebSocket AI Assistant"
        welcome-message="Connected via WebSocket for real-time communication!"
        :provider="provider"
        :model="model"
        transport="websocket"
        :temperature="0.7"
        :max-tokens="500"
        @message="onMessage"
        @error="onError"
      />
    </div>
    
    <!-- Customized Chat -->
    <div class="example-section">
      <h3>Customized Chat</h3>
      <AIChat
        title="Custom AI Helper"
        welcome-message="I'm a specialized assistant with custom styling!"
        placeholder="Ask me anything..."
        height="300px"
        :provider="provider"
        :model="model"
        :system-prompt="systemPrompt"
        :show-input-footer="false"
        @message="onMessage"
        @error="onError"
      >
        <!-- Custom avatar slots -->
        <template #avatar-user>
          <div class="custom-avatar user-avatar">👤</div>
        </template>
        <template #avatar-assistant>
          <div class="custom-avatar assistant-avatar">🤖</div>
        </template>
      </AIChat>
    </div>
    
    <!-- Configuration Panel -->
    <div class="config-panel">
      <h3>Configuration</h3>
      <div class="config-grid">
        <div class="config-item">
          <label for="provider">Provider:</label>
          <select id="provider" v-model="provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        
        <div class="config-item">
          <label for="model">Model:</label>
          <select id="model" v-model="model">
            <option v-for="modelOption in availableModels" :key="modelOption" :value="modelOption">
              {{ modelOption }}
            </option>
          </select>
        </div>
        
        <div class="config-item">
          <label for="system-prompt">System Prompt:</label>
          <textarea 
            id="system-prompt" 
            v-model="systemPrompt" 
            rows="3"
            placeholder="Enter system prompt..."
          ></textarea>
        </div>
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
          :class="`log-entry--${event.type}`"
        >
          <span class="log-timestamp">{{ formatTimestamp(event.timestamp) }}</span>
          <span class="log-type">{{ event.type.toUpperCase() }}</span>
          <span class="log-message">{{ event.message }}</span>
        </div>
      </div>
      <button @click="clearLog" class="clear-log-btn">Clear Log</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AIChat from '../AIChat.vue'
import type { Message } from '@ai-nuxt/core'

// Configuration
const provider = ref('openai')
const model = ref('gpt-4')
const systemPrompt = ref('You are a helpful AI assistant. Be concise and friendly in your responses.')

// Event log
interface LogEvent {
  type: 'message' | 'error'
  message: string
  timestamp: Date
}

const eventLog = ref<LogEvent[]>([])

// Available models based on provider
const availableModels = computed(() => {
  switch (provider.value) {
    case 'openai':
      return ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
    case 'anthropic':
      return ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
    case 'ollama':
      return ['llama2', 'codellama', 'mistral']
    default:
      return ['gpt-4']
  }
})

// Event handlers
const onMessage = (message: Message) => {
  eventLog.value.push({
    type: 'message',
    message: `${message.role}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
    timestamp: new Date()
  })
}

const onError = (error: string) => {
  eventLog.value.push({
    type: 'error',
    message: error,
    timestamp: new Date()
  })
}

const clearLog = () => {
  eventLog.value = []
}

const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString()
}
</script>

<style scoped>
.ai-chat-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-chat-example h2 {
  text-align: center;
  color: #1e293b;
  margin-bottom: 2rem;
}

.example-section {
  margin-bottom: 3rem;
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

.custom-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.assistant-avatar {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-item label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.config-item select,
.config-item textarea {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-item select:focus,
.config-item textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  max-height: 300px;
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
  font-size: 0.875rem;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry--message {
  background: #f0f9ff;
}

.log-entry--error {
  background: #fef2f2;
}

.log-timestamp {
  color: #6b7280;
  min-width: 80px;
}

.log-type {
  font-weight: 600;
  min-width: 60px;
}

.log-type--MESSAGE {
  color: #059669;
}

.log-type--ERROR {
  color: #dc2626;
}

.log-message {
  flex: 1;
  color: #374151;
}

.clear-log-btn {
  padding: 0.5rem 1rem;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-log-btn:hover {
  background: #4b5563;
}

/* Responsive design */
@media (max-width: 768px) {
  .ai-chat-example {
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