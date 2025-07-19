<template>
  <div class="ai-prompt-builder-example">
    <h2>AI Prompt Builder Example</h2>
    
    <!-- Main Prompt Builder -->
    <div class="example-section">
      <AIPromptBuilder
        v-model="builtPrompt"
        title="Advanced Prompt Builder"
        :templates="customTemplates"
        :disabled="isDisabled"
        @export="handleExport"
        @template-save="handleTemplateSave"
        @template-select="handleTemplateSelect"
      />
    </div>
    
    <!-- Configuration Panel -->
    <div class="config-panel">
      <h3>Configuration</h3>
      <div class="config-grid">
        <label class="config-item">
          <input type="checkbox" v-model="isDisabled" />
          Disable Builder
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="showOutput" />
          Show Generated Prompt
        </label>
        
        <label class="config-item">
          <input type="checkbox" v-model="autoSave" />
          Auto-save Templates
        </label>
      </div>
    </div>
    
    <!-- Generated Prompt Output -->
    <div v-if="showOutput" class="output-section">
      <h3>Generated Prompt</h3>
      <div class="output-container">
        <pre class="output-content">{{ builtPrompt || 'No prompt generated yet...' }}</pre>
        <div class="output-actions">
          <button @click="copyToClipboard" class="action-btn">
            📋 Copy
          </button>
          <button @click="sendToAI" class="action-btn action-btn--primary">
            🚀 Send to AI
          </button>
        </div>
      </div>
    </div>
    
    <!-- Custom Templates -->
    <div class="templates-section">
      <h3>Custom Templates</h3>
      <div class="templates-grid">
        <div
          v-for="template in customTemplates"
          :key="template.id"
          class="template-card"
        >
          <div class="template-header">
            <h4 class="template-name">{{ template.name }}</h4>
            <span class="template-category">{{ template.category }}</span>
          </div>
          <p class="template-description">{{ template.description }}</p>
          <div class="template-actions">
            <button @click="loadTemplate(template)" class="template-btn">
              Load
            </button>
            <button @click="deleteTemplate(template.id)" class="template-btn template-btn--danger">
              Delete
            </button>
          </div>
        </div>
        
        <!-- Add Template Card -->
        <div class="template-card template-card--add" @click="showAddTemplate = true">
          <div class="add-template-content">
            <div class="add-template-icon">+</div>
            <p>Add Custom Template</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Usage Examples -->
    <div class="examples-section">
      <h3>Usage Examples</h3>
      <div class="examples-grid">
        <div class="example-card">
          <h4>Content Writing</h4>
          <p>Create prompts for blog posts, articles, and creative writing tasks.</p>
          <button @click="loadExample('writing')" class="example-btn">
            Try Example
          </button>
        </div>
        
        <div class="example-card">
          <h4>Code Review</h4>
          <p>Build prompts for code analysis, bug detection, and improvement suggestions.</p>
          <button @click="loadExample('code')" class="example-btn">
            Try Example
          </button>
        </div>
        
        <div class="example-card">
          <h4>Data Analysis</h4>
          <p>Construct prompts for data interpretation and insight generation.</p>
          <button @click="loadExample('data')" class="example-btn">
            Try Example
          </button>
        </div>
        
        <div class="example-card">
          <h4>Creative Tasks</h4>
          <p>Design prompts for storytelling, brainstorming, and creative projects.</p>
          <button @click="loadExample('creative')" class="example-btn">
            Try Example
          </button>
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
      <button @click="clearEventLog" class="clear-btn">Clear Log</button>
    </div>
    
    <!-- Add Template Modal -->
    <div v-if="showAddTemplate" class="modal-overlay" @click="closeAddTemplate">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Add Custom Template</h3>
          <button @click="closeAddTemplate" class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <div class="field">
            <label>Template Name:</label>
            <input v-model="newTemplate.name" placeholder="Enter template name..." />
          </div>
          <div class="field">
            <label>Category:</label>
            <select v-model="newTemplate.category">
              <option value="general">General</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
              <option value="coding">Coding</option>
              <option value="creative">Creative</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div class="field">
            <label>Description:</label>
            <textarea v-model="newTemplate.description" rows="3" placeholder="Describe the template..."></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeAddTemplate" class="action-btn">Cancel</button>
          <button @click="addCustomTemplate" class="action-btn action-btn--primary">Add Template</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AIPromptBuilder from '../AIPromptBuilder.vue'
import type { PromptTemplate, PromptPart } from '../AIPromptBuilder.vue'

// State
const builtPrompt = ref('')
const isDisabled = ref(false)
const showOutput = ref(true)
const autoSave = ref(false)
const showAddTemplate = ref(false)

const customTemplates = ref<PromptTemplate[]>([
  {
    id: 'email-writer',
    name: 'Email Writer',
    category: 'business',
    description: 'Create professional emails for various business purposes',
    parts: [
      {
        id: '1',
        type: 'system',
        content: 'You are a professional email writing assistant. Help create clear, concise, and appropriate business emails.'
      },
      {
        id: '2',
        type: 'context',
        content: 'Consider the relationship between sender and recipient, the purpose of the email, and the appropriate tone.'
      },
      {
        id: '3',
        type: 'task',
        content: 'Write a professional email based on the provided requirements.'
      },
      {
        id: '4',
        type: 'output',
        format: 'text',
        content: 'Provide the email with subject line, greeting, body, and closing.'
      }
    ]
  }
])

const newTemplate = ref({
  name: '',
  category: 'general',
  description: ''
})

// Event log
interface LogEvent {
  type: 'export' | 'save' | 'select' | 'load' | 'delete' | 'copy' | 'send'
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

const handleExport = (prompt: string, parts: PromptPart[]) => {
  addLogEvent('export', `Exported prompt with ${parts.length} parts`)
  console.log('Exported prompt:', { prompt, parts })
}

const handleTemplateSave = (template: PromptTemplate) => {
  customTemplates.value.push(template)
  addLogEvent('save', `Saved template: ${template.name}`)
  
  if (autoSave.value) {
    // In a real app, you'd save to localStorage or send to server
    localStorage.setItem('customTemplates', JSON.stringify(customTemplates.value))
  }
}

const handleTemplateSelect = (template: PromptTemplate) => {
  addLogEvent('select', `Selected template: ${template.name}`)
}

const loadTemplate = (template: PromptTemplate) => {
  // This would be handled by the AIPromptBuilder component
  addLogEvent('load', `Loaded template: ${template.name}`)
}

const deleteTemplate = (templateId: string) => {
  const index = customTemplates.value.findIndex(t => t.id === templateId)
  if (index !== -1) {
    const template = customTemplates.value[index]
    customTemplates.value.splice(index, 1)
    addLogEvent('delete', `Deleted template: ${template.name}`)
  }
}

const loadExample = (type: string) => {
  const examples = {
    writing: {
      name: 'Blog Post Writer',
      parts: [
        { type: 'system', content: 'You are a skilled content writer specializing in engaging blog posts.' },
        { type: 'task', content: 'Write a comprehensive blog post on the given topic.' },
        { type: 'constraints', constraints: ['Keep it under 1500 words', 'Include actionable tips', 'Use engaging headlines'] }
      ]
    },
    code: {
      name: 'Code Reviewer',
      parts: [
        { type: 'system', content: 'You are an experienced software engineer reviewing code for best practices.' },
        { type: 'task', content: 'Review the provided code and suggest improvements.' },
        { type: 'output', format: 'markdown', content: 'Provide feedback in sections: Issues, Suggestions, Improved Code' }
      ]
    },
    data: {
      name: 'Data Analyst',
      parts: [
        { type: 'system', content: 'You are a data analyst extracting insights from datasets.' },
        { type: 'task', content: 'Analyze the data and provide key insights and recommendations.' },
        { type: 'output', format: 'json', content: 'Structure as: {"insights": [], "recommendations": []}' }
      ]
    },
    creative: {
      name: 'Story Creator',
      parts: [
        { type: 'system', content: 'You are a creative storyteller with a vivid imagination.' },
        { type: 'context', content: 'Consider character development, plot structure, and engaging narrative.' },
        { type: 'task', content: 'Create an engaging story based on the provided prompt.' }
      ]
    }
  }
  
  const example = examples[type as keyof typeof examples]
  if (example) {
    addLogEvent('load', `Loaded ${example.name} example`)
    // In a real implementation, you'd load this into the prompt builder
  }
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(builtPrompt.value)
    addLogEvent('copy', 'Copied prompt to clipboard')
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const sendToAI = () => {
  addLogEvent('send', 'Sent prompt to AI (simulated)')
  // In a real app, this would send the prompt to an AI service
  console.log('Sending to AI:', builtPrompt.value)
}

const closeAddTemplate = () => {
  showAddTemplate.value = false
  newTemplate.value = {
    name: '',
    category: 'general',
    description: ''
  }
}

const addCustomTemplate = () => {
  if (newTemplate.value.name.trim()) {
    const template: PromptTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplate.value.name.trim(),
      category: newTemplate.value.category,
      description: newTemplate.value.description.trim(),
      parts: []
    }
    
    customTemplates.value.push(template)
    addLogEvent('save', `Added custom template: ${template.name}`)
    closeAddTemplate()
  }
}

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString()
}

const clearEventLog = () => {
  eventLog.value = []
}

// Load saved templates on mount
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('customTemplates')
  if (saved) {
    try {
      const savedTemplates = JSON.parse(saved)
      customTemplates.value.push(...savedTemplates)
    } catch (error) {
      console.error('Failed to load saved templates:', error)
    }
  }
}

// Watch for auto-save
watch(customTemplates, (newTemplates) => {
  if (autoSave.value && typeof window !== 'undefined') {
    localStorage.setItem('customTemplates', JSON.stringify(newTemplates))
  }
}, { deep: true })
</script>

<style scoped>
.ai-prompt-builder-example {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-prompt-builder-example h2 {
  text-align: center;
  color: #1e293b;
  margin-bottom: 2rem;
}

.example-section {
  margin-bottom: 2rem;
  height: 600px;
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

.output-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
}

.output-section h3 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.output-container {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.output-content {
  margin: 0;
  padding: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #374151;
  white-space: pre-wrap;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  max-height: 300px;
  overflow-y: auto;
}

.output-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
}

.action-btn--primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.action-btn--primary:hover {
  background: #2563eb;
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.template-card {
  padding: 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.template-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.template-card--add {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-style: dashed;
  color: #6b7280;
}

.template-card--add:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.add-template-content {
  text-align: center;
}

.add-template-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.template-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.template-category {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.template-description {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.4;
}

.template-actions {
  display: flex;
  gap: 0.5rem;
}

.template-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #374151;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.template-btn:hover {
  background: #f3f4f6;
}

.template-btn--danger {
  color: #dc2626;
  border-color: #fecaca;
}

.template-btn--danger:hover {
  background: #fef2f2;
}

.examples-section {
  margin-bottom: 2rem;
}

.examples-section h3 {
  margin-bottom: 1rem;
  color: #374151;
}

.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.example-card {
  padding: 1.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  text-align: center;
}

.example-card h4 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
}

.example-card p {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.example-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.example-btn:hover {
  background: #2563eb;
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

.log-entry--export { background: #f0f9ff; }
.log-entry--save { background: #f0fdf4; }
.log-entry--select { background: #fefce8; }
.log-entry--load { background: #f3e8ff; }
.log-entry--delete { background: #fef2f2; }
.log-entry--copy { background: #f0f9ff; }
.log-entry--send { background: #ecfdf5; }

.log-timestamp {
  color: #6b7280;
  min-width: 80px;
}

.log-type {
  font-weight: 600;
  min-width: 60px;
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
}

.clear-btn:hover {
  background: #4b5563;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 90%;
  max-width: 500px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  color: #1e293b;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 1.25rem;
}

.modal-close:hover {
  background: #f3f4f6;
}

.modal-content {
  padding: 1rem;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-family: inherit;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-prompt-builder-example {
    padding: 1rem;
  }
  
  .config-grid,
  .templates-grid,
  .examples-grid {
    grid-template-columns: 1fr;
  }
  
  .example-section {
    height: 500px;
  }
  
  .log-entry {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>