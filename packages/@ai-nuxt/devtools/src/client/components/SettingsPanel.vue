<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h2 class="panel-title">Settings</h2>
      <div class="panel-actions">
        <button class="action-button" @click="saveSettings">
          <div class="i-carbon-save" />
          Save
        </button>
        <button class="action-button" @click="resetSettings">
          <div class="i-carbon-reset" />
          Reset
        </button>
      </div>
    </div>

    <div class="settings-content">
      <div class="settings-section">
        <h3>General</h3>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.devtools.enabled"
              class="setting-checkbox"
            />
            Enable DevTools
          </label>
          <p class="setting-description">
            Enable or disable the AI Nuxt DevTools panel
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.devtools.autoRefresh"
              class="setting-checkbox"
            />
            Auto Refresh
          </label>
          <p class="setting-description">
            Automatically refresh data every 30 seconds
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Theme</label>
          <select v-model="settings.devtools.theme" class="setting-select">
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <p class="setting-description">
            Choose the DevTools theme
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3>Monitoring</h3>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.monitoring.enabled"
              class="setting-checkbox"
            />
            Enable Request Monitoring
          </label>
          <p class="setting-description">
            Track all AI requests and responses
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Max Requests to Store</label>
          <input 
            type="number" 
            v-model.number="settings.monitoring.maxRequests"
            class="setting-input"
            min="10"
            max="1000"
          />
          <p class="setting-description">
            Maximum number of requests to keep in memory
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.monitoring.includePrompts"
              class="setting-checkbox"
            />
            Include Full Prompts
          </label>
          <p class="setting-description">
            Store complete prompt content (may use more memory)
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.monitoring.includeResponses"
              class="setting-checkbox"
            />
            Include Full Responses
          </label>
          <p class="setting-description">
            Store complete response content (may use more memory)
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3>Cache</h3>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.cache.enabled"
              class="setting-checkbox"
            />
            Enable Cache Monitoring
          </label>
          <p class="setting-description">
            Monitor cache performance and statistics
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Cache TTL (seconds)</label>
          <input 
            type="number" 
            v-model.number="settings.cache.defaultTTL"
            class="setting-input"
            min="60"
            max="86400"
          />
          <p class="setting-description">
            Default time-to-live for cached items
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Max Cache Size (MB)</label>
          <input 
            type="number" 
            v-model.number="settings.cache.maxSize"
            class="setting-input"
            min="10"
            max="1000"
          />
          <p class="setting-description">
            Maximum cache size in megabytes
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3>Performance</h3>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.performance.enableMetrics"
              class="setting-checkbox"
            />
            Enable Performance Metrics
          </label>
          <p class="setting-description">
            Collect detailed performance metrics
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Metrics Retention (hours)</label>
          <input 
            type="number" 
            v-model.number="settings.performance.metricsRetention"
            class="setting-input"
            min="1"
            max="168"
          />
          <p class="setting-description">
            How long to keep performance metrics
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.performance.enableAlerts"
              class="setting-checkbox"
            />
            Enable Performance Alerts
          </label>
          <p class="setting-description">
            Show alerts for performance issues
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Alert Threshold (ms)</label>
          <input 
            type="number" 
            v-model.number="settings.performance.alertThreshold"
            class="setting-input"
            min="100"
            max="10000"
          />
          <p class="setting-description">
            Response time threshold for alerts
          </p>
        </div>
      </div>

      <div class="settings-section">
        <h3>Export & Import</h3>
        <div class="setting-actions">
          <button class="setting-action-button" @click="exportSettings">
            <div class="i-carbon-download" />
            Export Settings
          </button>
          <button class="setting-action-button" @click="importSettings">
            <div class="i-carbon-upload" />
            Import Settings
          </button>
          <input 
            ref="fileInput" 
            type="file" 
            accept=".json"
            style="display: none"
            @change="handleFileImport"
          />
        </div>
        <p class="setting-description">
          Export your settings to a file or import from a previously exported file
        </p>
      </div>

      <div class="settings-section">
        <h3>Debug</h3>
        <div class="setting-item">
          <label class="setting-label">
            <input 
              type="checkbox" 
              v-model="settings.debug.enabled"
              class="setting-checkbox"
            />
            Enable Debug Mode
          </label>
          <p class="setting-description">
            Show additional debug information in console
          </p>
        </div>

        <div class="setting-item">
          <label class="setting-label">Log Level</label>
          <select v-model="settings.debug.logLevel" class="setting-select">
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <p class="setting-description">
            Set the logging level for debug output
          </p>
        </div>

        <div class="setting-actions">
          <button class="setting-action-button" @click="clearLogs">
            <div class="i-carbon-trash-can" />
            Clear Logs
          </button>
          <button class="setting-action-button" @click="downloadLogs">
            <div class="i-carbon-download" />
            Download Logs
          </button>
        </div>
      </div>
    </div>

    <div v-if="saveStatus" class="save-status" :class="saveStatus.type">
      <div class="save-status-content">
        <div v-if="saveStatus.type === 'success'" class="i-carbon-checkmark-filled" />
        <div v-else class="i-carbon-error-filled" />
        {{ saveStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAISettings } from '../composables/useAISettings'

interface Settings {
  devtools: {
    enabled: boolean
    autoRefresh: boolean
    theme: 'auto' | 'light' | 'dark'
  }
  monitoring: {
    enabled: boolean
    maxRequests: number
    includePrompts: boolean
    includeResponses: boolean
  }
  cache: {
    enabled: boolean
    defaultTTL: number
    maxSize: number
  }
  performance: {
    enableMetrics: boolean
    metricsRetention: number
    enableAlerts: boolean
    alertThreshold: number
  }
  debug: {
    enabled: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
}

const { settings: currentSettings, saveSettings: saveSettingsToStore, resetSettings: resetSettingsToDefaults } = useAISettings()

const settings = reactive<Settings>({
  devtools: {
    enabled: true,
    autoRefresh: true,
    theme: 'auto'
  },
  monitoring: {
    enabled: true,
    maxRequests: 100,
    includePrompts: true,
    includeResponses: true
  },
  cache: {
    enabled: true,
    defaultTTL: 3600,
    maxSize: 100
  },
  performance: {
    enableMetrics: true,
    metricsRetention: 24,
    enableAlerts: true,
    alertThreshold: 2000
  },
  debug: {
    enabled: false,
    logLevel: 'info'
  }
})

const saveStatus = ref<{ type: 'success' | 'error', message: string } | null>(null)
const fileInput = ref<HTMLInputElement>()

async function saveSettings() {
  try {
    await saveSettingsToStore(settings)
    showSaveStatus('success', 'Settings saved successfully')
  } catch (error) {
    showSaveStatus('error', 'Failed to save settings')
  }
}

async function resetSettings() {
  try {
    await resetSettingsToDefaults()
    Object.assign(settings, currentSettings.value)
    showSaveStatus('success', 'Settings reset to defaults')
  } catch (error) {
    showSaveStatus('error', 'Failed to reset settings')
  }
}

function exportSettings() {
  const dataStr = JSON.stringify(settings, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'ai-nuxt-devtools-settings.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  showSaveStatus('success', 'Settings exported successfully')
}

function importSettings() {
  fileInput.value?.click()
}

function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const importedSettings = JSON.parse(e.target?.result as string)
      Object.assign(settings, importedSettings)
      showSaveStatus('success', 'Settings imported successfully')
    } catch (error) {
      showSaveStatus('error', 'Failed to import settings: Invalid JSON')
    }
  }
  reader.readAsText(file)
}

function clearLogs() {
  console.clear()
  showSaveStatus('success', 'Logs cleared')
}

function downloadLogs() {
  // This would typically collect logs from a logging service
  const logs = 'AI Nuxt DevTools Logs\n' + new Date().toISOString()
  const dataBlob = new Blob([logs], { type: 'text/plain' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'ai-nuxt-devtools-logs.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  showSaveStatus('success', 'Logs downloaded')
}

function showSaveStatus(type: 'success' | 'error', message: string) {
  saveStatus.value = { type, message }
  setTimeout(() => {
    saveStatus.value = null
  }, 3000)
}

onMounted(() => {
  Object.assign(settings, currentSettings.value)
})
</script>

<style scoped>
.settings-panel {
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
  background-color: #4f46e5;
  color: white;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background-color: #3730a3;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.settings-section {
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.settings-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

.setting-item {
  margin-bottom: 1rem;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.setting-checkbox {
  width: 1rem;
  height: 1rem;
}

.setting-input,
.setting-select {
  width: 100%;
  max-width: 200px;
  padding: 0.375rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.setting-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.setting-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.setting-action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: #f3f4f6;
  transition: background-color 0.2s ease;
}

.setting-action-button:hover {
  background-color: #e5e7eb;
}

.save-status {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

.save-status.success {
  background-color: #10b981;
  color: white;
}

.save-status.error {
  background-color: #ef4444;
  color: white;
}

.save-status-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .settings-section {
    border-color: #374151;
    background-color: #1f2937;
  }

  .settings-section h3 {
    color: #f9fafb;
  }

  .setting-input,
  .setting-select {
    border-color: #4b5563;
    background-color: #1f2937;
    color: #f9fafb;
  }

  .setting-action-button {
    background-color: #374151;
  }

  .setting-action-button:hover {
    background-color: #4b5563;
  }
}
</style>