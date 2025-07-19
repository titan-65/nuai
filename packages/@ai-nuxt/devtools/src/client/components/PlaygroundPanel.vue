<template>
  <div class="playground-panel">
    <div class="panel-header">
      <h2 class="panel-title">AI Playground</h2>
      <div class="panel-actions">
        <button class="action-button" @click="clearPlayground">
          <div class="i-carbon-clean" />
          Clear
        </button>
        <button class="action-button" @click="saveTemplate">
          <div class="i-carbon-save" />
          Save Template
        </button>
      </div>
    </div>

    <div class="playground-content">
      <div class="playground-config">
        <div class="config-section">
          <h3>Configuration</h3>
          <div class="config-grid">
            <div class="config-item">
              <label>Provider</label>
              <select v-model="config.provider" @change="onProviderChange">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>

            <div class="config-item">
              <label>Model</label>
              <select v-model="config.model">
                <option v-for="model in availableModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
            </div>

            <div class="config-item">
              <label>Temperature</label>
              <input 
                type="range" 
                v-model.number="config.temperature" 
                min="0" 
                max="2" 
                step="0.1"
                class="range-input"
              />
              <span class="range-value">{{ config.temperature }}</span>
            </div>

            <div class="config-item">
              <label>Max Tokens</label>
              <input 
                type="number" 
                v-model.number="config.maxTokens" 
                min="1" 
                max="4000"
                class="number-input"
              />
            </div>

            <div class="config-item">
              <label>Top P</label>
              <input 
                type="range" 
                v-model.number="config.topP" 
                min="0" 
                max="1" 
                step="0.01"
                class="range-input"
              />
              <span class="range-value">{{ config.topP }}</span>
            </div>

            <div class="config-item">
              <label>Frequency Penalty</label>
              <input 
                type="range" 
                v-model.number="config.frequencyPenalty" 
                min="-2" 
                max="2" 
                step="0.1"
                class="range-input"
              />
              <span class="range-value">{{ config.frequencyPenalty }}</span>
            </div>
          </div>
        </div>

        <div class="config-section">
          <h3>Templates</h3>
          <div class="templates-list">
            <button 
              v-for="template in templates" 
              :key="template.id"
              class="template-button"
              @click="loadTemplate(template)"
            >
              {{ template.name }}
            </button>
          </div>
        </div>
      </div>

      <div class="playground-workspace">
        <div class="workspace-section">
          <div class="section-header">
            <h3>System Prompt</h3>
            <button class="section-action" @click="clearSystemPrompt">
              <div class="i-carbon-clean" />
            </button>
          </div>
          <textarea 
            v-model="systemPrompt"
            placeholder="Enter system prompt (optional)..."
            class="prompt-textarea system-prompt"
          ></textarea>
        </div>

        <div class="workspace-section">
          <div class="section-header">
            <h3>User Prompt</h3>
            <button class="section-action" @click="clearUserPrompt">
              <div class="i-carbon-clean" />
            </button>
          </div>
          <textarea 
            v-model="userPrompt"
            placeholder="Enter your prompt here..."
            class="prompt-textarea user-prompt"
          ></textarea>
        </div>

        <div class="workspace-actions">
          <button 
            class="run-button" 
            @click="runPrompt"
            :disabled="isLoading || !userPrompt.trim()"
          >
            <div v-if="isLoading" class="i-carbon-circle-dash animate-spin" />
            <div v-else class="i-carbon-play" />
            {{ isLoading ? 'Running...' : 'Run Prompt' }}
          </button>
          
          <div class="run-info">
            <span class="token-count">
              Estimated tokens: {{ estimatedTokens }}
            </span>
            <span class="cost-estimate">
              Est. cost: ${{ estimatedCost.toFixed(6) }}
            </span>
          </div>
        </div>

        <div class="workspace-section">
          <div class="section-header">
            <h3>Response</h3>
            <div class="section-actions">
              <button class="section-action" @click="copyResponse">
                <div class="i-carbon-copy" />
              </button>
              <button class="section-action" @click="clearResponse">
                <div class="i-carbon-clean" />
              </button>
            </div>
          </div>
          <div class="response-container">
            <div v-if="!response && !isLoading" class="response-placeholder">
              Response will appear here after running a prompt
            </div>
            <div v-else-if="isLoading" class="response-loading">
              <div class="loading-spinner">
                <div class="i-carbon-circle-dash animate-spin" />
              </div>
              Generating response...
            </div>
            <div v-else class="response-content">
              <pre>{{ response }}</pre>
            </div>
          </div>
        </div>

        <div v-if="responseMetadata" class="workspace-section">
          <div class="section-header">
            <h3>Response Metadata</h3>
          </div>
          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="metadata-label">Response Time:</span>
              <span class="metadata-value">{{ responseMetadata.responseTime }}ms</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Tokens Used:</span>
              <span class="metadata-value">{{ responseMetadata.tokensUsed }}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Cost:</span>
              <span class="metadata-value">${{ responseMetadata.cost.toFixed(6) }}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Model:</span>
              <span class="metadata-value">{{ responseMetadata.model }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAIPlayground } from '../composables/useAIPlayground'

interface PlaygroundConfig {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
}

interface Template {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  config: PlaygroundConfig
}

interface ResponseMetadata {
  responseTime: number
  tokensUsed: number
  cost: number
  model: string
}

const { 
  availableModels, 
  templates, 
  runCompletion, 
  saveTemplate: saveTemplateToStore,
  estimateTokens,
  estimateCost
} = useAIPlayground()

const config = ref<PlaygroundConfig>({
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  topP: 1,
  frequencyPenalty: 0
})

const systemPrompt = ref('')
const userPrompt = ref('')
const response = ref('')
const isLoading = ref(false)
const responseMetadata = ref<ResponseMetadata | null>(null)

const estimatedTokens = computed(() => {
  const systemTokens = estimateTokens(systemPrompt.value)
  const userTokens = estimateTokens(userPrompt.value)
  return systemTokens + userTokens
})

const estimatedCost = computed(() => {
  return estimateCost(estimatedTokens.value, config.value.model)
})

function onProviderChange() {
  // Reset model when provider changes
  const models = availableModels.value.filter(m => m.provider === config.value.provider)
  if (models.length > 0) {
    config.value.model = models[0].id
  }
}

async function runPrompt() {
  if (!userPrompt.value.trim()) return

  isLoading.value = true
  response.value = ''
  responseMetadata.value = null

  try {
    const startTime = Date.now()
    const result = await runCompletion({
      provider: config.value.provider,
      model: config.value.model,
      messages: [
        ...(systemPrompt.value ? [{ role: 'system', content: systemPrompt.value }] : []),
        { role: 'user', content: userPrompt.value }
      ],
      temperature: config.value.temperature,
      max_tokens: config.value.maxTokens,
      top_p: config.value.topP,
      frequency_penalty: config.value.frequencyPenalty
    })

    response.value = result.content
    responseMetadata.value = {
      responseTime: Date.now() - startTime,
      tokensUsed: result.usage?.total_tokens || 0,
      cost: result.cost || 0,
      model: config.value.model
    }
  } catch (error) {
    response.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isLoading.value = false
  }
}

function clearPlayground() {
  systemPrompt.value = ''
  userPrompt.value = ''
  response.value = ''
  responseMetadata.value = null
}

function clearSystemPrompt() {
  systemPrompt.value = ''
}

function clearUserPrompt() {
  userPrompt.value = ''
}

function clearResponse() {
  response.value = ''
  responseMetadata.value = null
}

async function copyResponse() {
  if (response.value) {
    await navigator.clipboard.writeText(response.value)
  }
}

function loadTemplate(template: Template) {
  systemPrompt.value = template.systemPrompt
  userPrompt.value = template.userPrompt
  config.value = { ...template.config }
}

async function saveTemplate() {
  const name = prompt('Enter template name:')
  if (!name) return

  const template: Template = {
    id: Date.now().toString(),
    name,
    systemPrompt: systemPrompt.value,
    userPrompt: userPrompt.value,
    config: { ...config.value }
  }

  await saveTemplateToStore(template)
}

watch(() => config.value.provider, onProviderChange)
</script>

<style scoped>
.playground-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background-color: #e5e7eb;
}

.playground-content {
  flex: 1;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  overflow: hidden;
}

.playground-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.config-section {
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.config-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.config-item label {
  font-size: 0.875rem;
  font-weight: 500;
}

.config-item select,
.number-input {
  padding: 0.375rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.range-input {
  width: 100%;
}

.range-value {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.template-button {
  padding: 0.5rem;
  text-align: left;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #f9fafb;
  transition: background-color 0.2s ease;
}

.template-button:hover {
  background-color: #f3f4f6;
}

.playground-workspace {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.workspace-section {
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.section-actions {
  display: flex;
  gap: 0.25rem;
}

.section-action {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.section-action:hover {
  background-color: #e5e7eb;
}

.prompt-textarea {
  width: 100%;
  min-height: 100px;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  resize: vertical;
}

.system-prompt {
  min-height: 80px;
}

.user-prompt {
  min-height: 120px;
}

.workspace-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
}

.run-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  font-weight: 600;
  background-color: #4f46e5;
  color: white;
  transition: background-color 0.2s ease;
}

.run-button:hover:not(:disabled) {
  background-color: #3730a3;
}

.run-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.run-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.response-container {
  min-height: 200px;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.response-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
  font-style: italic;
}

.response-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  color: #6b7280;
}

.loading-spinner {
  font-size: 1.25rem;
}

.response-content {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.metadata-label {
  font-weight: 500;
  color: #6b7280;
}

.metadata-value {
  font-weight: 600;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .action-button {
    background-color: #374151;
  }

  .action-button:hover {
    background-color: #4b5563;
  }

  .config-section,
  .workspace-section {
    border-color: #374151;
    background-color: #1f2937;
  }

  .config-item select,
  .number-input,
  .prompt-textarea {
    border-color: #4b5563;
    background-color: #1f2937;
    color: #f9fafb;
  }

  .template-button {
    background-color: #111827;
  }

  .template-button:hover {
    background-color: #374151;
  }

  .section-action {
    background-color: #374151;
  }

  .section-action:hover {
    background-color: #4b5563;
  }

  .workspace-actions {
    background-color: #111827;
  }

  .response-container {
    border-color: #4b5563;
    background-color: #111827;
  }

  .metadata-item {
    background-color: #111827;
  }
}
</style>