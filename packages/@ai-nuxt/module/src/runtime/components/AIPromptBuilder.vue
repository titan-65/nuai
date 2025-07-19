<template>
  <div class="ai-prompt-builder">
    <!-- Header -->
    <div class="ai-prompt-builder__header">
      <h3 class="ai-prompt-builder__title">{{ title }}</h3>
      <div class="ai-prompt-builder__actions">
        <button
          @click="clearPrompt"
          class="ai-prompt-builder__action-button ai-prompt-builder__action-button--secondary"
          :disabled="disabled"
          type="button"
        >
          Clear
        </button>
        <button
          @click="saveTemplate"
          class="ai-prompt-builder__action-button ai-prompt-builder__action-button--secondary"
          :disabled="disabled || !canSaveTemplate"
          type="button"
        >
          Save Template
        </button>
        <button
          @click="exportPrompt"
          class="ai-prompt-builder__action-button ai-prompt-builder__action-button--primary"
          :disabled="disabled"
          type="button"
        >
          Export
        </button>
      </div>
    </div>

    <div class="ai-prompt-builder__content">
      <!-- Templates Sidebar -->
      <div class="ai-prompt-builder__sidebar">
        <div class="ai-prompt-builder__section">
          <h4 class="ai-prompt-builder__section-title">Templates</h4>
          <div class="ai-prompt-builder__templates">
            <div
              v-for="template in availableTemplates"
              :key="template.id"
              class="ai-prompt-builder__template"
              :class="{ 'ai-prompt-builder__template--active': selectedTemplate?.id === template.id }"
              @click="selectTemplate(template)"
            >
              <div class="ai-prompt-builder__template-header">
                <span class="ai-prompt-builder__template-name">{{ template.name }}</span>
                <span class="ai-prompt-builder__template-category">{{ template.category }}</span>
              </div>
              <p class="ai-prompt-builder__template-description">{{ template.description }}</p>
            </div>
          </div>
        </div>

        <div class="ai-prompt-builder__section">
          <h4 class="ai-prompt-builder__section-title">Elements</h4>
          <div class="ai-prompt-builder__elements">
            <div
              v-for="element in promptElements"
              :key="element.type"
              class="ai-prompt-builder__element"
              draggable="true"
              @dragstart="handleElementDragStart($event, element)"
            >
              <span class="ai-prompt-builder__element-icon">{{ element.icon }}</span>
              <span class="ai-prompt-builder__element-name">{{ element.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Builder Area -->
      <div class="ai-prompt-builder__main">
        <!-- Builder Canvas -->
        <div
          class="ai-prompt-builder__canvas"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          :class="{ 'ai-prompt-builder__canvas--drag-over': isDragOver }"
        >
          <div v-if="promptParts.length === 0" class="ai-prompt-builder__empty">
            <div class="ai-prompt-builder__empty-icon">🎯</div>
            <p class="ai-prompt-builder__empty-text">
              Drag elements here or select a template to start building your prompt
            </p>
          </div>

          <!-- Prompt Parts -->
          <div
            v-for="(part, index) in promptParts"
            :key="part.id"
            class="ai-prompt-builder__part"
            :class="`ai-prompt-builder__part--${part.type}`"
            @click="selectPart(part)"
          >
            <!-- Part Header -->
            <div class="ai-prompt-builder__part-header">
              <span class="ai-prompt-builder__part-icon">{{ getElementIcon(part.type) }}</span>
              <span class="ai-prompt-builder__part-title">{{ part.title || getElementName(part.type) }}</span>
              <div class="ai-prompt-builder__part-actions">
                <button
                  @click.stop="movePart(index, -1)"
                  :disabled="index === 0"
                  class="ai-prompt-builder__part-action"
                  title="Move up"
                  type="button"
                >
                  ↑
                </button>
                <button
                  @click.stop="movePart(index, 1)"
                  :disabled="index === promptParts.length - 1"
                  class="ai-prompt-builder__part-action"
                  title="Move down"
                  type="button"
                >
                  ↓
                </button>
                <button
                  @click.stop="duplicatePart(index)"
                  class="ai-prompt-builder__part-action"
                  title="Duplicate"
                  type="button"
                >
                  📋
                </button>
                <button
                  @click.stop="removePart(index)"
                  class="ai-prompt-builder__part-action ai-prompt-builder__part-action--danger"
                  title="Remove"
                  type="button"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Part Content -->
            <div class="ai-prompt-builder__part-content">
              <!-- System Message -->
              <div v-if="part.type === 'system'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">System Message:</label>
                <textarea
                  v-model="part.content"
                  class="ai-prompt-builder__textarea"
                  placeholder="Define the AI's role and behavior..."
                  rows="3"
                  @input="updatePrompt"
                ></textarea>
              </div>

              <!-- Context -->
              <div v-else-if="part.type === 'context'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Context:</label>
                <textarea
                  v-model="part.content"
                  class="ai-prompt-builder__textarea"
                  placeholder="Provide background information..."
                  rows="3"
                  @input="updatePrompt"
                ></textarea>
              </div>

              <!-- Task -->
              <div v-else-if="part.type === 'task'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Task:</label>
                <textarea
                  v-model="part.content"
                  class="ai-prompt-builder__textarea"
                  placeholder="Describe what you want the AI to do..."
                  rows="2"
                  @input="updatePrompt"
                ></textarea>
              </div>

              <!-- Examples -->
              <div v-else-if="part.type === 'examples'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Examples:</label>
                <div class="ai-prompt-builder__examples">
                  <div
                    v-for="(example, exampleIndex) in part.examples"
                    :key="exampleIndex"
                    class="ai-prompt-builder__example"
                  >
                    <input
                      v-model="example.input"
                      class="ai-prompt-builder__input"
                      placeholder="Input example..."
                      @input="updatePrompt"
                    />
                    <input
                      v-model="example.output"
                      class="ai-prompt-builder__input"
                      placeholder="Expected output..."
                      @input="updatePrompt"
                    />
                    <button
                      @click="removeExample(part, exampleIndex)"
                      class="ai-prompt-builder__remove-example"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    @click="addExample(part)"
                    class="ai-prompt-builder__add-example"
                    type="button"
                  >
                    + Add Example
                  </button>
                </div>
              </div>

              <!-- Constraints -->
              <div v-else-if="part.type === 'constraints'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Constraints:</label>
                <div class="ai-prompt-builder__constraints">
                  <div
                    v-for="(constraint, constraintIndex) in part.constraints"
                    :key="constraintIndex"
                    class="ai-prompt-builder__constraint"
                  >
                    <input
                      v-model="part.constraints[constraintIndex]"
                      class="ai-prompt-builder__input"
                      placeholder="Add a constraint..."
                      @input="updatePrompt"
                    />
                    <button
                      @click="removeConstraint(part, constraintIndex)"
                      class="ai-prompt-builder__remove-constraint"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    @click="addConstraint(part)"
                    class="ai-prompt-builder__add-constraint"
                    type="button"
                  >
                    + Add Constraint
                  </button>
                </div>
              </div>

              <!-- Output Format -->
              <div v-else-if="part.type === 'output'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Output Format:</label>
                <select
                  v-model="part.format"
                  class="ai-prompt-builder__select"
                  @change="updatePrompt"
                >
                  <option value="text">Plain Text</option>
                  <option value="json">JSON</option>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                  <option value="code">Code</option>
                  <option value="list">List</option>
                </select>
                <textarea
                  v-model="part.content"
                  class="ai-prompt-builder__textarea"
                  placeholder="Describe the desired output format..."
                  rows="2"
                  @input="updatePrompt"
                ></textarea>
              </div>

              <!-- Custom -->
              <div v-else-if="part.type === 'custom'" class="ai-prompt-builder__field">
                <label class="ai-prompt-builder__label">Custom Content:</label>
                <input
                  v-model="part.title"
                  class="ai-prompt-builder__input"
                  placeholder="Section title..."
                  @input="updatePrompt"
                />
                <textarea
                  v-model="part.content"
                  class="ai-prompt-builder__textarea"
                  placeholder="Enter your custom content..."
                  rows="3"
                  @input="updatePrompt"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="ai-prompt-builder__preview">
          <div class="ai-prompt-builder__preview-header">
            <h4 class="ai-prompt-builder__preview-title">Preview</h4>
            <div class="ai-prompt-builder__preview-actions">
              <button
                @click="copyPrompt"
                class="ai-prompt-builder__preview-action"
                title="Copy to clipboard"
                type="button"
              >
                📋
              </button>
              <button
                @click="togglePreviewMode"
                class="ai-prompt-builder__preview-action"
                :title="previewMode === 'formatted' ? 'Show raw' : 'Show formatted'"
                type="button"
              >
                {{ previewMode === 'formatted' ? '📝' : '🎨' }}
              </button>
            </div>
          </div>
          <div class="ai-prompt-builder__preview-content">
            <div v-if="previewMode === 'formatted'" class="ai-prompt-builder__preview-formatted">
              <div
                v-for="part in promptParts"
                :key="part.id"
                class="ai-prompt-builder__preview-part"
              >
                <div class="ai-prompt-builder__preview-part-title">
                  {{ part.title || getElementName(part.type) }}
                </div>
                <div class="ai-prompt-builder__preview-part-content">
                  {{ formatPartForPreview(part) }}
                </div>
              </div>
            </div>
            <pre v-else class="ai-prompt-builder__preview-raw">{{ finalPrompt }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Save Modal -->
    <div v-if="showSaveModal" class="ai-prompt-builder__modal-overlay" @click="closeSaveModal">
      <div class="ai-prompt-builder__modal" @click.stop>
        <div class="ai-prompt-builder__modal-header">
          <h3>Save Template</h3>
          <button @click="closeSaveModal" class="ai-prompt-builder__modal-close">×</button>
        </div>
        <div class="ai-prompt-builder__modal-content">
          <div class="ai-prompt-builder__field">
            <label class="ai-prompt-builder__label">Template Name:</label>
            <input
              v-model="newTemplate.name"
              class="ai-prompt-builder__input"
              placeholder="Enter template name..."
            />
          </div>
          <div class="ai-prompt-builder__field">
            <label class="ai-prompt-builder__label">Category:</label>
            <select v-model="newTemplate.category" class="ai-prompt-builder__select">
              <option value="general">General</option>
              <option value="writing">Writing</option>
              <option value="analysis">Analysis</option>
              <option value="coding">Coding</option>
              <option value="creative">Creative</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div class="ai-prompt-builder__field">
            <label class="ai-prompt-builder__label">Description:</label>
            <textarea
              v-model="newTemplate.description"
              class="ai-prompt-builder__textarea"
              placeholder="Describe what this template is for..."
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="ai-prompt-builder__modal-actions">
          <button @click="closeSaveModal" class="ai-prompt-builder__action-button ai-prompt-builder__action-button--secondary">
            Cancel
          </button>
          <button @click="confirmSaveTemplate" class="ai-prompt-builder__action-button ai-prompt-builder__action-button--primary">
            Save Template
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

// Types
export interface PromptPart {
  id: string
  type: 'system' | 'context' | 'task' | 'examples' | 'constraints' | 'output' | 'custom'
  title?: string
  content?: string
  format?: string
  examples?: Array<{ input: string; output: string }>
  constraints?: string[]
}

export interface PromptTemplate {
  id: string
  name: string
  category: string
  description: string
  parts: PromptPart[]
}

export interface PromptElement {
  type: PromptPart['type']
  name: string
  icon: string
  description: string
}

export interface AIPromptBuilderProps {
  title?: string
  disabled?: boolean
  templates?: PromptTemplate[]
  modelValue?: string
}

const props = withDefaults(defineProps<AIPromptBuilderProps>(), {
  title: 'Prompt Builder',
  disabled: false,
  templates: () => [],
  modelValue: ''
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  export: [prompt: string, parts: PromptPart[]]
  'template-save': [template: PromptTemplate]
  'template-select': [template: PromptTemplate]
}>()

// State
const promptParts = ref<PromptPart[]>([])
const selectedTemplate = ref<PromptTemplate | null>(null)
const isDragOver = ref(false)
const previewMode = ref<'formatted' | 'raw'>('formatted')
const showSaveModal = ref(false)
const newTemplate = ref({
  name: '',
  category: 'general',
  description: ''
})

// Prompt elements that can be dragged
const promptElements: PromptElement[] = [
  {
    type: 'system',
    name: 'System Message',
    icon: '⚙️',
    description: 'Define the AI\'s role and behavior'
  },
  {
    type: 'context',
    name: 'Context',
    icon: '📋',
    description: 'Provide background information'
  },
  {
    type: 'task',
    name: 'Task',
    icon: '🎯',
    description: 'Describe what you want the AI to do'
  },
  {
    type: 'examples',
    name: 'Examples',
    icon: '💡',
    description: 'Show input/output examples'
  },
  {
    type: 'constraints',
    name: 'Constraints',
    icon: '🚫',
    description: 'Set limitations and rules'
  },
  {
    type: 'output',
    name: 'Output Format',
    icon: '📄',
    description: 'Specify the desired output format'
  },
  {
    type: 'custom',
    name: 'Custom',
    icon: '✏️',
    description: 'Add custom content'
  }
]

// Default templates
const defaultTemplates: PromptTemplate[] = [
  {
    id: 'writing-assistant',
    name: 'Writing Assistant',
    category: 'writing',
    description: 'Help with writing tasks like essays, articles, and creative content',
    parts: [
      {
        id: '1',
        type: 'system',
        content: 'You are a professional writing assistant. Help users improve their writing with clear, constructive feedback and suggestions.'
      },
      {
        id: '2',
        type: 'task',
        content: 'Review and improve the following text for clarity, grammar, and style.'
      },
      {
        id: '3',
        type: 'output',
        format: 'markdown',
        content: 'Provide the improved text followed by a brief explanation of changes made.'
      }
    ]
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    category: 'coding',
    description: 'Review code for best practices, bugs, and improvements',
    parts: [
      {
        id: '1',
        type: 'system',
        content: 'You are an experienced software engineer. Review code for best practices, potential bugs, security issues, and performance improvements.'
      },
      {
        id: '2',
        type: 'constraints',
        constraints: [
          'Focus on actionable feedback',
          'Explain the reasoning behind suggestions',
          'Consider maintainability and readability'
        ]
      },
      {
        id: '3',
        type: 'output',
        format: 'markdown',
        content: 'Provide feedback in sections: Issues Found, Suggestions, and Improved Code (if applicable).'
      }
    ]
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    category: 'analysis',
    description: 'Analyze data and provide insights',
    parts: [
      {
        id: '1',
        type: 'system',
        content: 'You are a data analyst. Analyze the provided data and extract meaningful insights.'
      },
      {
        id: '2',
        type: 'task',
        content: 'Analyze the following data and identify key trends, patterns, and insights.'
      },
      {
        id: '3',
        type: 'output',
        format: 'json',
        content: 'Structure your response as: {"summary": "", "key_insights": [], "recommendations": []}'
      }
    ]
  }
]

// Computed
const availableTemplates = computed(() => {
  return [...defaultTemplates, ...props.templates]
})

const canSaveTemplate = computed(() => {
  return promptParts.value.length > 0
})

const finalPrompt = computed(() => {
  return promptParts.value
    .map(part => formatPartForPrompt(part))
    .filter(Boolean)
    .join('\n\n')
})

// Methods
const generateId = () => {
  return `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const getElementIcon = (type: PromptPart['type']) => {
  return promptElements.find(el => el.type === type)?.icon || '📝'
}

const getElementName = (type: PromptPart['type']) => {
  return promptElements.find(el => el.type === type)?.name || 'Unknown'
}

const createPromptPart = (type: PromptPart['type']): PromptPart => {
  const base: PromptPart = {
    id: generateId(),
    type,
    content: ''
  }

  switch (type) {
    case 'examples':
      return { ...base, examples: [{ input: '', output: '' }] }
    case 'constraints':
      return { ...base, constraints: [''] }
    case 'output':
      return { ...base, format: 'text' }
    default:
      return base
  }
}

const selectTemplate = (template: PromptTemplate) => {
  selectedTemplate.value = template
  promptParts.value = template.parts.map(part => ({
    ...part,
    id: generateId() // Generate new IDs to avoid conflicts
  }))
  updatePrompt()
  emit('template-select', template)
}

const selectPart = (part: PromptPart) => {
  // Could be used for highlighting or editing
}

const movePart = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < promptParts.value.length) {
    const parts = [...promptParts.value]
    const [movedPart] = parts.splice(index, 1)
    parts.splice(newIndex, 0, movedPart)
    promptParts.value = parts
    updatePrompt()
  }
}

const duplicatePart = (index: number) => {
  const originalPart = promptParts.value[index]
  const duplicatedPart = {
    ...JSON.parse(JSON.stringify(originalPart)),
    id: generateId()
  }
  promptParts.value.splice(index + 1, 0, duplicatedPart)
  updatePrompt()
}

const removePart = (index: number) => {
  promptParts.value.splice(index, 1)
  updatePrompt()
}

const addExample = (part: PromptPart) => {
  if (part.examples) {
    part.examples.push({ input: '', output: '' })
  }
  updatePrompt()
}

const removeExample = (part: PromptPart, index: number) => {
  if (part.examples) {
    part.examples.splice(index, 1)
  }
  updatePrompt()
}

const addConstraint = (part: PromptPart) => {
  if (part.constraints) {
    part.constraints.push('')
  }
  updatePrompt()
}

const removeConstraint = (part: PromptPart, index: number) => {
  if (part.constraints) {
    part.constraints.splice(index, 1)
  }
  updatePrompt()
}

const formatPartForPrompt = (part: PromptPart): string => {
  switch (part.type) {
    case 'system':
      return `SYSTEM: ${part.content}`
    
    case 'context':
      return `CONTEXT:\n${part.content}`
    
    case 'task':
      return `TASK:\n${part.content}`
    
    case 'examples':
      if (part.examples && part.examples.length > 0) {
        const exampleText = part.examples
          .filter(ex => ex.input || ex.output)
          .map(ex => `Input: ${ex.input}\nOutput: ${ex.output}`)
          .join('\n\n')
        return `EXAMPLES:\n${exampleText}`
      }
      return ''
    
    case 'constraints':
      if (part.constraints && part.constraints.length > 0) {
        const constraintText = part.constraints
          .filter(Boolean)
          .map(c => `- ${c}`)
          .join('\n')
        return `CONSTRAINTS:\n${constraintText}`
      }
      return ''
    
    case 'output':
      let outputText = `OUTPUT FORMAT: ${part.format?.toUpperCase() || 'TEXT'}`
      if (part.content) {
        outputText += `\n${part.content}`
      }
      return outputText
    
    case 'custom':
      const title = part.title || 'CUSTOM'
      return `${title.toUpperCase()}:\n${part.content}`
    
    default:
      return part.content || ''
  }
}

const formatPartForPreview = (part: PromptPart): string => {
  switch (part.type) {
    case 'examples':
      return part.examples?.map(ex => `${ex.input} → ${ex.output}`).join(', ') || ''
    case 'constraints':
      return part.constraints?.filter(Boolean).join(', ') || ''
    case 'output':
      return `${part.format} - ${part.content}`
    default:
      return part.content || ''
  }
}

const updatePrompt = () => {
  const prompt = finalPrompt.value
  emit('update:modelValue', prompt)
}

const clearPrompt = () => {
  promptParts.value = []
  selectedTemplate.value = null
  updatePrompt()
}

const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(finalPrompt.value)
  } catch (error) {
    console.error('Failed to copy prompt:', error)
  }
}

const exportPrompt = () => {
  emit('export', finalPrompt.value, promptParts.value)
}

const togglePreviewMode = () => {
  previewMode.value = previewMode.value === 'formatted' ? 'raw' : 'formatted'
}

const saveTemplate = () => {
  if (canSaveTemplate.value) {
    showSaveModal.value = true
  }
}

const closeSaveModal = () => {
  showSaveModal.value = false
  newTemplate.value = {
    name: '',
    category: 'general',
    description: ''
  }
}

const confirmSaveTemplate = () => {
  if (newTemplate.value.name.trim()) {
    const template: PromptTemplate = {
      id: `custom_${Date.now()}`,
      name: newTemplate.value.name.trim(),
      category: newTemplate.value.category,
      description: newTemplate.value.description.trim(),
      parts: JSON.parse(JSON.stringify(promptParts.value))
    }
    
    emit('template-save', template)
    closeSaveModal()
  }
}

// Drag and Drop
const handleElementDragStart = (event: DragEvent, element: PromptElement) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', element.type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // Only set to false if we're leaving the canvas entirely
  if (!event.currentTarget?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false
  
  if (event.dataTransfer) {
    const elementType = event.dataTransfer.getData('text/plain') as PromptPart['type']
    if (elementType) {
      const newPart = createPromptPart(elementType)
      promptParts.value.push(newPart)
      updatePrompt()
    }
  }
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (newValue !== finalPrompt.value) {
    // Could parse the prompt back to parts if needed
  }
})

// Expose methods
defineExpose({
  clearPrompt,
  addPart: (type: PromptPart['type']) => {
    const newPart = createPromptPart(type)
    promptParts.value.push(newPart)
    updatePrompt()
  },
  loadTemplate: selectTemplate,
  exportPrompt: () => ({ prompt: finalPrompt.value, parts: promptParts.value })
})
</script>

<style scoped>
.ai-prompt-builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.ai-prompt-builder__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.ai-prompt-builder__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-prompt-builder__actions {
  display: flex;
  gap: 0.5rem;
}

.ai-prompt-builder__action-button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-prompt-builder__action-button--primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.ai-prompt-builder__action-button--primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.ai-prompt-builder__action-button--secondary {
  background: white;
  color: #374151;
}

.ai-prompt-builder__action-button--secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.ai-prompt-builder__action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Content */
.ai-prompt-builder__content {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Sidebar */
.ai-prompt-builder__sidebar {
  width: 280px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow-y: auto;
}

.ai-prompt-builder__section {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ai-prompt-builder__section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Templates */
.ai-prompt-builder__templates {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-prompt-builder__template {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-prompt-builder__template:hover {
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ai-prompt-builder__template--active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.ai-prompt-builder__template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.ai-prompt-builder__template-name {
  font-weight: 500;
  color: #1e293b;
}

.ai-prompt-builder__template-category {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.ai-prompt-builder__template-description {
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.4;
}

/* Elements */
.ai-prompt-builder__elements {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-prompt-builder__element {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: grab;
  transition: all 0.2s;
}

.ai-prompt-builder__element:hover {
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ai-prompt-builder__element:active {
  cursor: grabbing;
}

.ai-prompt-builder__element-icon {
  font-size: 1rem;
}

.ai-prompt-builder__element-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

/* Main Area */
.ai-prompt-builder__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Canvas */
.ai-prompt-builder__canvas {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  min-height: 300px;
  transition: background-color 0.2s;
}

.ai-prompt-builder__canvas--drag-over {
  background: #eff6ff;
}

.ai-prompt-builder__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6b7280;
  text-align: center;
}

.ai-prompt-builder__empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.ai-prompt-builder__empty-text {
  margin: 0;
  font-size: 1rem;
}

/* Parts */
.ai-prompt-builder__part {
  margin-bottom: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  transition: all 0.2s;
}

.ai-prompt-builder__part:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ai-prompt-builder__part-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 8px 8px 0 0;
}

.ai-prompt-builder__part-icon {
  font-size: 1rem;
}

.ai-prompt-builder__part-title {
  flex: 1;
  font-weight: 500;
  color: #1e293b;
}

.ai-prompt-builder__part-actions {
  display: flex;
  gap: 0.25rem;
}

.ai-prompt-builder__part-action {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.ai-prompt-builder__part-action:hover:not(:disabled) {
  background: #e5e7eb;
  color: #374151;
}

.ai-prompt-builder__part-action--danger:hover:not(:disabled) {
  background: #fecaca;
  color: #dc2626;
}

.ai-prompt-builder__part-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ai-prompt-builder__part-content {
  padding: 1rem;
}

/* Form Elements */
.ai-prompt-builder__field {
  margin-bottom: 1rem;
}

.ai-prompt-builder__field:last-child {
  margin-bottom: 0;
}

.ai-prompt-builder__label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.ai-prompt-builder__input,
.ai-prompt-builder__textarea,
.ai-prompt-builder__select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.ai-prompt-builder__input:focus,
.ai-prompt-builder__textarea:focus,
.ai-prompt-builder__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.ai-prompt-builder__textarea {
  resize: vertical;
  min-height: 60px;
}

/* Examples */
.ai-prompt-builder__examples {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-prompt-builder__example {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ai-prompt-builder__example .ai-prompt-builder__input {
  flex: 1;
}

.ai-prompt-builder__remove-example,
.ai-prompt-builder__remove-constraint {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #fecaca;
  color: #dc2626;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.ai-prompt-builder__add-example,
.ai-prompt-builder__add-constraint {
  padding: 0.5rem;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.ai-prompt-builder__add-example:hover,
.ai-prompt-builder__add-constraint:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

/* Constraints */
.ai-prompt-builder__constraints {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-prompt-builder__constraint {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ai-prompt-builder__constraint .ai-prompt-builder__input {
  flex: 1;
}

/* Preview */
.ai-prompt-builder__preview {
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.ai-prompt-builder__preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ai-prompt-builder__preview-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.ai-prompt-builder__preview-actions {
  display: flex;
  gap: 0.25rem;
}

.ai-prompt-builder__preview-action {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.ai-prompt-builder__preview-action:hover {
  background: #e5e7eb;
  color: #374151;
}

.ai-prompt-builder__preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.ai-prompt-builder__preview-formatted {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-prompt-builder__preview-part {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
}

.ai-prompt-builder__preview-part-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.ai-prompt-builder__preview-part-content {
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.4;
}

.ai-prompt-builder__preview-raw {
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #374151;
  white-space: pre-wrap;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* Modal */
.ai-prompt-builder__modal-overlay {
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

.ai-prompt-builder__modal {
  width: 90%;
  max-width: 500px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.ai-prompt-builder__modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ai-prompt-builder__modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-prompt-builder__modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
}

.ai-prompt-builder__modal-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.ai-prompt-builder__modal-content {
  padding: 1rem;
}

.ai-prompt-builder__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-prompt-builder__content {
    flex-direction: column;
  }
  
  .ai-prompt-builder__sidebar {
    width: 100%;
    max-height: 200px;
  }
  
  .ai-prompt-builder__section {
    padding: 0.75rem;
  }
  
  .ai-prompt-builder__templates,
  .ai-prompt-builder__elements {
    flex-direction: row;
    overflow-x: auto;
    gap: 0.5rem;
  }
  
  .ai-prompt-builder__template,
  .ai-prompt-builder__element {
    flex-shrink: 0;
    min-width: 200px;
  }
  
  .ai-prompt-builder__preview {
    max-height: 200px;
  }
}
</style>