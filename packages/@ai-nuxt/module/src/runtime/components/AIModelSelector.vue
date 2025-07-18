<template>
  <div class="ai-model-selector" :class="{ 'ai-model-selector--disabled': disabled }">
    <!-- Header -->
    <div v-if="showHeader" class="ai-model-selector__header">
      <h3 class="ai-model-selector__title">{{ title }}</h3>
      <div class="ai-model-selector__status">
        <span 
          class="ai-model-selector__status-indicator"
          :class="{
            'ai-model-selector__status-indicator--connected': isConnected,
            'ai-model-selector__status-indicator--error': hasError
          }"
        ></span>
        <span class="ai-model-selector__status-text">{{ statusText }}</span>
      </div>
    </div>

    <!-- Provider Selection -->
    <div class="ai-model-selector__section">
      <label class="ai-model-selector__label">
        AI Provider
        <span v-if="required" class="ai-model-selector__required">*</span>
      </label>
      <div class="ai-model-selector__provider-grid">
        <div
          v-for="provider in availableProviders"
          :key="provider.id"
          class="ai-model-selector__provider-card"
          :class="{
            'ai-model-selector__provider-card--selected': selectedProvider?.id === provider.id,
            'ai-model-selector__provider-card--disabled': !provider.available || disabled
          }"
          @click="selectProvider(provider)"
        >
          <div class="ai-model-selector__provider-icon">
            {{ getProviderIcon(provider.id) }}
          </div>
          <div class="ai-model-selector__provider-info">
            <div class="ai-model-selector__provider-name">{{ provider.name }}</div>
            <div class="ai-model-selector__provider-status">
              {{ provider.available ? 'Available' : 'Not configured' }}
            </div>
          </div>
          <div v-if="provider.available" class="ai-model-selector__provider-badge">
            {{ provider.models?.length || 0 }} models
          </div>
        </div>
      </div>
    </div>

    <!-- Model Selection -->
    <div v-if="selectedProvider && availableModels.length > 0" class="ai-model-selector__section">
      <label class="ai-model-selector__label">
        Model
        <span v-if="required" class="ai-model-selector__required">*</span>
      </label>
      
      <!-- Compact View -->
      <div v-if="viewMode === 'compact'" class="ai-model-selector__compact">
        <select
          :model-value="selectedModelId"
          class="ai-model-selector__select"
          :disabled="disabled"
          @change="$event => { emit('update:selectedModelId', $event.target.value); handleModelChange(); }"
        >
          <option value="">Select a model...</option>
          <option
            v-for="model in availableModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.name }} {{ model.description ? `- ${model.description}` : '' }}
          </option>
        </select>
      </div>

      <!-- Grid View -->
      <div v-else class="ai-model-selector__model-grid">
        <div
          v-for="model in availableModels"
          :key="model.id"
          class="ai-model-selector__model-card"
          :class="{
            'ai-model-selector__model-card--selected': selectedModelId === model.id,
            'ai-model-selector__model-card--disabled': disabled
          }"
          @click="selectModel(model)"
        >
          <div class="ai-model-selector__model-header">
            <div class="ai-model-selector__model-name">{{ model.name }}</div>
            <div v-if="model.tier" class="ai-model-selector__model-tier">{{ model.tier }}</div>
          </div>
          <div v-if="model.description" class="ai-model-selector__model-description">
            {{ model.description }}
          </div>
          <div class="ai-model-selector__model-specs">
            <div v-if="model.contextLength" class="ai-model-selector__model-spec">
              <span class="ai-model-selector__spec-label">Context:</span>
              <span class="ai-model-selector__spec-value">{{ formatContextLength(model.contextLength) }}</span>
            </div>
            <div v-if="model.pricing" class="ai-model-selector__model-spec">
              <span class="ai-model-selector__spec-label">Cost:</span>
              <span class="ai-model-selector__spec-value">${{ model.pricing.input }}/1K tokens</span>
            </div>
            <div v-if="model.capabilities" class="ai-model-selector__model-capabilities">
              <span
                v-for="capability in model.capabilities"
                :key="capability"
                class="ai-model-selector__capability-tag"
              >
                {{ capability }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration -->
    <div v-if="showConfiguration && selectedProvider" class="ai-model-selector__section">
      <label class="ai-model-selector__label">Configuration</label>
      <div class="ai-model-selector__config-grid">
        <!-- Temperature -->
        <div class="ai-model-selector__config-item">
          <label class="ai-model-selector__config-label">
            Temperature: {{ temperature }}
          </label>
          <input
            v-model.number="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="ai-model-selector__range"
            :disabled="disabled"
            @input="handleConfigChange"
          />
          <div class="ai-model-selector__range-labels">
            <span>Focused</span>
            <span>Creative</span>
          </div>
        </div>

        <!-- Max Tokens -->
        <div class="ai-model-selector__config-item">
          <label class="ai-model-selector__config-label">Max Tokens</label>
          <input
            v-model.number="maxTokens"
            type="number"
            min="1"
            :max="selectedModel?.contextLength || 4000"
            class="ai-model-selector__input"
            :disabled="disabled"
            @input="handleConfigChange"
          />
        </div>

        <!-- Top P -->
        <div v-if="showAdvanced" class="ai-model-selector__config-item">
          <label class="ai-model-selector__config-label">
            Top P: {{ topP }}
          </label>
          <input
            v-model.number="topP"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="ai-model-selector__range"
            :disabled="disabled"
            @input="handleConfigChange"
          />
        </div>

        <!-- Frequency Penalty -->
        <div v-if="showAdvanced" class="ai-model-selector__config-item">
          <label class="ai-model-selector__config-label">
            Frequency Penalty: {{ frequencyPenalty }}
          </label>
          <input
            v-model.number="frequencyPenalty"
            type="range"
            min="-2"
            max="2"
            step="0.1"
            class="ai-model-selector__range"
            :disabled="disabled"
            @input="handleConfigChange"
          />
        </div>
      </div>
      
      <button
        @click="showAdvanced = !showAdvanced"
        class="ai-model-selector__toggle-advanced"
        type="button"
      >
        {{ showAdvanced ? 'Hide' : 'Show' }} Advanced Settings
      </button>
    </div>

    <!-- Actions -->
    <div v-if="showActions" class="ai-model-selector__actions">
      <button
        @click="resetToDefaults"
        class="ai-model-selector__action-button ai-model-selector__action-button--secondary"
        :disabled="disabled"
        type="button"
      >
        Reset
      </button>
      <button
        @click="savePreset"
        class="ai-model-selector__action-button ai-model-selector__action-button--secondary"
        :disabled="disabled || !canSavePreset"
        type="button"
      >
        Save Preset
      </button>
      <button
        @click="toggleViewMode"
        class="ai-model-selector__action-button ai-model-selector__action-button--secondary"
        type="button"
      >
        {{ viewMode === 'compact' ? 'Grid View' : 'Compact View' }}
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="ai-model-selector__error">
      <span class="ai-model-selector__error-icon">⚠️</span>
      <span class="ai-model-selector__error-text">{{ error }}</span>
    </div>
  </div>
</template><script set
up lang="ts">
import { ref, computed, watch } from 'vue'

// Types
export interface AIModel {
  id: string
  name: string
  description?: string
  tier?: 'free' | 'pro' | 'premium'
  contextLength?: number
  pricing?: {
    input: number
    output: number
  }
  capabilities?: string[]
}

export interface AIProvider {
  id: string
  name: string
  available: boolean
  models?: AIModel[]
  defaultModel?: string
}

export interface ModelConfiguration {
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
}

export interface AIModelSelectorProps {
  // Selection
  providers?: AIProvider[]
  selectedProviderId?: string
  selectedModelId?: string
  
  // Configuration
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  
  // UI Options
  title?: string
  showHeader?: boolean
  showConfiguration?: boolean
  showActions?: boolean
  viewMode?: 'compact' | 'grid'
  required?: boolean
  disabled?: boolean
  
  // Status
  isConnected?: boolean
  error?: string
}

const props = withDefaults(defineProps<AIModelSelectorProps>(), {
  providers: () => [],
  selectedProviderId: '',
  selectedModelId: '',
  temperature: 0.7,
  maxTokens: 1000,
  topP: 1,
  frequencyPenalty: 0,
  title: 'AI Model Selection',
  showHeader: true,
  showConfiguration: true,
  showActions: true,
  viewMode: 'grid',
  required: false,
  disabled: false,
  isConnected: true,
  error: ''
})

// Emits
const emit = defineEmits<{
  'update:selectedProviderId': [value: string]
  'update:selectedModelId': [value: string]
  'update:temperature': [value: number]
  'update:maxTokens': [value: number]
  'update:topP': [value: number]
  'update:frequencyPenalty': [value: number]
  'provider-change': [provider: AIProvider]
  'model-change': [model: AIModel]
  'config-change': [config: ModelConfiguration]
  'preset-save': [config: ModelConfiguration & { provider: string; model: string }]
}>()

// State
const temperature = ref(props.temperature)
const maxTokens = ref(props.maxTokens)
const topP = ref(props.topP)
const frequencyPenalty = ref(props.frequencyPenalty)
const showAdvanced = ref(false)
const viewMode = ref(props.viewMode)

// Default providers with models
const defaultProviders: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    available: true,
    defaultModel: 'gpt-4',
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Most capable model, best for complex tasks',
        tier: 'premium',
        contextLength: 8192,
        pricing: { input: 0.03, output: 0.06 },
        capabilities: ['text', 'reasoning', 'code']
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Faster and more efficient GPT-4',
        tier: 'premium',
        contextLength: 128000,
        pricing: { input: 0.01, output: 0.03 },
        capabilities: ['text', 'reasoning', 'code', 'vision']
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient for most tasks',
        tier: 'pro',
        contextLength: 16384,
        pricing: { input: 0.001, output: 0.002 },
        capabilities: ['text', 'code']
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    available: true,
    defaultModel: 'claude-3-sonnet',
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        tier: 'premium',
        contextLength: 200000,
        pricing: { input: 0.015, output: 0.075 },
        capabilities: ['text', 'reasoning', 'analysis', 'vision']
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        tier: 'pro',
        contextLength: 200000,
        pricing: { input: 0.003, output: 0.015 },
        capabilities: ['text', 'reasoning', 'analysis']
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fastest model for simple tasks',
        tier: 'free',
        contextLength: 200000,
        pricing: { input: 0.00025, output: 0.00125 },
        capabilities: ['text', 'speed']
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    available: false,
    models: [
      {
        id: 'llama2',
        name: 'Llama 2',
        description: 'Open source model running locally',
        tier: 'free',
        contextLength: 4096,
        capabilities: ['text', 'local']
      },
      {
        id: 'codellama',
        name: 'Code Llama',
        description: 'Specialized for code generation',
        tier: 'free',
        contextLength: 4096,
        capabilities: ['code', 'local']
      }
    ]
  }
]

// Computed
const availableProviders = computed(() => {
  return props.providers.length > 0 ? props.providers : defaultProviders
})

const selectedProvider = computed(() => {
  return availableProviders.value.find(p => p.id === props.selectedProviderId)
})

const availableModels = computed(() => {
  return selectedProvider.value?.models || []
})

const selectedModel = computed(() => {
  return availableModels.value.find(m => m.id === props.selectedModelId)
})

const hasError = computed(() => !!props.error)

const statusText = computed(() => {
  if (props.error) return 'Error'
  if (!props.isConnected) return 'Disconnected'
  if (selectedProvider.value && selectedModel.value) {
    return `${selectedProvider.value.name} - ${selectedModel.value.name}`
  }
  return 'Select provider and model'
})

const canSavePreset = computed(() => {
  return selectedProvider.value && selectedModel.value
})

// Methods
const getProviderIcon = (providerId: string): string => {
  const icons: Record<string, string> = {
    openai: '🤖',
    anthropic: '🧠',
    ollama: '🦙',
    google: '🔍',
    cohere: '🌊'
  }
  return icons[providerId] || '⚡'
}

const formatContextLength = (length: number): string => {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M`
  } else if (length >= 1000) {
    return `${(length / 1000).toFixed(0)}K`
  }
  return length.toString()
}

const selectProvider = (provider: AIProvider) => {
  if (!provider.available || props.disabled) return
  
  emit('update:selectedProviderId', provider.id)
  emit('provider-change', provider)
  
  // Auto-select default model if available
  if (provider.defaultModel && provider.models) {
    const defaultModel = provider.models.find(m => m.id === provider.defaultModel)
    if (defaultModel) {
      selectModel(defaultModel)
    }
  }
}

const selectModel = (model: AIModel) => {
  if (props.disabled) return
  
  emit('update:selectedModelId', model.id)
  emit('model-change', model)
  
  // Adjust max tokens if it exceeds model's context length
  if (model.contextLength && maxTokens.value > model.contextLength) {
    maxTokens.value = Math.min(model.contextLength, 4000)
    emit('update:maxTokens', maxTokens.value)
  }
}

const handleModelChange = () => {
  const model = availableModels.value.find(m => m.id === props.selectedModelId)
  if (model) {
    emit('model-change', model)
  }
}

const handleConfigChange = () => {
  emit('update:temperature', temperature.value)
  emit('update:maxTokens', maxTokens.value)
  emit('update:topP', topP.value)
  emit('update:frequencyPenalty', frequencyPenalty.value)
  
  emit('config-change', {
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    topP: topP.value,
    frequencyPenalty: frequencyPenalty.value
  })
}

const resetToDefaults = () => {
  temperature.value = 0.7
  maxTokens.value = 1000
  topP.value = 1
  frequencyPenalty.value = 0
  handleConfigChange()
}

const savePreset = () => {
  if (canSavePreset.value) {
    emit('preset-save', {
      provider: props.selectedProviderId,
      model: props.selectedModelId,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      topP: topP.value,
      frequencyPenalty: frequencyPenalty.value
    })
  }
}

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'compact' ? 'grid' : 'compact'
}

// Watchers
watch(() => props.temperature, (newVal) => {
  temperature.value = newVal
})

watch(() => props.maxTokens, (newVal) => {
  maxTokens.value = newVal
})

watch(() => props.topP, (newVal) => {
  topP.value = newVal
})

watch(() => props.frequencyPenalty, (newVal) => {
  frequencyPenalty.value = newVal
})
</script>
<sty
le scoped>
.ai-model-selector {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-model-selector--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* Header */
.ai-model-selector__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.ai-model-selector__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.ai-model-selector__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-model-selector__status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.ai-model-selector__status-indicator--connected {
  background: #10b981;
}

.ai-model-selector__status-indicator--error {
  background: #ef4444;
}

.ai-model-selector__status-text {
  font-size: 0.875rem;
  color: #64748b;
}

/* Sections */
.ai-model-selector__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-model-selector__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.ai-model-selector__required {
  color: #ef4444;
}

/* Provider Grid */
.ai-model-selector__provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.ai-model-selector__provider-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-model-selector__provider-card:hover:not(.ai-model-selector__provider-card--disabled) {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.ai-model-selector__provider-card--selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.ai-model-selector__provider-card--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-model-selector__provider-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.ai-model-selector__provider-info {
  flex: 1;
}

.ai-model-selector__provider-name {
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.25rem;
}

.ai-model-selector__provider-status {
  font-size: 0.875rem;
  color: #64748b;
}

.ai-model-selector__provider-badge {
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  color: #475569;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Model Selection */
.ai-model-selector__select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  color: #374151;
}

.ai-model-selector__select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.ai-model-selector__model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.ai-model-selector__model-card {
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-model-selector__model-card:hover:not(.ai-model-selector__model-card--disabled) {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.ai-model-selector__model-card--selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.ai-model-selector__model-card--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-model-selector__model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.ai-model-selector__model-name {
  font-weight: 600;
  color: #1e293b;
}

.ai-model-selector__model-tier {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.ai-model-selector__model-tier {
  background: #f3f4f6;
  color: #6b7280;
}

.ai-model-selector__model-description {
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.ai-model-selector__model-specs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-model-selector__model-spec {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.ai-model-selector__spec-label {
  color: #6b7280;
}

.ai-model-selector__spec-value {
  color: #374151;
  font-weight: 500;
}

.ai-model-selector__model-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.ai-model-selector__capability-tag {
  padding: 0.125rem 0.375rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 500;
  text-transform: capitalize;
}

/* Configuration */
.ai-model-selector__config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.ai-model-selector__config-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ai-model-selector__config-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.ai-model-selector__input {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.ai-model-selector__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.ai-model-selector__range {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  appearance: none;
}

.ai-model-selector__range::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-model-selector__range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-model-selector__range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
}

.ai-model-selector__toggle-advanced {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-model-selector__toggle-advanced:hover {
  background: #f3f4f6;
}

/* Actions */
.ai-model-selector__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ai-model-selector__action-button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-model-selector__action-button--secondary {
  background: white;
  color: #374151;
}

.ai-model-selector__action-button--secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.ai-model-selector__action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Error */
.ai-model-selector__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .ai-model-selector__provider-grid,
  .ai-model-selector__model-grid {
    grid-template-columns: 1fr;
  }
  
  .ai-model-selector__config-grid {
    grid-template-columns: 1fr;
  }
  
  .ai-model-selector__actions {
    flex-direction: column;
  }
  
  .ai-model-selector__provider-card {
    flex-direction: column;
    text-align: center;
    gap: 0.75rem;
  }
  
  .ai-model-selector__provider-info {
    order: 1;
  }
  
  .ai-model-selector__provider-badge {
    order: 2;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .ai-model-selector {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  .ai-model-selector__provider-card,
  .ai-model-selector__model-card {
    background: #1f2937;
    border-color: #374151;
  }
  
  .ai-model-selector__provider-card--selected,
  .ai-model-selector__model-card--selected {
    background: #1e3a8a;
    border-color: #3b82f6;
  }
  
  .ai-model-selector__input,
  .ai-model-selector__select {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
}
</style>