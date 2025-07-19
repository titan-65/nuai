<template>
  <div class="ai-cache-example">
    <h2>AI Cache System Example</h2>
    
    <!-- Cache Statistics -->
    <div class="stats-panel">
      <h3>Cache Statistics</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.hits }}</div>
          <div class="stat-label">Cache Hits</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.misses }}</div>
          <div class="stat-label">Cache Misses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ (hitRate * 100).toFixed(1) }}%</div>
          <div class="stat-label">Hit Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ cacheSize }}</div>
          <div class="stat-label">Cache Size</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ (memoryUsage / 1024).toFixed(1) }}KB</div>
          <div class="stat-label">Memory Usage</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.evictions }}</div>
          <div class="stat-label">Evictions</div>
        </div>
      </div>
    </div>

    <!-- Cache Configuration -->
    <div class="config-panel">
      <h3>Cache Configuration</h3>
      <div class="config-grid">
        <div class="config-item">
          <label>
            <input type="checkbox" v-model="isEnabled" @change="toggleCache" />
            Enable Caching
          </label>
        </div>
        <div class="config-item">
          <label>Memory Cache Size:</label>
          <input 
            type="number" 
            v-model.number="memoryCacheSize" 
            @change="updateCacheSize"
            min="10" 
            max="1000" 
          />
        </div>
        <div class="config-item">
          <label>Memory TTL (minutes):</label>
          <input 
            type="number" 
            v-model.number="memoryTTLMinutes" 
            @change="updateCacheTTL"
            min="1" 
            max="1440" 
          />
        </div>
        <div class="config-item">
          <label>
            <input 
              type="checkbox" 
              v-model="semanticCacheEnabled" 
              @change="toggleSemanticCache" 
            />
            Enable Semantic Cache
          </label>
        </div>
        <div v-if="semanticCacheEnabled" class="config-item">
          <label>Similarity Threshold:</label>
          <input 
            type="range" 
            v-model.number="semanticThreshold" 
            @change="updateSemanticThreshold"
            min="0.5" 
            max="1" 
            step="0.05" 
          />
          <span>{{ semanticThreshold.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>    <!
-- Test Interface -->
    <div class="test-panel">
      <h3>Cache Testing</h3>
      <div class="test-section">
        <h4>Chat Completion Test</h4>
        <textarea 
          v-model="chatPrompt" 
          placeholder="Enter a chat message to test caching..."
          rows="3"
        ></textarea>
        <div class="test-controls">
          <button @click="testChatCompletion" :disabled="!chatPrompt.trim() || isLoading">
            {{ isLoading ? 'Testing...' : 'Test Chat' }}
          </button>
          <button @click="clearChatHistory">Clear History</button>
        </div>
        <div v-if="chatResults.length > 0" class="results">
          <div 
            v-for="(result, index) in chatResults" 
            :key="index"
            class="result-item"
            :class="{ 'cache-hit': result.cacheHit }"
          >
            <div class="result-header">
              <span class="result-prompt">{{ result.prompt }}</span>
              <span class="result-status">
                {{ result.cacheHit ? '🎯 Cache Hit' : '🔄 API Call' }}
              </span>
              <span class="result-time">{{ result.duration }}ms</span>
            </div>
            <div class="result-response">{{ result.response }}</div>
          </div>
        </div>
      </div>

      <div class="test-section">
        <h4>Text Completion Test</h4>
        <textarea 
          v-model="completionPrompt" 
          placeholder="Enter a completion prompt to test caching..."
          rows="2"
        ></textarea>
        <div class="test-controls">
          <button @click="testCompletion" :disabled="!completionPrompt.trim() || isLoading">
            {{ isLoading ? 'Testing...' : 'Test Completion' }}
          </button>
          <button @click="clearCompletionHistory">Clear History</button>
        </div>
        <div v-if="completionResults.length > 0" class="results">
          <div 
            v-for="(result, index) in completionResults" 
            :key="index"
            class="result-item"
            :class="{ 'cache-hit': result.cacheHit }"
          >
            <div class="result-header">
              <span class="result-prompt">{{ result.prompt }}</span>
              <span class="result-status">
                {{ result.cacheHit ? '🎯 Cache Hit' : '🔄 API Call' }}
              </span>
              <span class="result-time">{{ result.duration }}ms</span>
            </div>
            <div class="result-response">{{ result.response }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cache Health -->
    <div class="health-panel">
      <h3>Cache Health</h3>
      <div class="health-metrics">
        <div class="health-item">
          <span class="health-label">Utilization Rate:</span>
          <span class="health-value">{{ (getCacheHealth.utilizationRate * 100).toFixed(1) }}%</span>
          <div class="health-bar">
            <div 
              class="health-fill" 
              :style="{ width: `${getCacheHealth.utilizationRate * 100}%` }"
            ></div>
          </div>
        </div>
        <div class="health-item">
          <span class="health-label">Memory Pressure:</span>
          <span 
            class="health-value"
            :class="`pressure-${getCacheHealth.memoryPressure}`"
          >
            {{ getCacheHealth.memoryPressure.toUpperCase() }}
          </span>
        </div>
        <div class="health-item">
          <span class="health-label">Cache Efficiency:</span>
          <span class="health-value">{{ (getCacheEfficiency.efficiency * 100).toFixed(1) }}%</span>
        </div>
        <div class="health-item">
          <span class="health-label">Overall Health:</span>
          <span 
            class="health-value"
            :class="getCacheHealth.isHealthy ? 'healthy' : 'unhealthy'"
          >
            {{ getCacheHealth.isHealthy ? 'HEALTHY' : 'NEEDS ATTENTION' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Cache Actions -->
    <div class="actions-panel">
      <h3>Cache Actions</h3>
      <div class="actions-grid">
        <button @click="refreshStats" class="action-btn">
          Refresh Stats
        </button>
        <button @click="clearCache" class="action-btn danger">
          Clear Cache
        </button>
        <button @click="exportCacheStats" class="action-btn">
          Export Stats
        </button>
        <button @click="simulateLoad" class="action-btn" :disabled="isSimulating">
          {{ isSimulating ? 'Simulating...' : 'Simulate Load' }}
        </button>
      </div>
    </div>
  </div>
</template><scrip
t setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAICache } from '../composables/useAICache'

// Cache composable
const cache = useAICache()

// Reactive state from cache
const isEnabled = cache.isEnabled
const stats = cache.stats
const hitRate = cache.hitRate
const cacheSize = cache.cacheSize
const memoryUsage = cache.memoryUsage
const getCacheHealth = cache.getCacheHealth
const getCacheEfficiency = cache.getCacheEfficiency

// Local state
const isLoading = ref(false)
const isSimulating = ref(false)
const chatPrompt = ref('')
const completionPrompt = ref('')
const memoryCacheSize = ref(100)
const memoryTTLMinutes = ref(60)
const semanticCacheEnabled = ref(false)
const semanticThreshold = ref(0.95)

// Test results
const chatResults = ref<Array<{
  prompt: string
  response: string
  cacheHit: boolean
  duration: number
}>>([])

const completionResults = ref<Array<{
  prompt: string
  response: string
  cacheHit: boolean
  duration: number
}>>([])

// Mock responses for testing
const mockChatResponses = [
  "Hello! How can I help you today?",
  "I'm doing well, thank you for asking!",
  "That's an interesting question. Let me think about it.",
  "I'd be happy to help you with that.",
  "Great question! Here's what I think..."
]

const mockCompletionResponses = [
  "beautiful and sunny with clear blue skies.",
  "quite challenging but very rewarding.",
  "an excellent opportunity to learn and grow.",
  "something that requires careful consideration.",
  "definitely worth exploring further."
]

// Methods
const toggleCache = () => {
  if (isEnabled.value) {
    cache.enableCache()
  } else {
    cache.disableCache()
  }
}

const updateCacheSize = () => {
  cache.setCacheSize(memoryCacheSize.value)
}

const updateCacheTTL = () => {
  const ttlMs = memoryTTLMinutes.value * 60 * 1000
  cache.setCacheTTL(ttlMs)
}

const toggleSemanticCache = () => {
  if (semanticCacheEnabled.value) {
    cache.enableSemanticCache(semanticThreshold.value)
  } else {
    cache.disableSemanticCache()
  }
}

const updateSemanticThreshold = () => {
  if (semanticCacheEnabled.value) {
    cache.enableSemanticCache(semanticThreshold.value)
  }
}

const testChatCompletion = async () => {
  if (!chatPrompt.value.trim()) return
  
  isLoading.value = true
  const startTime = Date.now()
  
  try {
    const chatOptions = {
      messages: [{ role: 'user' as const, content: chatPrompt.value }],
      provider: 'openai',
      model: 'gpt-4'
    }

    // Check cache first
    const cached = await cache.getCachedChatResponse(chatOptions)
    
    let response: string
    let cacheHit = false
    
    if (cached) {
      response = cached.response.message?.content || 'Cached response'
      cacheHit = true
    } else {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
      response = mockChatResponses[Math.floor(Math.random() * mockChatResponses.length)]
      
      // Cache the response
      await cache.setCachedChatResponse(chatOptions, 
        { message: { content: response } },
        { provider: 'openai', model: 'gpt-4', tokens: 25, cost: 0.001 }
      )
    }
    
    const duration = Date.now() - startTime
    
    chatResults.value.unshift({
      prompt: chatPrompt.value,
      response,
      cacheHit,
      duration
    })
    
    chatPrompt.value = ''
  } finally {
    isLoading.value = false
  }
}

const testCompletion = async () => {
  if (!completionPrompt.value.trim()) return
  
  isLoading.value = true
  const startTime = Date.now()
  
  try {
    const completionOptions = {
      prompt: completionPrompt.value,
      provider: 'openai',
      model: 'gpt-3.5-turbo'
    }

    // Check cache first
    const cached = await cache.getCachedCompletionResponse(completionOptions)
    
    let response: string
    let cacheHit = false
    
    if (cached) {
      response = cached.response.text || 'Cached completion'
      cacheHit = true
    } else {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500))
      response = mockCompletionResponses[Math.floor(Math.random() * mockCompletionResponses.length)]
      
      // Cache the response
      await cache.setCachedCompletionResponse(completionOptions,
        { text: response },
        { provider: 'openai', model: 'gpt-3.5-turbo', tokens: 15, cost: 0.0005 }
      )
    }
    
    const duration = Date.now() - startTime
    
    completionResults.value.unshift({
      prompt: completionPrompt.value,
      response,
      cacheHit,
      duration
    })
    
    completionPrompt.value = ''
  } finally {
    isLoading.value = false
  }
}

const clearChatHistory = () => {
  chatResults.value = []
}

const clearCompletionHistory = () => {
  completionResults.value = []
}

const refreshStats = async () => {
  await cache.updateStats()
}

const clearCache = async () => {
  await cache.clearCache()
  chatResults.value = []
  completionResults.value = []
}

const exportCacheStats = () => {
  const data = {
    stats: stats.value,
    health: getCacheHealth.value,
    efficiency: getCacheEfficiency.value,
    config: cache.config.value,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `cache-stats-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

const simulateLoad = async () => {
  isSimulating.value = true
  
  const testPrompts = [
    "What is the weather like?",
    "How are you doing today?",
    "Tell me a joke",
    "What is the capital of France?",
    "Explain quantum computing",
    "What is the weather like?", // Duplicate for cache hit
    "How are you doing today?", // Duplicate for cache hit
  ]
  
  for (const prompt of testPrompts) {
    chatPrompt.value = prompt
    await testChatCompletion()
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  isSimulating.value = false
}

// Auto-refresh stats
let statsInterval: NodeJS.Timeout

onMounted(() => {
  statsInterval = setInterval(refreshStats, 5000)
})

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
})
</script><
style scoped>
.ai-cache-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-cache-example h2 {
  text-align: center;
  color: #1e293b;
  margin-bottom: 2rem;
}

/* Panel Styles */
.stats-panel,
.config-panel,
.test-panel,
.health-panel,
.actions-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.stats-panel h3,
.config-panel h3,
.test-panel h3,
.health-panel h3,
.actions-panel h3 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1.25rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

/* Config Grid */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-item label {
  font-size: 0.875rem;
  color: #374151;
  white-space: nowrap;
}

.config-item input[type="number"],
.config-item input[type="range"] {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-item input[type="checkbox"] {
  margin-right: 0.5rem;
}

/* Test Section */
.test-section {
  margin-bottom: 2rem;
}

.test-section h4 {
  margin: 0 0 1rem 0;
  color: #4b5563;
}

.test-section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.test-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.test-controls button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.test-controls button:first-child {
  background: #3b82f6;
  color: white;
}

.test-controls button:first-child:hover:not(:disabled) {
  background: #2563eb;
}

.test-controls button:first-child:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-controls button:last-child {
  background: #6b7280;
  color: white;
}

.test-controls button:last-child:hover {
  background: #4b5563;
}

/* Results */
.results {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.result-item {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item.cache-hit {
  background: #f0fdf4;
  border-left: 4px solid #16a34a;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.result-prompt {
  font-weight: 500;
  color: #1e293b;
  flex: 1;
  margin-right: 1rem;
}

.result-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.result-time {
  color: #6b7280;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.result-response {
  color: #4b5563;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Health Metrics */
.health-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.health-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.health-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.health-value {
  font-weight: 600;
  font-size: 1rem;
}

.health-value.pressure-low {
  color: #16a34a;
}

.health-value.pressure-medium {
  color: #ca8a04;
}

.health-value.pressure-high {
  color: #dc2626;
}

.health-value.healthy {
  color: #16a34a;
}

.health-value.unhealthy {
  color: #dc2626;
}

.health-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #16a34a 0%, #ca8a04 70%, #dc2626 100%);
  transition: width 0.3s ease;
}

/* Actions */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.action-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #f3f4f6;
  color: #374151;
}

.action-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.action-btn.danger {
  background: #fef2f2;
  color: #dc2626;
}

.action-btn.danger:hover {
  background: #fee2e2;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-cache-example {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .health-metrics {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .test-controls {
    flex-direction: column;
  }
}
</style>