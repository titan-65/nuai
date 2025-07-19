<template>
  <div class="cache-panel">
    <div class="panel-header">
      <h2 class="panel-title">AI Cache</h2>
      <div class="panel-actions">
        <button class="action-button" @click="clearCache">
          <div class="i-carbon-trash-can" />
          Clear Cache
        </button>
        <button class="action-button" @click="refreshCache">
          <div class="i-carbon-refresh" />
          Refresh
        </button>
      </div>
    </div>

    <div class="cache-stats">
      <div class="stat-card">
        <div class="stat-icon">
          <div class="i-carbon-data-base" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ cacheStats.size }}</div>
          <div class="stat-label">Cached Items</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <div class="i-carbon-checkmark" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ cacheStats.hits }}</div>
          <div class="stat-label">Cache Hits</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <div class="i-carbon-close" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ cacheStats.misses }}</div>
          <div class="stat-label">Cache Misses</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">
          <div class="i-carbon-percentage" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ hitRateFormatted }}%</div>
          <div class="stat-label">Hit Rate</div>
        </div>
      </div>
    </div>

    <div class="cache-items">
      <div class="items-header">
        <h3>Cached Items</h3>
        <div class="items-filter">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search cache keys..."
            class="search-input"
          />
        </div>
      </div>

      <div class="items-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Size</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Hits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredCacheItems.length === 0">
              <td colspan="7" class="no-items">No cache items found</td>
            </tr>
            <tr v-for="item in filteredCacheItems" :key="item.key">
              <td class="key-cell">
                <div class="key-content" @click="viewCacheItem(item)">
                  {{ truncate(item.key, 40) }}
                </div>
              </td>
              <td>{{ item.type }}</td>
              <td>{{ formatSize(item.size) }}</td>
              <td>{{ formatTime(item.created) }}</td>
              <td>
                <span :class="{ 'expired': isExpired(item.expires) }">
                  {{ formatTime(item.expires) }}
                </span>
              </td>
              <td>{{ item.hits }}</td>
              <td>
                <div class="item-actions">
                  <button class="item-action" @click="viewCacheItem(item)">
                    <div class="i-carbon-view" />
                  </button>
                  <button class="item-action" @click="deleteCacheItem(item.key)">
                    <div class="i-carbon-trash-can" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="selectedItem" class="item-details">
      <div class="details-header">
        <h3>Cache Item Details</h3>
        <button class="close-button" @click="selectedItem = null">
          <div class="i-carbon-close" />
        </button>
      </div>

      <div class="details-content">
        <div class="details-section">
          <h4>Overview</h4>
          <div class="details-grid">
            <div class="details-label">Key:</div>
            <div class="details-value">{{ selectedItem.key }}</div>
            
            <div class="details-label">Type:</div>
            <div class="details-value">{{ selectedItem.type }}</div>
            
            <div class="details-label">Size:</div>
            <div class="details-value">{{ formatSize(selectedItem.size) }}</div>
            
            <div class="details-label">Created:</div>
            <div class="details-value">{{ formatTime(selectedItem.created) }}</div>
            
            <div class="details-label">Expires:</div>
            <div class="details-value" :class="{ 'expired': isExpired(selectedItem.expires) }">
              {{ formatTime(selectedItem.expires) }}
            </div>
            
            <div class="details-label">Hits:</div>
            <div class="details-value">{{ selectedItem.hits }}</div>
            
            <div class="details-label">TTL:</div>
            <div class="details-value">{{ selectedItem.ttl }} seconds</div>
          </div>
        </div>

        <div class="details-section">
          <h4>Value</h4>
          <div class="code-block">
            <pre>{{ formatValue(selectedItem.value) }}</pre>
          </div>
        </div>

        <div class="details-section">
          <h4>Metadata</h4>
          <div class="code-block">
            <pre>{{ JSON.stringify(selectedItem.metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAICache } from '../composables/useAICache'

interface CacheItem {
  key: string
  type: string
  value: any
  size: number
  created: Date
  expires: Date
  hits: number
  ttl: number
  metadata: Record<string, any>
}

const { cacheItems, cacheStats, fetchCacheItems, fetchCacheStats, clearAllCache, deleteCacheItem } = useAICache()

const searchQuery = ref('')
const selectedItem = ref<CacheItem | null>(null)

const hitRateFormatted = computed(() => {
  return cacheStats.value.hitRate.toFixed(1)
})

const filteredCacheItems = computed(() => {
  if (!searchQuery.value) return cacheItems.value
  return cacheItems.value.filter(item => 
    item.key.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatTime(date: Date) {
  return new Date(date).toLocaleString()
}

function formatValue(value: any) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function truncate(text: string, length: number) {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

function isExpired(expires: Date) {
  return new Date() > new Date(expires)
}

function viewCacheItem(item: CacheItem) {
  selectedItem.value = item
}

function clearCache() {
  clearAllCache()
  selectedItem.value = null
}

function refreshCache() {
  fetchCacheItems()
  fetchCacheStats()
}

onMounted(() => {
  fetchCacheItems()
  fetchCacheStats()
})
</script>

<style scoped>
.cache-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.cache-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  background-color: #4f46e5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.cache-items {
  flex: 1;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.items-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
}

.search-input {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  font-size: 0.875rem;
  width: 250px;
}

.items-table-container {
  flex: 1;
  overflow: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6b7280;
}

.items-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
}

.key-cell {
  max-width: 200px;
}

.key-content {
  cursor: pointer;
  color: #4f46e5;
  text-decoration: underline;
}

.key-content:hover {
  color: #3730a3;
}

.expired {
  color: #ef4444;
  font-weight: 500;
}

.no-items {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.item-actions {
  display: flex;
  gap: 0.25rem;
}

.item-action {
  padding: 0.25rem;
  border-radius: 0.25rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.item-action:hover {
  background-color: #e5e7eb;
}

.item-details {
  position: fixed;
  top: 0;
  right: 0;
  width: 50%;
  height: 100%;
  background-color: white;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 10;
  overflow-y: auto;
  padding: 1.5rem;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.details-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
}

.close-button {
  padding: 0.375rem;
  border-radius: 0.375rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background-color: #e5e7eb;
}

.details-section {
  margin-bottom: 1.5rem;
}

.details-section h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.details-grid {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 0.5rem;
}

.details-label {
  font-weight: 500;
  color: #6b7280;
}

.code-block {
  padding: 1rem;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .action-button {
    background-color: #374151;
  }

  .action-button:hover {
    background-color: #4b5563;
  }

  .stat-card {
    border-color: #374151;
    background-color: #1f2937;
  }

  .cache-items {
    border-color: #374151;
    background-color: #1f2937;
  }

  .search-input {
    border-color: #4b5563;
    background-color: #1f2937;
    color: #f9fafb;
  }

  .items-table th {
    border-bottom-color: #374151;
  }

  .items-table td {
    border-bottom-color: #374151;
  }

  .item-action {
    background-color: #374151;
  }

  .item-action:hover {
    background-color: #4b5563;
  }

  .item-details {
    background-color: #1f2937;
    border-left-color: #374151;
  }

  .close-button {
    background-color: #374151;
  }

  .close-button:hover {
    background-color: #4b5563;
  }

  .code-block {
    background-color: #111827;
    color: #f9fafb;
  }
}
</style>