<template>
  <div class="ai-devtools-panel">
    <!-- Header -->
    <div class="ai-devtools-header">
      <div class="ai-devtools-title">
        <h1>AI Nuxt DevTools</h1>
        <div class="ai-devtools-status" :class="{ 'ai-devtools-status--active': isActive }">
          <span class="ai-devtools-status-dot"></span>
          {{ isActive ? 'Active' : 'Inactive' }}
        </div>
      </div>
      <div class="ai-devtools-actions">
        <button @click="refreshData" class="ai-devtools-button ai-devtools-button--secondary">
          <Icon name="carbon:refresh" />
          Refresh
        </button>
        <button @click="clearData" class="ai-devtools-button ai-devtools-button--danger">
          <Icon name="carbon:trash-can" />
          Clear
        </button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="ai-devtools-stats">
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">{{ stats.totalRequests }}</div>
        <div class="ai-devtools-stat-label">Total Requests</div>
      </div>
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">{{ formatNumber(stats.totalTokens) }}</div>
        <div class="ai-devtools-stat-label">Total Tokens</div>
      </div>
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">${{ formatCost(stats.totalCost) }}</div>
        <div class="ai-devtools-stat-label">Estimated Cost</div>
      </div>
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">{{ formatDuration(stats.averageResponseTime) }}</div>
        <div class="ai-devtools-stat-label">Avg Response Time</div>
      </div>
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">{{ formatPercentage(stats.cacheHitRate) }}</div>
        <div class="ai-devtools-stat-label">Cache Hit Rate</div>
      </div>
      <div class="ai-devtools-stat-card">
        <div class="ai-devtools-stat-value">{{ formatPercentage(successRate) }}</div>
        <div class="ai-devtools-stat-label">Success Rate</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="ai-devtools-filters">
      <div class="ai-devtools-filter-group">
        <label>Type:</label>
        <select v-model="filters.type">
          <option value="">All Types</option>
          <option value="chat">Chat</option>
          <option value="completion">Completion</option>
          <option value="embedding">Embedding</option>
          <option value="agent">Agent</option>
          <option value="tool">Tool</option>
        </select>
      </div>
      <div class="ai-devtools-filter-group">
        <label>Provider:</label>
        <select v-model="filters.provider">
          <option value="">All Providers</option>
          <option v-for="provider in providers" :key="provider" :value="provider">
            {{ provider }}
          </option>
        </select>
      </div>
      <div class="ai-devtools-filter-group">
        <label>Status:</label>
        <select v-model="filters.status">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div class="ai-devtools-filter-group">
        <label>Search:</label>
        <input v-model="searchQuery" type="text" placeholder="Search requests..." />
      </div>
    </div>

    <!-- Requests Table -->
    <div class="ai-devtools-requests">
      <div class="ai-devtools-table-header">
        <div class="ai-devtools-table-cell">Time</div>
        <div class="ai-devtools-table-cell">Type</div>
        <div class="ai-devtools-table-cell">Provider</div>
        <div class="ai-devtools-table-cell">Model</div>
        <div class="ai-devtools-table-cell">Status</div>
        <div class="ai-devtools-table-cell">Duration</div>
        <div class="ai-devtools-table-cell">Tokens</div>
        <div class="ai-devtools-table-cell">Cost</div>
        <div class="ai-devtools-table-cell">Actions</div>
      </div>
      
      <div class="ai-devtools-table-body">
        <div 
          v-for="request in filteredRequests" 
          :key="request.id"
          class="ai-devtools-table-row"
          :class="{
            'ai-devtools-table-row--success': request.status === 'success',
            'ai-devtools-table-row--error': request.status === 'error',
            'ai-devtools-table-row--pending': request.status === 'pending'
          }"
          @click="selectRequest(request)"
        >
          <div class="ai-devtools-table-cell">
            {{ formatTime(request.timestamp) }}
          </div>
          <div class="ai-devtools-table-cell">
            <span class="ai-devtools-badge" :class="`ai-devtools-badge--${request.type}`">
              {{ request.type }}
            </span>
          </div>
          <div class="ai-devtools-table-cell">{{ request.provider }}</div>
          <div class="ai-devtools-table-cell">{{ request.model }}</div>
          <div class="ai-devtools-table-cell">
            <span class="ai-devtools-status-badge" :class="`ai-devtools-status-badge--${request.status}`">
              {{ request.status }}
            </span>
          </div>
          <div class="ai-devtools-table-cell">
            {{ request.metrics.duration ? formatDuration(request.metrics.duration) : '-' }}
          </div>
          <div class="ai-devtools-table-cell">
            {{ request.metrics.tokens ? formatNumber(request.metrics.tokens.total) : '-' }}
          </div>
          <div class="ai-devtools-table-cell">
            {{ request.metrics.cost ? '$' + formatCost(request.metrics.cost) : '-' }}
          </div>
          <div class="ai-devtools-table-cell">
            <button @click.stop="viewRequest(request)" class="ai-devtools-button ai-devtools-button--small">
              View
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Request Details Modal -->
    <div v-if="selectedRequest" class="ai-devtools-modal" @click="closeModal">
      <div class="ai-devtools-modal-content" @click.stop>
        <div class="ai-devtools-modal-header">
          <h2>Request Details</h2>
          <button @click="closeModal" class="ai-devtools-modal-close">×</button>
        </div>
        
        <div class="ai-devtools-modal-body">
          <div class="ai-devtools-detail-section">
            <h3>Basic Information</h3>
            <div class="ai-devtools-detail-grid">
              <div class="ai-devtools-detail-item">
                <label>ID:</label>
                <span>{{ selectedRequest.id }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Type:</label>
                <span>{{ selectedRequest.type }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Provider:</label>
                <span>{{ selectedRequest.provider }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Model:</label>
                <span>{{ selectedRequest.model }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Status:</label>
                <span class="ai-devtools-status-badge" :class="`ai-devtools-status-badge--${selectedRequest.status}`">
                  {{ selectedRequest.status }}
                </span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Timestamp:</label>
                <span>{{ formatFullTime(selectedRequest.timestamp) }}</span>
              </div>
            </div>
          </div>

          <div class="ai-devtools-detail-section">
            <h3>Performance Metrics</h3>
            <div class="ai-devtools-detail-grid">
              <div class="ai-devtools-detail-item">
                <label>Duration:</label>
                <span>{{ selectedRequest.metrics.duration ? formatDuration(selectedRequest.metrics.duration) : 'N/A' }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Tokens:</label>
                <span>{{ selectedRequest.metrics.tokens ? formatTokens(selectedRequest.metrics.tokens) : 'N/A' }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Cost:</label>
                <span>{{ selectedRequest.metrics.cost ? '$' + formatCost(selectedRequest.metrics.cost) : 'N/A' }}</span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Cached:</label>
                <span>{{ selectedRequest.metrics.cached ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedRequest.metadata?.security" class="ai-devtools-detail-section">
            <h3>Security</h3>
            <div class="ai-devtools-detail-grid">
              <div class="ai-devtools-detail-item">
                <label>Prompt Injection:</label>
                <span :class="selectedRequest.metadata.security.promptInjection ? 'ai-devtools-text--danger' : 'ai-devtools-text--success'">
                  {{ selectedRequest.metadata.security.promptInjection ? 'Detected' : 'Clean' }}
                </span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>PII Detected:</label>
                <span :class="selectedRequest.metadata.security.piiDetected ? 'ai-devtools-text--warning' : 'ai-devtools-text--success'">
                  {{ selectedRequest.metadata.security.piiDetected ? 'Yes' : 'No' }}
                </span>
              </div>
              <div class="ai-devtools-detail-item">
                <label>Content Filtered:</label>
                <span :class="selectedRequest.metadata.security.contentFiltered ? 'ai-devtools-text--warning' : 'ai-devtools-text--success'">
                  {{ selectedRequest.metadata.security.contentFiltered ? 'Yes' : 'No' }}
                </span>
              </div>
            </div>
          </div>

          <div class="ai-devtools-detail-section">
            <h3>Request Data</h3>
            <div class="ai-devtools-code-block">
              <pre>{{ JSON.stringify(selectedRequest.input, null, 2) }}</pre>
            </div>
          </div>

          <div v-if="selectedRequest.output" class="ai-devtools-detail-section">
            <h3>Response Data</h3>
            <div class="ai-devtools-code-block">
              <pre>{{ JSON.stringify(selectedRequest.output, null, 2) }}</pre>
            </div>
          </div>

          <div v-if="selectedRequest.error" class="ai-devtools-detail-section">
            <h3>Error Information</h3>
            <div class="ai-devtools-error-block">
              {{ selectedRequest.error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="ai-devtools-charts">
      <div class="ai-devtools-chart-container">
        <h3>Requests by Provider</h3>
        <div class="ai-devtools-chart">
          <div 
            v-for="(count, provider) in stats.byProvider" 
            :key="provider"
            class="ai-devtools-chart-bar"
            :style="{ height: `${(count / Math.max(...Object.values(stats.byProvider))) * 100}%` }"
          >
            <div class="ai-devtools-chart-label">{{ provider }}</div>
            <div class="ai-devtools-chart-value">{{ count }}</div>
          </div>
        </div>
      </div>

      <div class="ai-devtools-chart-container">
        <h3>Requests by Type</h3>
        <div class="ai-devtools-chart">
          <div 
            v-for="(count, type) in stats.byType" 
            :key="type"
            class="ai-devtools-chart-bar"
            :style="{ height: `${(count / Math.max(...Object.values(stats.byType))) * 100}%` }"
          >
            <div class="ai-devtools-chart-label">{{ type }}</div>
            <div class="ai-devtools-chart-value">{{ count }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { AIRequest, DevToolsStats } from '../index'

// State
const requests = ref<AIRequest[]>([])
const stats = ref<DevToolsStats>({
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokens: 0,
  totalCost: 0,
  averageResponseTime: 0,
  cacheHitRate: 0,
  byProvider: {},
  byModel: {},
  byType: {}
})
const selectedRequest = ref<AIRequest | null>(null)
const isActive = ref(true)
const searchQuery = ref('')
const filters = ref({
  type: '',
  provider: '',
  status: ''
})

// Computed
const providers = computed(() => {
  return [...new Set(requests.value.map(req => req.provider))]
})

const successRate = computed(() => {
  if (stats.value.totalRequests === 0) return 0
  return stats.value.successfulRequests / stats.value.totalRequests
})

const filteredRequests = computed(() => {
  let filtered = requests.value

  if (filters.value.type) {
    filtered = filtered.filter(req => req.type === filters.value.type)
  }
  if (filters.value.provider) {
    filtered = filtered.filter(req => req.provider === filters.value.provider)
  }
  if (filters.value.status) {
    filtered = filtered.filter(req => req.status === filters.value.status)
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(req => 
      req.id.toLowerCase().includes(query) ||
      req.model.toLowerCase().includes(query) ||
      JSON.stringify(req.input).toLowerCase().includes(query)
    )
  }

  return filtered.slice(0, 100) // Limit to 100 for performance
})

// Methods
const refreshData = async () => {
  try {
    const [requestsRes, statsRes] = await Promise.all([
      fetch('/__ai_nuxt_devtools/api/requests'),
      fetch('/__ai_nuxt_devtools/api/stats')
    ])
    
    requests.value = await requestsRes.json()
    stats.value = await statsRes.json()
  } catch (error) {
    console.error('Failed to refresh DevTools data:', error)
  }
}

const clearData = async () => {
  if (confirm('Are you sure you want to clear all tracked requests?')) {
    try {
      await fetch('/__ai_nuxt_devtools/api/clear', { method: 'POST' })
      await refreshData()
    } catch (error) {
      console.error('Failed to clear DevTools data:', error)
    }
  }
}

const selectRequest = (request: AIRequest) => {
  selectedRequest.value = request
}

const viewRequest = (request: AIRequest) => {
  selectedRequest.value = request
}

const closeModal = () => {
  selectedRequest.value = null
}

// Formatting helpers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatCost = (cost: number): string => {
  return (cost / 100).toFixed(4)
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatPercentage = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatFullTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

const formatTokens = (tokens: { prompt: number; completion: number; total: number }): string => {
  return `${tokens.total} (${tokens.prompt}+${tokens.completion})`
}

// Lifecycle
onMounted(() => {
  refreshData()
  
  // Auto-refresh every 5 seconds
  setInterval(refreshData, 5000)
})

// Watch for filter changes
watch([filters, searchQuery], () => {
  // Filters are reactive, no need to do anything
}, { deep: true })
</script>

<style>
.ai-devtools-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;
  min-height: 100vh;
  padding: 1rem;
}

.ai-devtools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.ai-devtools-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ai-devtools-title h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1a202c;
}

.ai-devtools-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  background: #fed7d7;
  color: #c53030;
  font-size: 0.875rem;
}

.ai-devtools-status--active {
  background: #c6f6d5;
  color: #22543d;
}

.ai-devtools-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.ai-devtools-actions {
  display: flex;
  gap: 0.5rem;
}

.ai-devtools-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-devtools-button--secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.ai-devtools-button--secondary:hover {
  background: #cbd5e0;
}

.ai-devtools-button--danger {
  background: #fed7d7;
  color: #c53030;
}

.ai-devtools-button--danger:hover {
  background: #feb2b2;
}

.ai-devtools-button--small {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.ai-devtools-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.ai-devtools-stat-card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.ai-devtools-stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.ai-devtools-stat-label {
  font-size: 0.875rem;
  color: #718096;
}

.ai-devtools-filters {
  display: flex;
  gap: 1rem;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.ai-devtools-filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ai-devtools-filter-group label {
  font-size: 0.875rem;
  color: #4a5568;
  font-weight: 500;
}

.ai-devtools-filter-group select,
.ai-devtools-filter-group input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.875rem;
}

.ai-devtools-requests {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 1rem;
}

.ai-devtools-table-header {
  display: grid;
  grid-template-columns: 100px 80px 100px 120px 80px 80px 80px 80px 80px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  font-size: 0.875rem;
  color: #4a5568;
}

.ai-devtools-table-cell {
  padding: 0.75rem 0.5rem;
  border-right: 1px solid #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-devtools-table-row {
  display: grid;
  grid-template-columns: 100px 80px 100px 120px 80px 80px 80px 80px 80px;
  border-bottom: 1px solid #f7fafc;
  cursor: pointer;
  transition: background-color 0.2s;
}

.ai-devtools-table-row:hover {
  background: #f7fafc;
}

.ai-devtools-table-row--success {
  border-left: 3px solid #48bb78;
}

.ai-devtools-table-row--error {
  border-left: 3px solid #f56565;
}

.ai-devtools-table-row--pending {
  border-left: 3px solid #ed8936;
}

.ai-devtools-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.ai-devtools-badge--chat { background: #bee3f8; color: #2c5282; }
.ai-devtools-badge--completion { background: #c6f6d5; color: #22543d; }
.ai-devtools-badge--embedding { background: #fbb6ce; color: #97266d; }
.ai-devtools-badge--agent { background: #faf089; color: #744210; }
.ai-devtools-badge--tool { background: #e9d8fd; color: #553c9a; }

.ai-devtools-status-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.ai-devtools-status-badge--success { background: #c6f6d5; color: #22543d; }
.ai-devtools-status-badge--error { background: #fed7d7; color: #c53030; }
.ai-devtools-status-badge--pending { background: #feebc8; color: #c05621; }

.ai-devtools-modal {
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

.ai-devtools-modal-content {
  background: white;
  border-radius: 8px;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.ai-devtools-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ai-devtools-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #2d3748;
}

.ai-devtools-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #718096;
}

.ai-devtools-modal-body {
  padding: 1rem;
}

.ai-devtools-detail-section {
  margin-bottom: 1.5rem;
}

.ai-devtools-detail-section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #4a5568;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

.ai-devtools-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.ai-devtools-detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ai-devtools-detail-item label {
  font-size: 0.875rem;
  color: #718096;
  font-weight: 500;
}

.ai-devtools-code-block {
  background: #2d3748;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
}

.ai-devtools-error-block {
  background: #fed7d7;
  color: #c53030;
  padding: 1rem;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
}

.ai-devtools-text--success { color: #22543d; }
.ai-devtools-text--warning { color: #c05621; }
.ai-devtools-text--danger { color: #c53030; }

.ai-devtools-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.ai-devtools-chart-container {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ai-devtools-chart-container h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #4a5568;
}

.ai-devtools-chart {
  display: flex;
  align-items: end;
  gap: 0.5rem;
  height: 200px;
}

.ai-devtools-chart-bar {
  flex: 1;
  background: #4299e1;
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.25rem;
}

.ai-devtools-chart-label {
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.ai-devtools-chart-value {
  font-size: 0.875rem;
  color: white;
  font-weight: bold;
}
</style>