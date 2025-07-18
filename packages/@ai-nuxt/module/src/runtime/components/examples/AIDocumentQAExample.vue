<template>
  <div class="ai-document-qa-example">
    <div class="ai-document-qa-example__header">
      <h2>AI Document Q&A Example</h2>
      <p>Upload documents and ask questions about their content using RAG (Retrieval-Augmented Generation).</p>
    </div>

    <div class="ai-document-qa-example__demo">
      <AIDocumentQA
        ref="documentQA"
        title="Document Assistant"
        :supported-formats="supportedFormats"
        :max-allowed-documents="maxDocuments"
        :show-upload="true"
        :show-settings="true"
        :show-sources="true"
        :show-sources-toggle="true"
        :show-answer-metadata="true"
        :provider="selectedProvider"
        :model="selectedModel"
        :models="availableModels"
        question-placeholder="Ask me anything about your documents..."
        @ask="handleAsk"
        @upload="handleUpload"
        @remove="handleRemove"
        @error="handleError"
      />
    </div>

    <div class="ai-document-qa-example__controls">
      <div class="ai-document-qa-example__control-group">
        <h3>Configuration</h3>
        
        <div class="ai-document-qa-example__control">
          <label>Provider:</label>
          <select v-model="selectedProvider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
          </select>
        </div>

        <div class="ai-document-qa-example__control">
          <label>Model:</label>
          <select v-model="selectedModel">
            <option v-for="model in availableModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>

        <div class="ai-document-qa-example__control">
          <label>Max Documents:</label>
          <input 
            type="number" 
            v-model.number="maxDocuments" 
            min="1" 
            max="20"
          />
        </div>

        <div class="ai-document-qa-example__control">
          <label>Supported Formats:</label>
          <div class="ai-document-qa-example__formats">
            <label v-for="format in allFormats" :key="format" class="ai-document-qa-example__format-checkbox">
              <input 
                type="checkbox" 
                :value="format" 
                v-model="supportedFormats"
              />
              {{ format.toUpperCase() }}
            </label>
          </div>
        </div>
      </div>

      <div class="ai-document-qa-example__control-group">
        <h3>Actions</h3>
        
        <div class="ai-document-qa-example__actions">
          <button @click="addSampleDocument" class="ai-document-qa-example__action-button">
            Add Sample Document
          </button>
          
          <button @click="clearAllDocuments" class="ai-document-qa-example__action-button">
            Clear All Documents
          </button>
          
          <button @click="askSampleQuestion" class="ai-document-qa-example__action-button">
            Ask Sample Question
          </button>
        </div>
      </div>

      <div class="ai-document-qa-example__control-group">
        <h3>Activity Log</h3>
        <div class="ai-document-qa-example__log">
          <div 
            v-for="(entry, index) in activityLog" 
            :key="index" 
            class="ai-document-qa-example__log-entry"
            :class="`ai-document-qa-example__log-entry--${entry.type}`"
          >
            <span class="ai-document-qa-example__log-time">
              {{ formatTime(entry.timestamp) }}
            </span>
            <span class="ai-document-qa-example__log-message">
              {{ entry.message }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="ai-document-qa-example__stats">
      <div class="ai-document-qa-example__stat">
        <div class="ai-document-qa-example__stat-value">{{ stats.documentsUploaded }}</div>
        <div class="ai-document-qa-example__stat-label">Documents Uploaded</div>
      </div>
      <div class="ai-document-qa-example__stat">
        <div class="ai-document-qa-example__stat-value">{{ stats.questionsAsked }}</div>
        <div class="ai-document-qa-example__stat-label">Questions Asked</div>
      </div>
      <div class="ai-document-qa-example__stat">
        <div class="ai-document-qa-example__stat-value">{{ stats.errorsEncountered }}</div>
        <div class="ai-document-qa-example__stat-label">Errors</div>
      </div>
    </div>

    <div class="ai-document-qa-example__code">
      <h3>Usage Example</h3>
      <pre><code>{{ usageExample }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AIDocumentQA from '../AIDocumentQA.vue'
import type { VectorDocument } from '@ai-nuxt/core'

// State
const documentQA = ref<InstanceType<typeof AIDocumentQA> | null>(null)
const selectedProvider = ref('openai')
const selectedModel = ref('gpt-4')
const maxDocuments = ref(10)
const supportedFormats = ref(['txt', 'md', 'pdf', 'docx'])
const activityLog = ref<Array<{ type: string, message: string, timestamp: number }>>([])
const stats = ref({
  documentsUploaded: 0,
  questionsAsked: 0,
  errorsEncountered: 0
})

// Constants
const allFormats = ['txt', 'md', 'pdf', 'docx', 'json', 'csv']
const modelsByProvider = {
  openai: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  ollama: ['llama2', 'mistral', 'codellama']
}

// Computed
const availableModels = computed(() => {
  return modelsByProvider[selectedProvider.value as keyof typeof modelsByProvider] || []
})

const usageExample = computed(() => {
  return `<template>
  <AIDocumentQA
    title="My Document Assistant"
    :supported-formats="['txt', 'md', 'pdf']"
    :max-allowed-documents="5"
    provider="${selectedProvider.value}"
    model="${selectedModel.value}"
    @ask="handleQuestion"
    @upload="handleUpload"
    @error="handleError"
  />
</template>

<script setup>
import { AIDocumentQA } from '@ai-nuxt/module'

const handleQuestion = (question, answer) => {
  console.log('Question:', question)
  console.log('Answer:', answer)
}

const handleUpload = (document) => {
  console.log('Document uploaded:', document.metadata.filename)
}

const handleError = (error) => {
  console.error('Error:', error)
}
</script>`
})

// Methods
const handleAsk = (question: string, answer: string) => {
  stats.value.questionsAsked++
  addLogEntry('question', `Asked: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`)
  addLogEntry('answer', `Received answer (${answer.length} characters)`)
}

const handleUpload = (document: VectorDocument) => {
  stats.value.documentsUploaded++
  addLogEntry('upload', `Uploaded: ${document.metadata?.filename || 'Unknown file'}`)
}

const handleRemove = (documentId: string) => {
  addLogEntry('remove', `Removed document: ${documentId}`)
}

const handleError = (error: string) => {
  stats.value.errorsEncountered++
  addLogEntry('error', `Error: ${error}`)
}

const addLogEntry = (type: string, message: string) => {
  activityLog.value.unshift({
    type,
    message,
    timestamp: Date.now()
  })
  
  // Keep only last 50 entries
  if (activityLog.value.length > 50) {
    activityLog.value = activityLog.value.slice(0, 50)
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const addSampleDocument = async () => {
  if (!documentQA.value) return
  
  const sampleContent = `# Sample Document

This is a sample document for testing the AI Document Q&A component.

## Features

The AI Document Q&A component provides:

1. **Document Upload**: Support for multiple file formats including TXT, MD, PDF, and DOCX
2. **RAG Integration**: Uses Retrieval-Augmented Generation to provide context-aware answers
3. **Vector Search**: Implements semantic similarity search for relevant document chunks
4. **Interactive Chat**: Question and answer interface with source attribution
5. **Customizable Settings**: Configurable similarity thresholds and model parameters

## Use Cases

- Customer support knowledge base
- Research document analysis
- Educational content Q&A
- Technical documentation assistance
- Legal document review

## Technical Details

The component uses:
- Vector embeddings for document representation
- Cosine similarity for relevance scoring
- Context injection for AI prompts
- Streaming responses for better UX

This sample document demonstrates how the system can understand and answer questions about uploaded content.`

  const sampleDocument: VectorDocument = {
    id: `sample-${Date.now()}`,
    content: sampleContent,
    embedding: [],
    metadata: {
      filename: 'sample-document.md',
      type: 'text/markdown',
      size: sampleContent.length,
      uploadedAt: Date.now()
    }
  }

  try {
    await documentQA.value.addDocument(sampleDocument)
    addLogEntry('upload', 'Added sample document')
  } catch (error: any) {
    addLogEntry('error', `Failed to add sample document: ${error.message}`)
  }
}

const clearAllDocuments = async () => {
  if (!documentQA.value) return
  
  try {
    await documentQA.value.clearDocuments()
    addLogEntry('clear', 'Cleared all documents')
  } catch (error: any) {
    addLogEntry('error', `Failed to clear documents: ${error.message}`)
  }
}

const askSampleQuestion = () => {
  if (!documentQA.value) return
  
  const sampleQuestions = [
    "What are the main features of this component?",
    "How does RAG integration work?",
    "What file formats are supported?",
    "What are some use cases for this component?",
    "What technical details are mentioned?"
  ]
  
  const randomQuestion = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)]
  
  // Set the question in the component (this would need to be exposed)
  addLogEntry('info', `Sample question: ${randomQuestion}`)
}

// Watch for provider changes to update model
watch(selectedProvider, (newProvider) => {
  const models = modelsByProvider[newProvider as keyof typeof modelsByProvider]
  if (models && models.length > 0) {
    selectedModel.value = models[0]
  }
})

// Initialize
onMounted(() => {
  addLogEntry('info', 'AI Document Q&A Example initialized')
})
</script>

<style>
.ai-document-qa-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.ai-document-qa-example__header {
  text-align: center;
  margin-bottom: 2rem;
}

.ai-document-qa-example__header h2 {
  margin: 0 0 0.5rem 0;
  color: #2d3748;
}

.ai-document-qa-example__header p {
  color: #718096;
  font-size: 1.125rem;
}

.ai-document-qa-example__demo {
  margin-bottom: 2rem;
}

.ai-document-qa-example__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.ai-document-qa-example__control-group {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.ai-document-qa-example__control-group h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #4a5568;
  font-size: 1.125rem;
}

.ai-document-qa-example__control {
  margin-bottom: 1rem;
}

.ai-document-qa-example__control label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #4a5568;
}

.ai-document-qa-example__control select,
.ai-document-qa-example__control input[type="number"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
}

.ai-document-qa-example__formats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ai-document-qa-example__format-checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.ai-document-qa-example__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-document-qa-example__action-button {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.ai-document-qa-example__action-button:hover {
  background: #3182ce;
}

.ai-document-qa-example__log {
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.5rem;
}

.ai-document-qa-example__log-entry {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.875rem;
  border-bottom: 1px solid #f7fafc;
}

.ai-document-qa-example__log-entry:last-child {
  border-bottom: none;
}

.ai-document-qa-example__log-time {
  color: #718096;
  font-size: 0.75rem;
  white-space: nowrap;
}

.ai-document-qa-example__log-message {
  flex: 1;
}

.ai-document-qa-example__log-entry--error .ai-document-qa-example__log-message {
  color: #e53e3e;
}

.ai-document-qa-example__log-entry--upload .ai-document-qa-example__log-message {
  color: #38a169;
}

.ai-document-qa-example__log-entry--question .ai-document-qa-example__log-message {
  color: #3182ce;
}

.ai-document-qa-example__stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.ai-document-qa-example__stat {
  text-align: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  min-width: 120px;
}

.ai-document-qa-example__stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #4299e1;
  margin-bottom: 0.25rem;
}

.ai-document-qa-example__stat-label {
  font-size: 0.875rem;
  color: #718096;
}

.ai-document-qa-example__code {
  background: #2d3748;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
}

.ai-document-qa-example__code h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.ai-document-qa-example__code pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .ai-document-qa-example {
    padding: 1rem;
  }
  
  .ai-document-qa-example__controls {
    grid-template-columns: 1fr;
  }
  
  .ai-document-qa-example__stats {
    flex-direction: column;
    align-items: center;
  }
}
</style>