import { ref } from 'vue'

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

const defaultSettings: Settings = {
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
}

const settings = ref<Settings>({ ...defaultSettings })

export function useAISettings() {
  async function saveSettings(newSettings: Settings) {
    try {
      await fetch('/__ai_nuxt_devtools/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      })
      settings.value = { ...newSettings }
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  async function resetSettings() {
    try {
      await fetch('/__ai_nuxt_devtools/api/settings', {
        method: 'DELETE'
      })
      settings.value = { ...defaultSettings }
    } catch (error) {
      console.error('Failed to reset settings:', error)
      throw error
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/settings')
      const data = await response.json()
      settings.value = { ...defaultSettings, ...data }
    } catch (error) {
      console.error('Failed to load settings:', error)
      settings.value = { ...defaultSettings }
    }
  }

  return {
    settings,
    saveSettings,
    resetSettings: resetSettings,
    loadSettings
  }
}