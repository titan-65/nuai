<template>
  <div class="models-panel">
    <div class="panel-header">
      <h2 class="panel-title">AI Models</h2>
      <div class="panel-actions">
        <button class="action-button" @click="refreshModels">
          <div class="i-carbon-refresh" />
          Refresh
        </button>
      </div>
    </div>

    <div class="models-grid">
      <div 
        v-for="model in models" 
        :key="model.id" 
        class="model-card"
        :class="{ 'model-active': model.active }"
      >
        <div class="model-header">
          <div class="model-icon-wrapper">
            <div :class="getModelIcon(model.type)" class="model-icon" />
          </div>
          <div class="model-info">
            <div class="model-name">{{ model.name }}</div>
            <div class="model-provider">{{ model.provider }}</div>
          </div>
          <div class="model-status" :class="model.active ? 'status-active' : 'status-inactive'">
            {{ model.active ? 'Active' : 'Inactive' }}
          </div>
        </div>

        <div class="model-details">
          <div class="detail-item">
            <div class="detail-label">Type:</div>
            <div class="detail-value">{{ model.type }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Context Length:</div>
            <div class="detail-value">{{ formatNumber(model.contextLength) }} tokens</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Max Output:</div>
            <div class="detail-value">{{ formatNumber(model.maxOutput) }} tokens</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Input Cost:</div>
            <div class="detail-value">${{ model.pricing.input }}/1K tokens</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Output Cost:</div>
            <div class="detail-value">${{ model.pricing.output }}/1K tokens</div>
          </div>
        </div>

        <div class="model-capabilities">
          <h4>Capabilities</h4>
          <div class="capabilities-list">
            <div 
              v-for="capability in model.capabilities" 
              :key="capability"
              class="capability-tag"
            >
              {{ capability }}
            </div>
          </div>
        </div>

        <div class="model-stats">
          <div class="stat-item">
            <div class="stat-label">Requests</div>
            <div class="stat-value">{{ model.stats.requests }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Avg. Latency</div>
            <div class="stat-value">{{ model.stats.avgLatency }}ms</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value">{{ model.stats.successRate }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Cost</div>
            <div class="stat-value">${{ model.stats.totalCost.toFixed(4) }}</div>
          </div>
        </div>

        <div class="model-actions">
          <button class="model-action-button" @click="testModel(model.id)">
            <div class="i-carbon-test" />
            Test Model
          </button>
          <button class="model-action-button" @click="viewModelDocs(model.id)">
            <div class="i-carbon-document" />
            Documentation
          </button>
          <button class="model-action-button" @click="openPlayground(model.id)">
            <div class="i-carbon-play" />
            Playground
          </button>
        </div>
      </div>
    </div>

    <div v-if="testResult" class="test-result" :class="testResult.success ? 'test-success' : 'test-error'">
      <div class="test-result-header">
        <h3>Model Test: {{ testResult.model }}</h3>
        <button class="close-button" @click="testResult = null">
          <div class="i-carbon-close" />
        </button>
      </div>
      <div class="test-result-content">
        <div class="test-status">
          <div v-if="testResult.success" class="i-carbon-checkmark-filled test-icon success" />
          <div v-else class="i-carbon-error-filled test-icon error" />
          {{ testResult.success ? 'Test Successful' : 'Test Failed' }}
        </div>
        <div class="test-metrics">
          <div class="metric">
            <span class="metric-label">Response Time:</span>
            <span class="metric-value">{{ testResult.responseTime }}ms</span>
          </div>
          <div class="metric">
            <span class="metric-label">Tokens Used:</span>
            <span class="metric-value">{{ testResult.tokensUsed }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Cost:</span>
            <span class="metric-value">${{ testResult.cost.toFixed(6) }}</span>
          </div>
        </div>
        <div class="test-prompt">
          <h4>Test Prompt</h4>
          <div class="code-block">
            <pre>{{ testResult.prompt }}</pre>
          </div>
        </div>
        <div class="test-response">
          <h4>Response</h4>
          <div class="code-block">
            <pre>{{ testResult.response }}</pre>
          </div>
        </div>
        <div v-if="testResult.error" class="test-error-details">
          <h4>Error Details</h4>
          <div class="code-block error">
            <pre>{{ testResult.error }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAIModels } from '../composables/useAIModels'

interface Model {
  id: string
  name: string
  provider: string
  type: string
  active: boolean
  contextLength: number
  maxOutput: number
  pricing: {
    input: number
    output: number
  }
  capabilities: string[]
  stats: {
    requests: number
    avgLatency: number
    successRate: number
    totalCost: number
  }
}

interface TestResult {
  model: string
  success: boolean
  responseTime: number
  tokensUsed: number
  cost: number
  prompt: string
  response: string
  error?: string
}

const { models, fetchModels, testModel: testModelConnection } = useAIModels()
const testResult = ref<TestResult | null>(null)

function getModelIcon(type: string) {
  switch (type) {
    case 'chat':
      return 'i-carbon-chat'
    case 'completion':
      return 'i-carbon-text-creation'
    case 'embedding':
      return 'i-carbon-vector'
    case 'image':
      return 'i-carbon-image'
    case 'audio':
      return 'i-carbon-microphone'
    default:
      return 'i-carbon-model-alt'
  }
}

function formatNumber(num: number) {
  return new Intl.NumberFormat().format(num)
}

async function testModel(modelId: string) {
  const result = await testModelConnection(modelId)
  testResult.value = {
    model: modelId,
    success: result.success,
    responseTime: result.responseTime,
    tokensUsed: result.tokensUsed,
    cost: result.cost,
    prompt: result.prompt,
    response: result.response,
    error: result.error
  }
}

function viewModelDocs(modelId: string) {
  const model = models.value.find(m => m.id === modelId)
  if (!model) return

  const docsUrls: Record<string, string> = {
    openai: 'https://platform.openai.com/docs/models',
    anthropic: 'https://docs.anthropic.com/claude/docs/models-overview',
    ollama: 'https://ollama.ai/library'
  }
  
  const url = docsUrls[model.provider] || 'https://ai-nuxt.dev/docs/models'
  window.open(url, '_blank')
}

function openPlayground(modelId: string) {
  // This would typically navigate to a playground tab or modal
  console.log('Opening playground for model:', modelId)
}

function refreshModels() {
  fetchModels()
}

// Initial fetch
fetchModels()
</script>

<style scoped>
.models-panel {
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

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
  overflow-y: auto;
}

.model-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  background-color: white;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.model-active {
  border-color: #4f46e5;
  box-shadow: 0 0 0 1px #4f46e5;
}

.model-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.model-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background-color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-icon {
  font-size: 1.5rem;
}

.model-info {
  flex: 1;
}

.model-name {
  font-size: 1.125rem;
  font-weight: 600;
}

.model-provider {
  font-size: 0.875rem;
  color: #6b7280;
}

.model-status {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  text-transform: uppercase;
}

.status-active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-inactive {
  background-color: #f3f4f6;
  color: #6b7280;
}

.model-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.detail-label {
  color: #6b7280;
}

.detail-value {
  font-weight: 500;
}

.model-capabilities h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.capabilities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.capability-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  background-color: #e5e7eb;
  color: #374151;
  border-radius: 0.25rem;
}

.model-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.stat-item {
  background-color: #f9fafb;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
}

.model-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.model-action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.model-action-button:hover {
  background-color: #e5e7eb;
}

.test-result {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  max-height: 80vh;
  border-radius: 0.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  z-index: 50;
}

.test-success {
  border: 1px solid #10b981;
  background-color: white;
}

.test-error {
  border: 1px solid #ef4444;
  background-color: white;
}

.test-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.test-result-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.close-button {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background-color: #e5e7eb;
}

.test-result-content {
  padding: 1rem;
  overflow-y: auto;
  max-height: calc(80vh - 60px);
}

.test-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.test-icon {
  font-size: 1.25rem;
}

.test-icon.success {
  color: #10b981;
}

.test-icon.error {
  color: #ef4444;
}

.test-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.metric-value {
  font-weight: 600;
}

.test-prompt,
.test-response,
.test-error-details {
  margin-bottom: 1rem;
}

.test-prompt h4,
.test-response h4,
.test-error-details h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.code-block {
  padding: 0.75rem;
  background-color: #f3f4f6;
  border-radius: 0.375rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.75rem;
  overflow: auto;
  max-height: 200px;
}

.code-block.error {
  background-color: #fee2e2;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .action-button {
    background-color: #374151;
  }

  .action-button:hover {
    background-color: #4b5563;
  }

  .model-card {
    border-color: #374151;
    background-color: #1f2937;
  }

  .model-active {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px #6366f1;
  }

  .model-icon-wrapper {
    background-color: #374151;
  }

  .status-active {
    background-color: #065f46;
    color: #d1fae5;
  }

  .status-inactive {
    background-color: #374151;
    color: #d1d5db;
  }

  .capability-tag {
    background-color: #374151;
    color: #d1d5db;
  }

  .stat-item {
    background-color: #111827;
  }

  .model-action-button {
    background-color: #374151;
  }

  .model-action-button:hover {
    background-color: #4b5563;
  }

  .test-success {
    border-color: #059669;
    background-color: #1f2937;
  }

  .test-error {
    border-color: #dc2626;
    background-color: #1f2937;
  }

  .test-result-header {
    background-color: #111827;
    border-bottom-color: #374151;
  }

  .close-button:hover {
    background-color: #374151;
  }

  .code-block {
    background-color: #111827;
    color: #f9fafb;
  }

  .code-block.error {
    background-color: #7f1d1d;
  }
}
</style>