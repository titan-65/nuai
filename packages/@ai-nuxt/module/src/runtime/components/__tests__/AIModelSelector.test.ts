import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIModelSelector from '../AIModelSelector.vue'
import type { AIProvider, AIModel } from '../AIModelSelector.vue'

describe('AIModelSelector', () => {
  let wrapper: VueWrapper<any>

  const mockProviders: AIProvider[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      available: true,
      defaultModel: 'gpt-4',
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'Most capable model',
          tier: 'premium',
          contextLength: 8192,
          pricing: { input: 0.03, output: 0.06 },
          capabilities: ['text', 'reasoning']
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Fast and efficient',
          tier: 'pro',
          contextLength: 4096,
          pricing: { input: 0.001, output: 0.002 },
          capabilities: ['text']
        }
      ]
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      available: false,
      models: []
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('should render with default props', () => {
    wrapper = mount(AIModelSelector)

    expect(wrapper.find('.ai-model-selector').exists()).toBe(true)
    expect(wrapper.find('.ai-model-selector__title').text()).toBe('AI Model Selection')
  })

  it('should render custom providers', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders
      }
    })

    await nextTick()

    const providerCards = wrapper.findAll('.ai-model-selector__provider-card')
    expect(providerCards).toHaveLength(2)
    
    expect(providerCards[0].find('.ai-model-selector__provider-name').text()).toBe('OpenAI')
    expect(providerCards[1].find('.ai-model-selector__provider-name').text()).toBe('Anthropic')
  })

  it('should show provider availability status', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders
      }
    })

    await nextTick()

    const providerCards = wrapper.findAll('.ai-model-selector__provider-card')
    
    expect(providerCards[0].find('.ai-model-selector__provider-status').text()).toBe('Available')
    expect(providerCards[1].find('.ai-model-selector__provider-status').text()).toBe('Not configured')
    
    expect(providerCards[0].classes()).not.toContain('ai-model-selector__provider-card--disabled')
    expect(providerCards[1].classes()).toContain('ai-model-selector__provider-card--disabled')
  })

  it('should select provider when clicked', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders
      }
    })

    await nextTick()

    const firstProvider = wrapper.find('.ai-model-selector__provider-card')
    await firstProvider.trigger('click')

    expect(wrapper.emitted('update:selectedProviderId')).toBeTruthy()
    expect(wrapper.emitted('update:selectedProviderId')?.[0]).toEqual(['openai'])
    expect(wrapper.emitted('provider-change')).toBeTruthy()
  })

  it('should show models when provider is selected', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai'
      }
    })

    await nextTick()

    const modelCards = wrapper.findAll('.ai-model-selector__model-card')
    expect(modelCards).toHaveLength(2)
    
    expect(modelCards[0].find('.ai-model-selector__model-name').text()).toBe('GPT-4')
    expect(modelCards[1].find('.ai-model-selector__model-name').text()).toBe('GPT-3.5 Turbo')
  })

  it('should select model when clicked', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai'
      }
    })

    await nextTick()

    const firstModel = wrapper.find('.ai-model-selector__model-card')
    await firstModel.trigger('click')

    expect(wrapper.emitted('update:selectedModelId')).toBeTruthy()
    expect(wrapper.emitted('update:selectedModelId')?.[0]).toEqual(['gpt-4'])
    expect(wrapper.emitted('model-change')).toBeTruthy()
  })

  it('should show model details', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai'
      }
    })

    await nextTick()

    const firstModel = wrapper.find('.ai-model-selector__model-card')
    
    expect(firstModel.find('.ai-model-selector__model-description').text()).toBe('Most capable model')
    expect(firstModel.find('.ai-model-selector__model-tier').text()).toBe('premium')
    expect(firstModel.text()).toContain('Context: 8K')
    expect(firstModel.text()).toContain('Cost: $0.03/1K tokens')
    
    const capabilities = firstModel.findAll('.ai-model-selector__capability-tag')
    expect(capabilities).toHaveLength(2)
    expect(capabilities[0].text()).toBe('text')
    expect(capabilities[1].text()).toBe('reasoning')
  })

  it('should show compact view for models', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        viewMode: 'compact'
      }
    })

    await nextTick()

    const select = wrapper.find('.ai-model-selector__select')
    expect(select.exists()).toBe(true)
    
    const options = select.findAll('option')
    expect(options).toHaveLength(3) // Including placeholder option
    expect(options[1].text()).toContain('GPT-4')
    expect(options[2].text()).toContain('GPT-3.5 Turbo')
  })

  it('should show configuration section', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        showConfiguration: true
      }
    })

    await nextTick()

    expect(wrapper.find('.ai-model-selector__config-grid').exists()).toBe(true)
    
    const temperatureRange = wrapper.find('input[type="range"]')
    expect(temperatureRange.exists()).toBe(true)
    
    const maxTokensInput = wrapper.find('input[type="number"]')
    expect(maxTokensInput.exists()).toBe(true)
  })

  it('should update configuration values', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        showConfiguration: true,
        temperature: 0.5
      }
    })

    await nextTick()

    const temperatureRange = wrapper.find('input[type="range"]')
    await temperatureRange.setValue('0.8')

    expect(wrapper.emitted('update:temperature')).toBeTruthy()
    expect(wrapper.emitted('config-change')).toBeTruthy()
  })

  it('should show advanced settings when toggled', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        showConfiguration: true
      }
    })

    await nextTick()

    const toggleButton = wrapper.find('.ai-model-selector__toggle-advanced')
    await toggleButton.trigger('click')

    // Should show Top P and Frequency Penalty controls
    const ranges = wrapper.findAll('input[type="range"]')
    expect(ranges.length).toBeGreaterThan(1)
  })

  it('should reset to defaults', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        showActions: true,
        temperature: 1.5,
        maxTokens: 2000
      }
    })

    await nextTick()

    const resetButton = wrapper.find('.ai-model-selector__action-button--secondary')
    await resetButton.trigger('click')

    expect(wrapper.emitted('update:temperature')).toBeTruthy()
    expect(wrapper.emitted('update:maxTokens')).toBeTruthy()
    
    // Should emit default values
    const tempEmits = wrapper.emitted('update:temperature') as any[]
    const tokenEmits = wrapper.emitted('update:maxTokens') as any[]
    
    expect(tempEmits[tempEmits.length - 1][0]).toBe(0.7)
    expect(tokenEmits[tokenEmits.length - 1][0]).toBe(1000)
  })

  it('should save preset', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        selectedModelId: 'gpt-4',
        showActions: true
      }
    })

    await nextTick()

    const saveButton = wrapper.findAll('.ai-model-selector__action-button--secondary')[1] // Second button is save
    await saveButton.trigger('click')

    expect(wrapper.emitted('preset-save')).toBeTruthy()
    const presetData = wrapper.emitted('preset-save')?.[0]?.[0]
    expect(presetData).toHaveProperty('provider', 'openai')
    expect(presetData).toHaveProperty('model', 'gpt-4')
  })

  it('should toggle view mode', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        showActions: true,
        viewMode: 'grid'
      }
    })

    await nextTick()

    const toggleButton = wrapper.findAll('.ai-model-selector__action-button--secondary')[2] // Third button is view toggle
    expect(toggleButton.text()).toBe('Compact View')

    await toggleButton.trigger('click')

    // Should switch to compact view
    expect(wrapper.find('.ai-model-selector__select').exists()).toBe(true)
  })

  it('should show error state', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        error: 'Connection failed',
        isConnected: false
      }
    })

    await nextTick()

    expect(wrapper.find('.ai-model-selector__error').exists()).toBe(true)
    expect(wrapper.find('.ai-model-selector__error-text').text()).toBe('Connection failed')
    
    const statusIndicator = wrapper.find('.ai-model-selector__status-indicator')
    expect(statusIndicator.classes()).toContain('ai-model-selector__status-indicator--error')
  })

  it('should be disabled when disabled prop is true', () => {
    wrapper = mount(AIModelSelector, {
      props: {
        disabled: true
      }
    })

    expect(wrapper.find('.ai-model-selector--disabled').exists()).toBe(true)
  })

  it('should show required indicators', () => {
    wrapper = mount(AIModelSelector, {
      props: {
        required: true
      }
    })

    const requiredIndicators = wrapper.findAll('.ai-model-selector__required')
    expect(requiredIndicators.length).toBeGreaterThan(0)
  })

  it('should format context length correctly', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai'
      }
    })

    await nextTick()

    const modelCards = wrapper.findAll('.ai-model-selector__model-card')
    expect(modelCards[0].text()).toContain('8K') // 8192 -> 8K
    expect(modelCards[1].text()).toContain('4K') // 4096 -> 4K
  })

  it('should auto-select default model when provider is selected', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders
      }
    })

    await nextTick()

    const vm = wrapper.vm
    const openaiProvider = mockProviders[0]
    
    vm.selectProvider(openaiProvider)
    await nextTick()

    expect(wrapper.emitted('update:selectedModelId')).toBeTruthy()
    expect(wrapper.emitted('update:selectedModelId')?.[0]).toEqual(['gpt-4'])
  })

  it('should adjust max tokens when model context length is exceeded', async () => {
    wrapper = mount(AIModelSelector, {
      props: {
        providers: mockProviders,
        selectedProviderId: 'openai',
        maxTokens: 10000 // Exceeds GPT-4's 8192 context
      }
    })

    await nextTick()

    const vm = wrapper.vm
    const gpt4Model = mockProviders[0].models![0]
    
    vm.selectModel(gpt4Model)
    await nextTick()

    expect(wrapper.emitted('update:maxTokens')).toBeTruthy()
    const maxTokensEmits = wrapper.emitted('update:maxTokens') as any[]
    expect(maxTokensEmits[maxTokensEmits.length - 1][0]).toBeLessThanOrEqual(8192)
  })
})