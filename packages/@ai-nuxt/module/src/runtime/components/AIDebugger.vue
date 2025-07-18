<template>
  <div class="ai-debugger" :class="{ 'ai-debugger--collapsed': isCollapsed }">
    <!-- Header -->
    <div class="ai-debugger__header" @click="toggleCollapse">
      <div class="ai-debugger__title">
        <span class="ai-debugger__icon">🔍</span>
        <span>AI Debugger</span>
        <span v-if="totalRequests > 0" class="ai-debugger__badge">{{ totalRequests }}</span>
      </div>
      <div class="ai-debugger__controls">
        <button
          v-if="!isCollapsed"
          @click.stop="clearHistory"
          class="ai-debugger__control-button"
          title="Clear history"
          type="button"
        >
          🗑️
        </button>
        <button
          @click.stop="toggleCollapse"
          class="ai-debugger__control-button"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
          type="button"
        >
          {{ isCollapsed ? '▲' : '▼' }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div v-if="!isCollapsed" class="ai-debugger__content">
      <!-- Summary Stats -->
      <div class="ai-debugger__summary">
        <div class="ai-debugger__stat">
          <div class="ai-debugger__stat-value">{{ totalRequests }}</div>
          <div class="ai-debugger__stat-label">Requests</div>
        </div>
        <div class="ai-debugger__stat">
          <div class="ai-debugger__stat-value">{{ totalTokens.toLocaleString() }}</div>
          <div class="ai-debugger__stat-label">Tokens</div>
        </div>
        <div class="ai-debugger__stat">
          <div class="ai-debugger__stat-value">${{ totalCost.toFixed(4) }}</div>
          <div class="ai-debugger__stat-label">Cost</div>
        </div>
        <div class="ai-debugger__stat">
          <div class="ai-debugger__stat-value">{{ averageLatency }}ms</div>
          <div class="ai-debugger__stat-label">Avg Latency</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ai-debugger__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="ai-debugger__tab"
          :class="{ 'ai-debugger__tab--active': activeTab === tab.id }"
          type="button"
        >
          {{ tab.label }}
          <span v-if="tab.count" class="ai-debugger__tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="ai-debugger__tab-content">
        <!-- Requests Tab -->
        <div v-if="activeTab === 'requests'" class="ai-debugger__requests">
          <div v-if="requests.length === 0" class="ai-debugger__empty">
            No requests yet. Start using AI features to see debug information.
          </div>
          <div
            v-for="request in requests"
            :key="request.id"
            class="ai-debugger__request"
            :class="`ai-debugger__request--${request.status}`"
            @click="selectedRequest = selectedRequest?.id === request.id ? null : request"
          >
            <div class="ai-debugger__request-header">
              <div class="ai-debugger__request-info">
                <span class="ai-debugger__request-method">{{ request.method }}</span>
                <span class="ai-debugger__request-provider">{{ request.provider }}</span>
                <span class="ai-debugger__request-model">{{ request.model }}</span>
              </div>
              <div class="ai-debugger__request-meta">
                <span class="ai-debugger__request-time">{{ formatTime(request.timestamp) }}</span>
                <span class="ai-debugger__request-duration">{{ request.duration }}ms</span>
                <span 
                  class="ai-debugger__request-status"
                  :class="`ai-debugger__request-status--${request.status}`"
                >
                  {{ request.status }}
                </span>
              </div>
            </div>
            
            <!-- Expanded Request Details -->
            <div v-if="selectedRequest?.id === request.id" class="ai-debugger__request-details">
              <div class="ai-debugger__detail-section">
                <h4>Request</h4>
                <pre class="ai-debugger__code">{{ JSON.stringify(request.request, null, 2) }}</pre>
              </div>
              
              <div v-if="request.response" class="ai-debugger__detail-section">
                <h4>Response</h4>
                <pre class="ai-debugger__code">{{ JSON.stringify(request.response, null, 2) }}</pre>
              </div>
              
              <div v-if="request.error" class="ai-debugger__detail-section">
                <h4>Error</h4>
                <pre class="ai-debugger__code ai-debugger__code--error">{{ request.error }}</pre>
              </div>
              
              <div class="ai-debugger__detail-section">
                <h4>Metrics</h4>
                <div class="ai-debugger__metrics">
                  <div class="ai-debugger__metric">
                    <span>Duration:</span>
                    <span>{{ request.duration }}ms</span>
                  </div>
                  <div v-if="request.tokens" class="ai-debugger__metric">
                    <span>Tokens:</span>
                    <span>{{ request.tokens.total }} ({{ request.tokens.prompt }}+{{ request.tokens.completion }})</span>
                  </div>
                  <div v-if="request.cost" class="ai-debugger__metric">
                    <span>Cost:</span>
                    <span>${{ request.cost.toFixed(6) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Tab -->
        <div v-if="activeTab === 'performance'" class="ai-debugger__performance">
          <div class="ai-debugger__charts">
            <!-- Latency Chart -->
            <div class="ai-debugger__chart">
              <h4>Response Latency</h4>
              <div class="ai-debugger__chart-container">
                <div
                  v-for="(request, index) in recentRequests"
                  :key="request.id"
                  class="ai-debugger__chart-bar"
                  :style="{ height: `${(request.duration / maxLatency) * 100}%` }"
                  :title="`${request.duration}ms - ${request.provider}/${request.model}`"
                ></div>
              </div>
              <div class="ai-debugger__chart-labels">
                <span>{{ recentRequests.length > 0 ? Math.min(...recentRequests.map(r => r.duration)) : 0 }}ms</span>
                <span>{{ maxLatency }}ms</span>
              </div>
            </div>

            <!-- Token Usage Chart -->
            <div class="ai-debugger__chart">
              <h4>Token Usage</h4>
              <div class="ai-debugger__chart-container">
                <div
                  v-for="(request, index) in recentRequests.filter(r => r.tokens)"
                  :key="request.id"
                  class="ai-debugger__chart-bar ai-debugger__chart-bar--tokens"
                  :style="{ height: `${((request.tokens?.total || 0) / maxTokens) * 100}%` }"
                  :title="`${request.tokens?.total} tokens - ${request.provider}/${request.model}`"
                ></div>
              </div>
              <div class="ai-debugger__chart-labels">
                <span>0</span>
                <span>{{ maxTokens }}</span>
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div class="ai-debugger__perf-metrics">
            <div class="ai-debugger__perf-metric">
              <div class="ai-debugger__perf-label">Fastest Response</div>
              <div class="ai-debugger__perf-value">{{ fastestResponse }}ms</div>
            </div>
            <div class="ai-debugger__perf-metric">
              <div class="ai-debugger__perf-label">Slowest Response</div>
              <div class="ai-debugger__perf-value">{{ slowestResponse }}ms</div>
            </div>
            <div class="ai-debugger__perf-metric">
              <div class="ai-debugger__perf-label">Success Rate</div>
              <div class="ai-debugger__perf-value">{{ successRate }}%</div>
            </div>
            <div class="ai-debugger__perf-metric">
              <div class="ai-debugger__perf-label">Avg Tokens/Request</div>
              <div class="ai-debugger__perf-value">{{ averageTokens }}</div>
            </div>
          </div>
        </div>

        <!-- Errors Tab -->
        <div v-if="activeTab === 'errors'" class="ai-debugger__errors">
          <div v-if="errorRequests.length === 0" class="ai-debugger__empty">
            No errors recorded.
          </div>
          <div
            v-for="error in errorRequests"
            :key="error.id"
            class="ai-debugger__error-item"
          >
            <div class="ai-debugger__error-header">
              <span class="ai-debugger__error-time">{{ formatTime(error.timestamp) }}</span>
              <span class="ai-debugger__error-provider">{{ error.provider }}/{{ error.model }}</span>
            </div>
            <div class="ai-debugger__error-message">{{ error.error }}</div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="ai-debugger__settings">
          <div class="ai-debugger__setting">
            <label class="ai-debugger__setting-label">
              <input
                v-model="settings.enabled"
                type="checkbox"
                @change="updateSettings"
              />
              Enable debugging
            </label>
          </div>
          
          <div class="ai-debugger__setting">
            <label class="ai-debugger__setting-label">
              <input
                v-model="settings.logRequests"
                type="checkbox"
                @change="updateSettings"
              />
              Log requests to console
            </label>
          </div>
          
          <div class="ai-debugger__setting">
            <label class="ai-debugger__setting-label">
              <input
                v-model="settings.logResponses"
                type="checkbox"
                @change="updateSettings"
              />
              Log responses to console
            </label>
          </div>
          
          <div class="ai-debugger__setting">
            <label class="ai-debugger__setting-label">
              Max history entries:
              <input
                v-model.number="settings.maxEntries"
                type="number"
                min="10"
                max="1000"
                class="ai-debugger__setting-input"
                @change="updateSettings"
              />
            </label>
          </div>
          
          <div class="ai-debugger__setting">
            <button
              @click="exportData"
              class="ai-debugger__export-button"
              type="button"
            >
              Export Debug Data
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template><
script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// Types
export interface DebugRequest {
  id: string
  timestamp: Date
  method: 'chat' | 'completion' | 'embedding' | 'stream'
  provider: string
  model: string
  status: 'pending' | 'success' | 'error'
  duration: number
  request: any
  response?: any
  error?: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  cost?: number
}

export interface DebugSettings {
  enabled: boolean
  logRequests: boolean
  logResponses: boolean
  maxEntries: number
}

export interface AIDebuggerProps {
  // Initial settings
  enabled?: boolean
  maxEntries?: number
  autoCollapse?: boolean
  
  // External requests (for controlled mode)
  requests?: DebugRequest[]
}

const props = withDefaults(defineProps<AIDebuggerProps>(), {
  enabled: true,
  maxEntries: 100,
  autoCollapse: false,
  requests: () => []
})

// Emits
const emit = defineEmits<{
  'settings-change': [settings: DebugSettings]
  'export': [data: DebugRequest[]]
}>()

// State
const isCollapsed = ref(props.autoCollapse)
const activeTab = ref('requests')
const selectedRequest = ref<DebugRequest | null>(null)
const internalRequests = ref<DebugRequest[]>([])

const settings = ref<DebugSettings>({
  enabled: props.enabled,
  logRequests: false,
  logResponses: false,
  maxEntries: props.maxEntries
})

// Computed
const requests = computed(() => {
  return props.requests.length > 0 ? props.requests : internalRequests.value
})

const totalRequests = computed(() => requests.value.length)

const totalTokens = computed(() => {
  return requests.value.reduce((sum, req) => sum + (req.tokens?.total || 0), 0)
})

const totalCost = computed(() => {
  return requests.value.reduce((sum, req) => sum + (req.cost || 0), 0)
})

const averageLatency = computed(() => {
  const completedRequests = requests.value.filter(r => r.status !== 'pending')
  if (completedRequests.length === 0) return 0
  
  const totalLatency = completedRequests.reduce((sum, req) => sum + req.duration, 0)
  return Math.round(totalLatency / completedRequests.length)
})

const recentRequests = computed(() => {
  return requests.value
    .filter(r => r.status !== 'pending')
    .slice(-20)
    .reverse()
})

const maxLatency = computed(() => {
  const latencies = recentRequests.value.map(r => r.duration)
  return latencies.length > 0 ? Math.max(...latencies) : 1000
})

const maxTokens = computed(() => {
  const tokenCounts = recentRequests.value
    .filter(r => r.tokens)
    .map(r => r.tokens!.total)
  return tokenCounts.length > 0 ? Math.max(...tokenCounts) : 1000
})

const errorRequests = computed(() => {
  return requests.value.filter(r => r.status === 'error')
})

const fastestResponse = computed(() => {
  const completedRequests = requests.value.filter(r => r.status === 'success')
  if (completedRequests.length === 0) return 0
  return Math.min(...completedRequests.map(r => r.duration))
})

const slowestResponse = computed(() => {
  const completedRequests = requests.value.filter(r => r.status === 'success')
  if (completedRequests.length === 0) return 0
  return Math.max(...completedRequests.map(r => r.duration))
})

const successRate = computed(() => {
  const completedRequests = requests.value.filter(r => r.status !== 'pending')
  if (completedRequests.length === 0) return 100
  
  const successCount = completedRequests.filter(r => r.status === 'success').length
  return Math.round((successCount / completedRequests.length) * 100)
})

const averageTokens = computed(() => {
  const requestsWithTokens = requests.value.filter(r => r.tokens)
  if (requestsWithTokens.length === 0) return 0
  
  const totalTokens = requestsWithTokens.reduce((sum, req) => sum + req.tokens!.total, 0)
  return Math.round(totalTokens / requestsWithTokens.length)
})

const tabs = computed(() => [
  { id: 'requests', label: 'Requests', count: totalRequests.value },
  { id: 'performance', label: 'Performance' },
  { id: 'errors', label: 'Errors', count: errorRequests.value.length },
  { id: 'settings', label: 'Settings' }
])

// Methods
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const clearHistory = () => {
  internalRequests.value = []
  selectedRequest.value = null
}

const formatTime = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString()
}

const updateSettings = () => {
  emit('settings-change', settings.value)
  
  // Trim requests if max entries changed
  if (internalRequests.value.length > settings.value.maxEntries) {
    internalRequests.value = internalRequests.value.slice(-settings.value.maxEntries)
  }
}

const exportData = () => {
  emit('export', requests.value)
  
  // Also download as JSON file
  const dataStr = JSON.stringify(requests.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `ai-debug-data-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

const addRequest = (request: DebugRequest) => {
  if (!settings.value.enabled) return
  
  internalRequests.value.push(request)
  
  // Trim to max entries
  if (internalRequests.value.length > settings.value.maxEntries) {
    internalRequests.value = internalRequests.value.slice(-settings.value.maxEntries)
  }
  
  // Log to console if enabled
  if (settings.value.logRequests) {
    console.log('AI Request:', request)
  }
}

const updateRequest = (id: string, updates: Partial<DebugRequest>) => {
  const index = internalRequests.value.findIndex(r => r.id === id)
  if (index !== -1) {
    internalRequests.value[index] = { ...internalRequests.value[index], ...updates }
    
    // Log response to console if enabled
    if (settings.value.logResponses && updates.response) {
      console.log('AI Response:', updates.response)
    }
  }
}

// Global event listeners for AI requests (if not using controlled mode)
const handleAIRequest = (event: CustomEvent) => {
  if (props.requests.length > 0) return // Controlled mode
  
  const { detail } = event
  addRequest({
    id: detail.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    method: detail.method || 'chat',
    provider: detail.provider || 'unknown',
    model: detail.model || 'unknown',
    status: 'pending',
    duration: 0,
    request: detail.request || {}
  })
}

const handleAIResponse = (event: CustomEvent) => {
  if (props.requests.length > 0) return // Controlled mode
  
  const { detail } = event
  updateRequest(detail.id, {
    status: 'success',
    duration: detail.duration || 0,
    response: detail.response,
    tokens: detail.tokens,
    cost: detail.cost
  })
}

const handleAIError = (event: CustomEvent) => {
  if (props.requests.length > 0) return // Controlled mode
  
  const { detail } = event
  updateRequest(detail.id, {
    status: 'error',
    duration: detail.duration || 0,
    error: detail.error
  })
}

// Lifecycle
onMounted(() => {
  // Listen for AI events
  window.addEventListener('ai-request', handleAIRequest as EventListener)
  window.addEventListener('ai-response', handleAIResponse as EventListener)
  window.addEventListener('ai-error', handleAIError as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('ai-request', handleAIRequest as EventListener)
  window.removeEventListener('ai-response', handleAIResponse as EventListener)
  window.removeEventListener('ai-error', handleAIError as EventListener)
})

// Expose methods for external control
defineExpose({
  addRequest,
  updateRequest,
  clearHistory,
  exportData,
  toggleCollapse
})
</script><style sco
ped>
.ai-debugger {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 400px;
  max-height: 600px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 1000;
  transition: all 0.3s ease;
}

.ai-debugger--collapsed {
  max-height: 60px;
}

/* Header */
.ai-debugger__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
}

.ai-debugger__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-debugger__icon {
  font-size: 1.25rem;
}

.ai-debugger__badge {
  padding: 0.125rem 0.375rem;
  background: #3b82f6;
  color: white;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.ai-debugger__controls {
  display: flex;
  gap: 0.25rem;
}

.ai-debugger__control-button {
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

.ai-debugger__control-button:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Content */
.ai-debugger__content {
  display: flex;
  flex-direction: column;
  max-height: 540px;
  overflow: hidden;
}

/* Summary */
.ai-debugger__summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.ai-debugger__stat {
  text-align: center;
}

.ai-debugger__stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-debugger__stat-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

/* Tabs */
.ai-debugger__tabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.ai-debugger__tab {
  flex: 1;
  padding: 0.75rem 0.5rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.ai-debugger__tab:hover {
  background: #e2e8f0;
  color: #374151;
}

.ai-debugger__tab--active {
  background: white;
  color: #3b82f6;
  border-bottom: 2px solid #3b82f6;
}

.ai-debugger__tab-count {
  padding: 0.125rem 0.25rem;
  background: #e2e8f0;
  color: #6b7280;
  border-radius: 8px;
  font-size: 0.625rem;
  font-weight: 500;
}

.ai-debugger__tab--active .ai-debugger__tab-count {
  background: #dbeafe;
  color: #3b82f6;
}

/* Tab Content */
.ai-debugger__tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.ai-debugger__empty {
  text-align: center;
  color: #6b7280;
  font-style: italic;
  padding: 2rem;
}

/* Requests */
.ai-debugger__requests {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-debugger__request {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-debugger__request:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.ai-debugger__request--success {
  border-left: 3px solid #10b981;
}

.ai-debugger__request--error {
  border-left: 3px solid #ef4444;
}

.ai-debugger__request--pending {
  border-left: 3px solid #f59e0b;
}

.ai-debugger__request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
}

.ai-debugger__request-info {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.ai-debugger__request-method {
  font-weight: 600;
  color: #1e293b;
  text-transform: uppercase;
}

.ai-debugger__request-provider,
.ai-debugger__request-model {
  color: #64748b;
}

.ai-debugger__request-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.ai-debugger__request-status {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 500;
  text-transform: capitalize;
}

.ai-debugger__request-status--success {
  background: #dcfce7;
  color: #166534;
}

.ai-debugger__request-status--error {
  background: #fef2f2;
  color: #dc2626;
}

.ai-debugger__request-status--pending {
  background: #fef3c7;
  color: #d97706;
}

.ai-debugger__request-details {
  border-top: 1px solid #e2e8f0;
  padding: 0.75rem;
  background: #f8fafc;
}

.ai-debugger__detail-section {
  margin-bottom: 1rem;
}

.ai-debugger__detail-section:last-child {
  margin-bottom: 0;
}

.ai-debugger__detail-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.ai-debugger__code {
  margin: 0;
  padding: 0.5rem;
  background: #1f2937;
  color: #e5e7eb;
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 150px;
  overflow-y: auto;
}

.ai-debugger__code--error {
  background: #fef2f2;
  color: #dc2626;
}

.ai-debugger__metrics {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ai-debugger__metric {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.ai-debugger__metric span:first-child {
  color: #6b7280;
}

.ai-debugger__metric span:last-child {
  color: #374151;
  font-weight: 500;
}

/* Performance */
.ai-debugger__performance {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.ai-debugger__charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.ai-debugger__chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-debugger__chart h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.ai-debugger__chart-container {
  display: flex;
  align-items: end;
  gap: 2px;
  height: 80px;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 4px;
}

.ai-debugger__chart-bar {
  flex: 1;
  min-height: 2px;
  background: #3b82f6;
  border-radius: 1px;
  transition: all 0.2s;
}

.ai-debugger__chart-bar--tokens {
  background: #10b981;
}

.ai-debugger__chart-bar:hover {
  opacity: 0.8;
}

.ai-debugger__chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
}

.ai-debugger__perf-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.ai-debugger__perf-metric {
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
}

.ai-debugger__perf-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.ai-debugger__perf-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

/* Errors */
.ai-debugger__errors {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-debugger__error-item {
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}

.ai-debugger__error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.ai-debugger__error-message {
  font-size: 0.875rem;
  color: #dc2626;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* Settings */
.ai-debugger__settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ai-debugger__setting {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-debugger__setting-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.ai-debugger__setting-input {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 80px;
}

.ai-debugger__export-button {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-debugger__export-button:hover {
  background: #2563eb;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-debugger {
    width: calc(100vw - 2rem);
    max-width: 400px;
  }
  
  .ai-debugger__summary {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .ai-debugger__charts {
    grid-template-columns: 1fr;
  }
  
  .ai-debugger__perf-metrics {
    grid-template-columns: 1fr;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .ai-debugger {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  .ai-debugger__header,
  .ai-debugger__summary,
  .ai-debugger__tabs {
    background: #111827;
    border-color: #374151;
  }
  
  .ai-debugger__tab--active {
    background: #1f2937;
  }
  
  .ai-debugger__request {
    background: #1f2937;
    border-color: #374151;
  }
  
  .ai-debugger__request-details {
    background: #111827;
  }
  
  .ai-debugger__chart-container,
  .ai-debugger__perf-metric {
    background: #111827;
  }
}
</style>