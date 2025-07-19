import { ComponentTemplate } from './index'

/**
 * Get component template
 */
export function getComponentTemplate(type: ComponentTemplate, name: string): string {
  switch (type) {
    case 'chat':
      return getChatComponentTemplate(name)
    case 'completion':
      return getCompletionComponentTemplate(name)
    case 'embedding':
      return getEmbeddingComponentTemplate(name)
    case 'agent':
      return getAgentComponentTemplate(name)
    case 'rag':
      return getRagComponentTemplate(name)
    default:
      return getChatComponentTemplate(name)
  }
}

/**
 * Chat component template
 */
function getChatComponentTemplate(name: string): string {
  return `<template>
  <div class="ai-chat-container">
    <div class="messages-container" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="[
          'message',
          message.role === 'user' ? 'user-message' : 'ai-message'
        ]"
      >
        <div class="message-content">
          {{ message.content }}
        </div>
        <div class="message-timestamp">
          {{ formatTime(message.timestamp) }}
        </div>
      </div>
      
      <div v-if="loading" class="message ai-message">
        <div class="message-content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="input-container">
      <textarea
        v-model="currentMessage"
        @keydown.enter.prevent="sendMessage"
        placeholder="Type your message..."
        class="message-input"
        rows="1"
      />
      <button
        @click="sendMessage"
        :disabled="!currentMessage.trim() || loading"
        class="send-button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const { chat } = useAI()

const messages = ref<Message[]>([])
const currentMessage = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLElement>()

async function sendMessage() {
  if (!currentMessage.value.trim() || loading.value) return
  
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: currentMessage.value,
    timestamp: new Date()
  }
  
  messages.value.push(userMessage)
  const messageText = currentMessage.value
  currentMessage.value = ''
  
  loading.value = true
  
  try {
    const response = await chat(messageText, {
      history: messages.value.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }))
    })
    
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date()
    }
    
    messages.value.push(aiMessage)
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date()
    }
    messages.value.push(errorMessage)
  } finally {
    loading.value = false
    nextTick(() => scrollToBottom())
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.ai-chat-container {
  @apply flex flex-col h-96 border rounded-lg bg-white;
}

.messages-container {
  @apply flex-1 overflow-y-auto p-4 space-y-4;
}

.message {
  @apply flex flex-col;
}

.user-message {
  @apply items-end;
}

.ai-message {
  @apply items-start;
}

.message-content {
  @apply max-w-xs lg:max-w-md px-4 py-2 rounded-lg;
}

.user-message .message-content {
  @apply bg-blue-500 text-white;
}

.ai-message .message-content {
  @apply bg-gray-200 text-gray-800;
}

.message-timestamp {
  @apply text-xs text-gray-500 mt-1;
}

.input-container {
  @apply flex items-end p-4 border-t;
}

.message-input {
  @apply flex-1 resize-none border rounded-lg px-3 py-2 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.send-button {
  @apply bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed;
}

.typing-indicator {
  @apply flex space-x-1;
}

.typing-indicator span {
  @apply w-2 h-2 bg-gray-400 rounded-full animate-pulse;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}
</style>`
}

/**
 * Completion component template
 */
function getCompletionComponentTemplate(name: string): string {
  return `<template>
  <div class="ai-completion-container">
    <div class="input-section">
      <label class="input-label">Prompt</label>
      <textarea
        v-model="prompt"
        placeholder="Enter your prompt..."
        class="prompt-input"
        rows="4"
      />
    </div>
    
    <div class="controls-section">
      <div class="control-group">
        <label class="control-label">Temperature</label>
        <input
          v-model="temperature"
          type="range"
          min="0"
          max="2"
          step="0.1"
          class="range-input"
        />
        <span class="control-value">{{ temperature }}</span>
      </div>
      
      <div class="control-group">
        <label class="control-label">Max Tokens</label>
        <input
          v-model="maxTokens"
          type="number"
          min="1"
          max="4000"
          class="number-input"
        />
      </div>
    </div>
    
    <button
      @click="complete"
      :disabled="!prompt.trim() || loading"
      class="complete-button"
    >
      {{ loading ? 'Generating...' : 'Complete Text' }}
    </button>
    
    <div v-if="result" class="result-section">
      <label class="input-label">Result</label>
      <div class="result-content">
        {{ result }}
      </div>
      <button @click="copyResult" class="copy-button">
        Copy Result
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { completion } = useAI()

const prompt = ref('')
const result = ref('')
const loading = ref(false)
const temperature = ref(0.7)
const maxTokens = ref(1000)

async function complete() {
  if (!prompt.value.trim()) return
  
  loading.value = true
  try {
    result.value = await completion(prompt.value, {
      temperature: temperature.value,
      maxTokens: maxTokens.value
    })
  } catch (error) {
    console.error('Completion error:', error)
    result.value = 'Error: Failed to generate completion'
  } finally {
    loading.value = false
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value)
    // Show success feedback
  } catch (error) {
    console.error('Copy error:', error)
  }
}
</script>

<style scoped>
.ai-completion-container {
  @apply space-y-6;
}

.input-section {
  @apply space-y-2;
}

.input-label {
  @apply block text-sm font-medium text-gray-700;
}

.prompt-input {
  @apply w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none;
}

.controls-section {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.control-group {
  @apply space-y-2;
}

.control-label {
  @apply block text-sm font-medium text-gray-700;
}

.range-input {
  @apply w-full;
}

.number-input {
  @apply w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.control-value {
  @apply text-sm text-gray-600;
}

.complete-button {
  @apply w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium;
}

.result-section {
  @apply space-y-2;
}

.result-content {
  @apply p-4 bg-gray-50 border rounded-lg whitespace-pre-wrap;
}

.copy-button {
  @apply bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 text-sm;
}
</style>`
}

/**
 * Embedding component template
 */
function getEmbeddingComponentTemplate(name: string): string {
  return `<template>
  <div class="ai-embedding-container">
    <div class="input-section">
      <label class="input-label">Text to Embed</label>
      <textarea
        v-model="text"
        placeholder="Enter text to generate embeddings..."
        class="text-input"
        rows="4"
      />
    </div>
    
    <button
      @click="generateEmbedding"
      :disabled="!text.trim() || loading"
      class="embed-button"
    >
      {{ loading ? 'Generating...' : 'Generate Embedding' }}
    </button>
    
    <div v-if="embedding" class="result-section">
      <label class="input-label">Embedding Vector</label>
      <div class="embedding-info">
        <p class="info-text">Dimensions: {{ embedding.length }}</p>
        <p class="info-text">First 10 values: {{ embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ') }}...</p>
      </div>
      
      <div class="embedding-actions">
        <button @click="copyEmbedding" class="action-button">
          Copy Vector
        </button>
        <button @click="downloadEmbedding" class="action-button">
          Download JSON
        </button>
      </div>
    </div>
    
    <div v-if="similaritySearch" class="similarity-section">
      <label class="input-label">Similarity Search</label>
      <input
        v-model="searchText"
        placeholder="Enter text to find similar content..."
        class="search-input"
      />
      <button
        @click="findSimilar"
        :disabled="!searchText.trim() || !embedding"
        class="search-button"
      >
        Find Similar
      </button>
      
      <div v-if="similarResults.length" class="results-list">
        <div
          v-for="result in similarResults"
          :key="result.id"
          class="result-item"
        >
          <div class="result-text">{{ result.text }}</div>
          <div class="result-score">Similarity: {{ result.score.toFixed(3) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SimilarResult {
  id: string
  text: string
  score: number
}

const { embedding: generateEmbeddingVector } = useAI()

const text = ref('')
const embedding = ref<number[]>([])
const loading = ref(false)
const similaritySearch = ref(true)
const searchText = ref('')
const similarResults = ref<SimilarResult[]>([])

async function generateEmbedding() {
  if (!text.value.trim()) return
  
  loading.value = true
  try {
    embedding.value = await generateEmbeddingVector(text.value)
  } catch (error) {
    console.error('Embedding error:', error)
  } finally {
    loading.value = false
  }
}

async function copyEmbedding() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(embedding.value))
    // Show success feedback
  } catch (error) {
    console.error('Copy error:', error)
  }
}

function downloadEmbedding() {
  const data = {
    text: text.value,
    embedding: embedding.value,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'embedding.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function findSimilar() {
  if (!searchText.value.trim() || !embedding.value.length) return
  
  try {
    const searchEmbedding = await generateEmbeddingVector(searchText.value)
    
    // Calculate cosine similarity (mock implementation)
    const similarity = calculateCosineSimilarity(embedding.value, searchEmbedding)
    
    similarResults.value = [{
      id: '1',
      text: text.value,
      score: similarity
    }]
  } catch (error) {
    console.error('Similarity search error:', error)
  }
}

function calculateCosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
</script>

<style scoped>
.ai-embedding-container {
  @apply space-y-6;
}

.input-section {
  @apply space-y-2;
}

.input-label {
  @apply block text-sm font-medium text-gray-700;
}

.text-input {
  @apply w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none;
}

.embed-button {
  @apply w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium;
}

.result-section {
  @apply space-y-4 p-4 bg-gray-50 rounded-lg;
}

.embedding-info {
  @apply space-y-1;
}

.info-text {
  @apply text-sm text-gray-600;
}

.embedding-actions {
  @apply flex space-x-2;
}

.action-button {
  @apply bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 text-sm;
}

.similarity-section {
  @apply space-y-4 p-4 border rounded-lg;
}

.search-input {
  @apply w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.search-button {
  @apply bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm;
}

.results-list {
  @apply space-y-2;
}

.result-item {
  @apply p-3 bg-white border rounded-lg;
}

.result-text {
  @apply text-sm;
}

.result-score {
  @apply text-xs text-gray-500 mt-1;
}
</style>`
}

/**
 * Agent component template
 */
function getAgentComponentTemplate(name: string): string {
  return `<template>
  <div class="ai-agent-container">
    <div class="agent-header">
      <h3 class="agent-title">{{ agentName }}</h3>
      <div class="agent-status" :class="statusClass">
        {{ status }}
      </div>
    </div>
    
    <div class="agent-controls">
      <select v-model="selectedAgent" class="agent-selector">
        <option v-for="agent in availableAgents" :key="agent.id" :value="agent.id">
          {{ agent.name }}
        </option>
      </select>
      
      <button
        @click="toggleAgent"
        :disabled="loading"
        class="toggle-button"
        :class="isActive ? 'stop-button' : 'start-button'"
      >
        {{ isActive ? 'Stop' : 'Start' }} Agent
      </button>
    </div>
    
    <div class="task-input">
      <textarea
        v-model="task"
        placeholder="Enter task for the agent..."
        class="task-textarea"
        rows="3"
      />
      <button
        @click="executeTask"
        :disabled="!task.trim() || !isActive || loading"
        class="execute-button"
      >
        {{ loading ? 'Executing...' : 'Execute Task' }}
      </button>
    </div>
    
    <div v-if="results.length" class="results-section">
      <h4 class="results-title">Execution Results</h4>
      <div class="results-list">
        <div
          v-for="result in results"
          :key="result.id"
          class="result-item"
        >
          <div class="result-header">
            <span class="result-task">{{ result.task }}</span>
            <span class="result-timestamp">{{ formatTime(result.timestamp) }}</span>
          </div>
          <div class="result-content">{{ result.result }}</div>
          <div v-if="result.error" class="result-error">
            Error: {{ result.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AgentResult {
  id: string
  task: string
  result: string
  error?: string
  timestamp: Date
}

interface Agent {
  id: string
  name: string
  description: string
}

const { agent } = useAI()

const selectedAgent = ref('assistant')
const agentName = ref('Assistant Agent')
const status = ref('Idle')
const isActive = ref(false)
const loading = ref(false)
const task = ref('')
const results = ref<AgentResult[]>([])

const availableAgents = ref<Agent[]>([
  { id: 'assistant', name: 'Assistant Agent', description: 'General purpose assistant' },
  { id: 'researcher', name: 'Research Agent', description: 'Information gathering and research' },
  { id: 'coder', name: 'Code Agent', description: 'Code generation and analysis' }
])

const statusClass = computed(() => ({
  'status-idle': status.value === 'Idle',
  'status-active': status.value === 'Active',
  'status-busy': status.value === 'Busy'
}))

async function toggleAgent() {
  loading.value = true
  try {
    if (isActive.value) {
      // Stop agent
      isActive.value = false
      status.value = 'Idle'
    } else {
      // Start agent
      isActive.value = true
      status.value = 'Active'
    }
  } catch (error) {
    console.error('Agent toggle error:', error)
  } finally {
    loading.value = false
  }
}

async function executeTask() {
  if (!task.value.trim() || !isActive.value) return
  
  loading.value = true
  status.value = 'Busy'
  
  const taskText = task.value
  task.value = ''
  
  try {
    const result = await agent(selectedAgent.value, taskText)
    
    results.value.unshift({
      id: Date.now().toString(),
      task: taskText,
      result,
      timestamp: new Date()
    })
  } catch (error) {
    results.value.unshift({
      id: Date.now().toString(),
      task: taskText,
      result: '',
      error: error.message || 'Unknown error',
      timestamp: new Date()
    })
  } finally {
    loading.value = false
    status.value = 'Active'
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

watch(selectedAgent, (newAgent) => {
  const agent = availableAgents.value.find(a => a.id === newAgent)
  if (agent) {
    agentName.value = agent.name
  }
})
</script>

<style scoped>
.ai-agent-container {
  @apply space-y-6;
}

.agent-header {
  @apply flex justify-between items-center;
}

.agent-title {
  @apply text-lg font-semibold;
}

.agent-status {
  @apply px-3 py-1 rounded-full text-sm font-medium;
}

.status-idle {
  @apply bg-gray-100 text-gray-800;
}

.status-active {
  @apply bg-green-100 text-green-800;
}

.status-busy {
  @apply bg-yellow-100 text-yellow-800;
}

.agent-controls {
  @apply flex space-x-4;
}

.agent-selector {
  @apply flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.toggle-button {
  @apply px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed;
}

.start-button {
  @apply bg-green-500 text-white hover:bg-green-600;
}

.stop-button {
  @apply bg-red-500 text-white hover:bg-red-600;
}

.task-input {
  @apply space-y-2;
}

.task-textarea {
  @apply w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none;
}

.execute-button {
  @apply w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium;
}

.results-section {
  @apply space-y-4;
}

.results-title {
  @apply text-lg font-semibold;
}

.results-list {
  @apply space-y-3;
}

.result-item {
  @apply p-4 border rounded-lg bg-gray-50;
}

.result-header {
  @apply flex justify-between items-start mb-2;
}

.result-task {
  @apply font-medium text-sm;
}

.result-timestamp {
  @apply text-xs text-gray-500;
}

.result-content {
  @apply text-sm whitespace-pre-wrap;
}

.result-error {
  @apply text-sm text-red-600 mt-2;
}
</style>`
}

/**
 * RAG component template
 */
function getRagComponentTemplate(name: string): string {
  return `<template>
  <div class="ai-rag-container">
    <div class="document-upload">
      <label class="upload-label">Upload Documents</label>
      <input
        type="file"
        @change="handleFileUpload"
        multiple
        accept=".txt,.pdf,.doc,.docx"
        class="file-input"
      />
      <div v-if="documents.length" class="document-list">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="document-item"
        >
          <span class="document-name">{{ doc.name }}</span>
          <button @click="removeDocument(doc.id)" class="remove-button">×</button>
        </div>
      </div>
    </div>
    
    <div class="query-section">
      <label class="query-label">Ask a Question</label>
      <textarea
        v-model="query"
        placeholder="Ask a question about your documents..."
        class="query-input"
        rows="3"
      />
      <button
        @click="askQuestion"
        :disabled="!query.trim() || !documents.length || loading"
        class="ask-button"
      >
        {{ loading ? 'Searching...' : 'Ask Question' }}
      </button>
    </div>
    
    <div v-if="answer" class="answer-section">
      <label class="answer-label">Answer</label>
      <div class="answer-content">{{ answer }}</div>
      
      <div v-if="sources.length" class="sources-section">
        <label class="sources-label">Sources</label>
        <div class="sources-list">
          <div
            v-for="source in sources"
            :key="source.id"
            class="source-item"
          >
            <div class="source-document">{{ source.document }}</div>
            <div class="source-excerpt">{{ source.excerpt }}</div>
            <div class="source-score">Relevance: {{ source.score.toFixed(3) }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="history.length" class="history-section">
      <label class="history-label">Question History</label>
      <div class="history-list">
        <div
          v-for="item in history"
          :key="item.id"
          class="history-item"
          @click="selectHistoryItem(item)"
        >
          <div class="history-question">{{ item.query }}</div>
          <div class="history-timestamp">{{ formatTime(item.timestamp) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Document {
  id: string
  name: string
  content: string
}

interface Source {
  id: string
  document: string
  excerpt: string
  score: number
}

interface HistoryItem {
  id: string
  query: string
  answer: string
  timestamp: Date
}

const { rag } = useAI()

const documents = ref<Document[]>([])
const query = ref('')
const answer = ref('')
const sources = ref<Source[]>([])
const loading = ref(false)
const history = ref<HistoryItem[]>([])

async function handleFileUpload(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files) return
  
  for (const file of Array.from(files)) {
    try {
      const content = await readFileContent(file)
      documents.value.push({
        id: Date.now().toString() + Math.random(),
        name: file.name,
        content
      })
    } catch (error) {
      console.error('File upload error:', error)
    }
  }
}

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function removeDocument(id: string) {
  documents.value = documents.value.filter(doc => doc.id !== id)
}

async function askQuestion() {
  if (!query.value.trim() || !documents.value.length) return
  
  loading.value = true
  const questionText = query.value
  
  try {
    const result = await rag(questionText, {
      documents: documents.value.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: { name: doc.name }
      }))
    })
    
    answer.value = result.answer
    sources.value = result.sources.map(source => ({
      id: source.id,
      document: source.metadata.name,
      excerpt: source.content.substring(0, 200) + '...',
      score: source.score
    }))
    
    // Add to history
    history.value.unshift({
      id: Date.now().toString(),
      query: questionText,
      answer: result.answer,
      timestamp: new Date()
    })
    
    query.value = ''
  } catch (error) {
    console.error('RAG error:', error)
    answer.value = 'Sorry, I encountered an error while processing your question.'
    sources.value = []
  } finally {
    loading.value = false
  }
}

function selectHistoryItem(item: HistoryItem) {
  query.value = item.query
  answer.value = item.answer
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.ai-rag-container {
  @apply space-y-6;
}

.upload-label,
.query-label,
.answer-label,
.sources-label,
.history-label {
  @apply block text-sm font-medium text-gray-700 mb-2;
}

.file-input {
  @apply w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent;
}

.document-list {
  @apply mt-3 space-y-2;
}

.document-item {
  @apply flex justify-between items-center p-2 bg-gray-50 rounded-lg;
}

.document-name {
  @apply text-sm;
}

.remove-button {
  @apply text-red-500 hover:text-red-700 font-bold text-lg;
}

.query-input {
  @apply w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none;
}

.ask-button {
  @apply w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium;
}

.answer-section {
  @apply space-y-4 p-4 bg-blue-50 rounded-lg;
}

.answer-content {
  @apply whitespace-pre-wrap;
}

.sources-section {
  @apply space-y-2;
}

.sources-list {
  @apply space-y-2;
}

.source-item {
  @apply p-3 bg-white border rounded-lg;
}

.source-document {
  @apply font-medium text-sm;
}

.source-excerpt {
  @apply text-sm text-gray-600 mt-1;
}

.source-score {
  @apply text-xs text-gray-500 mt-1;
}

.history-section {
  @apply space-y-2;
}

.history-list {
  @apply space-y-2 max-h-40 overflow-y-auto;
}

.history-item {
  @apply p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100;
}

.history-question {
  @apply text-sm font-medium;
}

.history-timestamp {
  @apply text-xs text-gray-500 mt-1;
}
</style>`
}