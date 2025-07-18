<template>
  <div class="ai-completion-example">
    <h2>AI Completion Example</h2>
    
    <!-- Basic Completion -->
    <div class="example-section">
      <h3>Basic Completion</h3>
      <AICompletion
        v-model="basicPrompt"
        v-model:result="basicResult"
        title="Text Completion"
        placeholder="Enter a prompt for text completion..."
        :provider="provider"
        :model="model"
        :temperature="temperature"
        :max-tokens="maxTokens"
        :stream="streaming"
        @submit="handleSubmit"
        @complete="handleComplete"
        @error="handleError"
      />
    </div>
    
    <!-- Advanced Completion -->
    <div class="example-section">
      <h3>Advanced Completion</h3>
      <AICompletion
        v-model="advancedPrompt"
        v-model:result="advancedResult"
        title="Advanced Text Generation"
        placeholder="Enter a more complex prompt..."
        :provider="provider"
        :models="availableModels"
        :temperature="temperature"
        :max-tokens="maxTokens"
        :stream="streaming"
        :render-as-markdown="renderMarkdown"
        result-title="Generated Content"
        @submit="handleSubmit"
        @complete="handleComplete"
        @error="handleError"
      />
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
          <label for="temperature">Temperature: {{ temperature.toFixed(1) }}</label>
          <input 
            id="temperature" 
            v-model="temperature" 
            type="range" 
            min="0" 
            max="2" 
            step="0.1"
          />
        </div>
        
        <div class="config-item">
          <label for="max-tokens">Max Tokens: {{ maxTokens }}</label>
          <input 
            id="max-tokens" 
            v-model.number="maxTokens" 
            type="range" 
            min="10" 
            max="1000" 
            step="10"
          />
        </div>
        
        <div class="config-item checkbox">
          <input id="streaming" type="checkbox" v-model="streaming" />
          <label for="streaming">Enable Streaming</label>
        </div>
        
        <div class="config-item checkbox">
          <input id="markdown" type="checkbox" v-model="renderMarkdown" />
          <label for="markdown">Render Markdown</label>
        </div>
      </div>
    </div>
    
    <!-- Prompt Templates -->
    <div class="templates-section">
      <h3>Prompt Templates</h3>
      <div class="templates-grid">
        <div 
          v-for="template in promptTemplates" 
          :key="template.id"
          class="template-card"
          @click="applyTemplate(template)"
        >
          <h4>{{ template.name }}</h4>
          <p>{{ template.description }}</p>
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
          <span class="log-timestamp">{{ formatTime(event.timestamp) }}</span>
          <span class="log-type">{{ event.type.toUpperCase() }}</span>
          <span class="log-message">{{ event.message }}</span>
        </div>
      </div>
      <button @click="clearLog" class="clear-log-btn">Clear Log</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AICompletion from '../AICompletion.vue'

// State
const basicPrompt = ref('')
const basicResult = ref('')
const advancedPrompt = ref('')
const advancedResult = ref('')

// Configuration
const provider = ref('openai')
const model = ref('gpt-4')
const temperature = ref(0.7)
const maxTokens = ref(256)
const streaming = ref(true)
const renderMarkdown = ref(true)

// Available models based on provider
const availableModels = ref([
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-4-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'llama2'
])

// Prompt templates
const promptTemplates = [
  {
    id: 'summarize',
    name: 'Summarize Text',
    description: 'Create a concise summary of the provided text',
    prompt: 'Please summarize the following text in a few sentences:\n\n'
  },
  {
    id: 'explain',
    name: 'Explain Concept',
    description: 'Explain a complex concept in simple terms',
    prompt: 'Explain the following concept in simple terms that anyone can understand:\n\n'
  },
  {
    id: 'improve',
    name: 'Improve Writing',
    description: 'Improve the clarity and style of the provided text',
    prompt: 'Please improve the following text for clarity, grammar, and style:\n\n'
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Ideas',
    description: 'Generate creative ideas on a topic',
    prompt: 'Brainstorm 5-7 creative ideas about the following topic:\n\n'
  },
  {
    id: 'code',
    name: 'Generate Code',
    description: 'Generate code based on requirements',
    prompt: 'Write code that accomplishes the following task. Include comments and explanations:\n\n'
  },
  {
    id: 'outline',
    name: 'Create Outline',
    description: 'Create a structured outline for content',
    prompt: 'Create a detailed outline for content about the following topic:\n\n'
  }
]

// Event log
interface LogEvent {
  type: 'submit' | 'complete' | 'error' | 'template'
  message: string
  timestamp: Date
}

const eventLog = ref<LogEvent[]>([])

// Methods
const addLogEvent = (type: LogEvent['type'], message: string) => {
  eventLog.value.push({
    type,
    message,
    timestamp: new Date()
  })
}

const handleSubmit = (prompt: string) => {
  addLogEvent('submit', `Submitted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`)
}

const handleComplete = (result: string, metadata: any) => {
  addLogEvent(
    'complete', 
    `Completion received: ${metadata.tokens} tokens, ${metadata.time}ms, model: ${metadata.model}`
  )
}

const handleError = (error: string) => {
  addLogEvent('error', `Error: ${error}`)
}

const applyTemplate = (template: typeof promptTemplates[0]) => {
  advancedPrompt.value = template.prompt
  addLogEvent('template', `Applied template: ${template.name}`)
}

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString()
}

const clearLog = () => {
  eventLog.value = []
}
</script>

<style scoped>
.ai-completion-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-completion-example h2 {
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

.config-item.checkbox {
  flex-direction: row;
  align-items: center;
}

.config-item label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.config-item select,
.config-item input[type="range"] {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-item select:focus,
.config-item input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.templates-section {
  margin-bottom: 2rem;
}

.templates-section h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.template-card {
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.template-card h4 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
}

.template-card p {
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
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
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry--submit {
  background: #eff6ff;
}

.log-entry--complete {
  background: #f0fdf4;
}

.log-entry--error {
  background: #fef2f2;
}

.log-entry--template {
  background: #fefce8;
}

.log-timestamp {
  color: #6b7280;
  font-family: monospace;
  min-width: 80px;
}

.log-type {
  font-weight: 600;
  min-width: 80px;
}

.log-entry--submit .log-type {
  color: #2563eb;
}

.log-entry--complete .log-type {
  color: #16a34a;
}

.log-entry--error .log-type {
  color: #dc2626;
}

.log-entry--template .log-type {
  color: #ca8a04;
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
  transition: background 0.2s;
}

.clear-log-btn:hover {
  background: #4b5563;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-completion-example {
    padding: 1rem;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .templates-grid {
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