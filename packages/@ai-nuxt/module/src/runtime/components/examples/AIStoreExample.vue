<template>
  <div class="ai-store-example">
    <h2>AI Store Integration Example</h2>
    
    <!-- Global Statistics -->
    <div class="stats-panel">
      <h3>Global Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalConversations }}</div>
          <div class="stat-label">Conversations</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalMessages }}</div>
          <div class="stat-label">Messages</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalTokens.toLocaleString() }}</div>
          <div class="stat-label">Tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${{ stats.totalCost.toFixed(4) }}</div>
          <div class="stat-label">Total Cost</div>
        </div>
      </div>
    </div>

    <!-- Conversation Management -->
    <div class="conversation-panel">
      <div class="panel-header">
        <h3>Conversations</h3>
        <div class="panel-actions">
          <button @click="createNewConversation" class="btn btn-primary">
            New Conversation
          </button>
          <button @click="exportAllData" class="btn btn-secondary">
            Export All
          </button>
          <button @click="clearAllData" class="btn btn-danger">
            Clear All
          </button>
        </div>
      </div>

      <!-- Conversation List -->
      <div class="conversation-list">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ 'conversation-item--active': activeConversationId === conversation.id }"
          @click="setActiveConversation(conversation.id)"
        >
          <div class="conversation-header">
            <div class="conversation-title">{{ conversation.title }}</div>
            <div class="conversation-meta">
              <span class="conversation-date">{{ formatDate(conversation.updatedAt) }}</span>
              <span class="conversation-count">{{ conversation.messages.length }} messages</span>
            </div>
          </div>
          <div class="conversation-preview">
            {{ getConversationPreview(conversation) }}
          </div>
          <div class="conversation-actions">
            <button @click.stop="editConversation(conversation)" class="btn-icon" title="Edit">
              ✏️
            </button>
            <button @click.stop="exportConversation(conversation)" class="btn-icon" title="Export">
              📤
            </button>
            <button @click.stop="deleteConversation(conversation.id)" class="btn-icon" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Conversation -->
    <div v-if="activeConversation" class="chat-panel">
      <div class="panel-header">
        <h3>{{ activeConversation.title }}</h3>
        <div class="panel-actions">
          <select v-model="chatConfig.provider" @change="updateConversationSettings">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
          <select v-model="chatConfig.model" @change="updateConversationSettings">
            <option v-for="model in availableModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>
      </div>

      <!-- Messages -->
      <div class="messages-container">
        <div
          v-for="message in activeConversation.messages"
          :key="message.id"
          class="message"
          :class="`message--${message.role}`"
        >
          <div class="message-header">
            <span class="message-role">{{ message.role }}</span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            <div class="message-actions">
              <button @click="editMessage(message)" class="btn-icon" title="Edit">
                ✏️
              </button>
              <button @click="deleteMessage(message.id)" class="btn-icon" title="Delete">
                🗑️
              </button>
            </div>
          </div>
          <div class="message-content">{{ message.content }}</div>
          <div v-if="message.metadata" class="message-metadata">
            <span v-if="message.metadata.tokens">{{ message.metadata.tokens }} tokens</span>
            <span v-if="message.metadata.cost">${{ message.metadata.cost.toFixed(6) }}</span>
            <span v-if="message.metadata.model">{{ message.metadata.model }}</span>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div class="chat-input">
        <textarea
          v-model="newMessage"
          placeholder="Type your message..."
          @keydown.enter.prevent="sendMessage"
          :disabled="isLoading"
        ></textarea>
        <button @click="sendMessage" :disabled="!newMessage.trim() || isLoading" class="btn btn-primary">
          {{ isLoading ? 'Sending...' : 'Send' }}
        </button>
      </div>
    </div>

    <!-- Settings Panel -->
    <div class="settings-panel">
      <h3>Global Settings</h3>
      <div class="settings-grid">
        <div class="setting-item">
          <label>Default Provider:</label>
          <select v-model="globalSettings.defaultProvider" @change="updateGlobalSettings">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>
        <div class="setting-item">
          <label>Default Model:</label>
          <select v-model="globalSettings.defaultModel" @change="updateGlobalSettings">
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          </select>
        </div>
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              v-model="globalSettings.enablePersistence"
              @change="updateGlobalSettings"
            />
            Enable Persistence
          </label>
        </div>
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              v-model="globalSettings.enableCaching"
              @change="updateGlobalSettings"
            />
            Enable Caching
          </label>
        </div>
        <div class="setting-item">
          <label>
            <input
              type="checkbox"
              v-model="globalSettings.debugMode"
              @change="updateGlobalSettings"
            />
            Debug Mode
          </label>
        </div>
      </div>
    </div>

    <!-- Search and Filter -->
    <div class="search-panel">
      <h3>Search & Filter</h3>
      <div class="search-controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search conversations..."
          class="search-input"
        />
        <select v-model="filterProvider" class="filter-select">
          <option value="">All Providers</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama</option>
        </select>
        <input
          v-model="filterDateFrom"
          type="date"
          class="filter-date"
        />
        <input
          v-model="filterDateTo"
          type="date"
          class="filter-date"
        />
      </div>
      
      <div v-if="filteredConversations.length > 0" class="search-results">
        <h4>Search Results ({{ filteredConversations.length }})</h4>
        <div
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          class="search-result"
          @click="setActiveConversation(conversation.id)"
        >
          <div class="result-title">{{ conversation.title }}</div>
          <div class="result-meta">
            {{ conversation.settings.provider }} • {{ formatDate(conversation.updatedAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-panel">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{{ error }}</span>
        <button @click="clearError" class="btn-icon">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAIStore } from '../composables/useAIStore'
import { useAIChatStore } from '../composables/useAIChatStore'
import type { AIConversation, AIMessage } from '../stores/ai'

// Store integration
const aiStore = useAIStore()
const chatStore = useAIChatStore()

// Reactive state from store
const conversations = aiStore.conversations
const activeConversation = aiStore.activeConversation
const activeConversationId = aiStore.activeConversationId
const stats = aiStore.stats
const isLoading = aiStore.isLoading
const error = aiStore.error
const globalSettings = aiStore.globalSettings

// Local state
const newMessage = ref('')
const searchQuery = ref('')
const filterProvider = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')

// Chat configuration
const chatConfig = ref({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000
})

// Computed
const availableModels = computed(() => {
  const modelsByProvider = {
    openai: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    ollama: ['llama2', 'codellama', 'mistral']
  }
  return modelsByProvider[chatConfig.value.provider as keyof typeof modelsByProvider] || []
})

const filteredConversations = computed(() => {
  let filtered = conversations.value

  // Search by query
  if (searchQuery.value) {
    filtered = aiStore.searchConversations(searchQuery.value)
  }

  // Filter by provider
  if (filterProvider.value) {
    filtered = filtered.filter(conv => conv.settings.provider === filterProvider.value)
  }

  // Filter by date range
  if (filterDateFrom.value && filterDateTo.value) {
    const fromDate = new Date(filterDateFrom.value)
    const toDate = new Date(filterDateTo.value)
    filtered = filtered.filter(conv => 
      conv.createdAt >= fromDate && conv.createdAt <= toDate
    )
  }

  return filtered
})

// Methods
const createNewConversation = () => {
  const conversation = aiStore.createConversation(chatConfig.value)
  chatStore.loadConversation(conversation.id)
}

const setActiveConversation = (conversationId: string) => {
  aiStore.setActiveConversation(conversationId)
  chatStore.loadConversation(conversationId)
  
  // Update chat config from conversation settings
  if (activeConversation.value) {
    chatConfig.value = { ...activeConversation.value.settings }
  }
}

const deleteConversation = (conversationId: string) => {
  if (confirm('Are you sure you want to delete this conversation?')) {
    aiStore.deleteConversation(conversationId)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !activeConversation.value) return

  try {
    await chatStore.sendMessage(newMessage.value.trim())
    newMessage.value = ''
  } catch (err: any) {
    console.error('Failed to send message:', err)
  }
}

const editMessage = (message: AIMessage) => {
  const newContent = prompt('Edit message:', message.content)
  if (newContent && newContent !== message.content && activeConversation.value) {
    aiStore.updateMessage(activeConversation.value.id, message.id, {
      content: newContent
    })
  }
}

const deleteMessage = (messageId: string) => {
  if (confirm('Are you sure you want to delete this message?') && activeConversation.value) {
    aiStore.deleteMessage(activeConversation.value.id, messageId)
  }
}

const editConversation = (conversation: AIConversation) => {
  const newTitle = prompt('Edit conversation title:', conversation.title)
  if (newTitle && newTitle !== conversation.title) {
    aiStore.updateConversation(conversation.id, { title: newTitle })
  }
}

const exportConversation = (conversation: AIConversation) => {
  const data = JSON.stringify(conversation, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `conversation-${conversation.id}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

const exportAllData = () => {
  const data = aiStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `ai-conversations-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

const clearAllData = () => {
  if (confirm('Are you sure you want to clear all conversations and data? This cannot be undone.')) {
    aiStore.clearAllData()
  }
}

const updateConversationSettings = () => {
  if (activeConversation.value) {
    aiStore.updateConversationSettings(activeConversation.value.id, chatConfig.value)
  }
}

const updateGlobalSettings = () => {
  aiStore.updateGlobalSettings(globalSettings.value)
}

const clearError = () => {
  aiStore.setError(null)
}

// Utility functions
const formatDate = (date: Date): string => {
  return date.toLocaleDateString()
}

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString()
}

const getConversationPreview = (conversation: AIConversation): string => {
  const lastMessage = conversation.messages[conversation.messages.length - 1]
  if (!lastMessage) return 'No messages yet'
  
  const preview = lastMessage.content.substring(0, 100)
  return preview.length < lastMessage.content.length ? `${preview}...` : preview
}

// Watch for active conversation changes
watch(activeConversation, (newConv) => {
  if (newConv) {
    chatConfig.value = { ...newConv.settings }
  }
})
</script>

<style scoped>
.ai-store-example {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.ai-store-example h2 {
  grid-column: 1 / -1;
  text-align: center;
  color: #1e293b;
  margin-bottom: 2rem;
}

/* Stats Panel */
.stats-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.stats-panel h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.25rem;
}

/* Panel Styles */
.conversation-panel,
.chat-panel,
.settings-panel,
.search-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.panel-header h3 {
  margin: 0;
  color: #374151;
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f3f4f6;
}

/* Conversation List */
.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.conversation-item {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.conversation-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.conversation-item--active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.conversation-title {
  font-weight: 600;
  color: #1e293b;
}

.conversation-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.conversation-preview {
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.conversation-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

/* Messages */
.messages-container {
  flex: 1;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
}

.message--user {
  background: #eff6ff;
  margin-left: 2rem;
}

.message--assistant {
  background: #f0fdf4;
  margin-right: 2rem;
}

.message--system {
  background: #fef3c7;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.message-role {
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #374151;
}

.message-time {
  font-size: 0.75rem;
  color: #6b7280;
}

.message-actions {
  display: flex;
  gap: 0.25rem;
}

.message-content {
  white-space: pre-wrap;
  line-height: 1.5;
  color: #1e293b;
}

.message-metadata {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

/* Chat Input */
.chat-input {
  display: flex;
  gap: 0.5rem;
}

.chat-input textarea {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.chat-input textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Settings */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-item label {
  font-size: 0.875rem;
  color: #374151;
  min-width: 120px;
}

.setting-item select,
.setting-item input[type="text"] {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* Search */
.search-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.search-input,
.filter-select,
.filter-date {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
}

.search-result {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.search-result:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.result-title {
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.result-meta {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Error Panel */
.error-panel {
  grid-column: 1 / -1;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 1rem;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.error-icon {
  font-size: 1.25rem;
}

.error-message {
  flex: 1;
  color: #dc2626;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 1024px) {
  .ai-store-example {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .search-controls {
    flex-direction: column;
  }
  
  .search-input {
    min-width: auto;
  }
}

@media (max-width: 768px) {
  .ai-store-example {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .conversation-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .message--user {
    margin-left: 0;
  }
  
  .message--assistant {
    margin-right: 0;
  }
}
</style>