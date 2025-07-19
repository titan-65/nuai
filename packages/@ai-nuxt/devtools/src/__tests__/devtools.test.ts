import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DevToolsPanel from '../components/DevToolsPanel.vue'

// Mock the composables
vi.mock('../client/composables/useAIRequests', () => ({
  useAIRequests: () => ({
    requests: { value: [] },
    fetchRequests: vi.fn(),
    clearAllRequests: vi.fn()
  })
}))

vi.mock('../client/composables/useAIProviders', () => ({
  useAIProviders: () => ({
    providers: { value: [] },
    fetchProviders: vi.fn(),
    testProviderConnection: vi.fn()
  })
}))

vi.mock('../client/composables/useAICache', () => ({
  useAICache: () => ({
    cacheItems: { value: [] },
    cacheStats: { value: { size: 0, hits: 0, misses: 0, hitRate: 0 } },
    fetchCacheItems: vi.fn(),
    fetchCacheStats: vi.fn(),
    clearAllCache: vi.fn(),
    deleteCacheItem: vi.fn()
  })
}))

vi.mock('../client/composables/useAIModels', () => ({
  useAIModels: () => ({
    models: { value: [] },
    fetchModels: vi.fn(),
    testModel: vi.fn()
  })
}))

vi.mock('../client/composables/useAISettings', () => ({
  useAISettings: () => ({
    settings: { value: {} },
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    loadSettings: vi.fn()
  })
}))

vi.mock('../client/composables/useAIPlayground', () => ({
  useAIPlayground: () => ({
    availableModels: { value: [] },
    templates: { value: [] },
    runCompletion: vi.fn(),
    saveTemplate: vi.fn(),
    estimateTokens: vi.fn(),
    estimateCost: vi.fn()
  })
}))

describe('DevTools', () => {
  describe('DevToolsPanel', () => {
    let wrapper: any

    beforeEach(() => {
      wrapper = mount(DevToolsPanel, {
        props: {
          client: {},
          state: {}
        },
        global: {
          stubs: {
            RequestsPanel: true,
            ProvidersPanel: true,
            CachePanel: true,
            ModelsPanel: true,
            SettingsPanel: true,
            PlaygroundPanel: true
          }
        }
      })
    })

    it('renders the DevTools panel', () => {
      expect(wrapper.find('.ai-nuxt-devtools').exists()).toBe(true)
    })

    it('displays the correct title', () => {
      expect(wrapper.find('.ai-nuxt-devtools-title').text()).toContain('AI Nuxt DevTools')
    })

    it('renders all tab buttons', () => {
      const tabs = wrapper.findAll('.ai-nuxt-devtools-tab')
      expect(tabs).toHaveLength(6)
      
      const tabTexts = tabs.map((tab: any) => tab.text())
      expect(tabTexts).toContain('Requests')
      expect(tabTexts).toContain('Providers')
      expect(tabTexts).toContain('Cache')
      expect(tabTexts).toContain('Models')
      expect(tabTexts).toContain('Playground')
      expect(tabTexts).toContain('Settings')
    })

    it('switches tabs when clicked', async () => {
      const providersTab = wrapper.find('.ai-nuxt-devtools-tab:nth-child(2)')
      await providersTab.trigger('click')
      
      expect(providersTab.classes()).toContain('active')
    })

    it('shows the requests panel by default', () => {
      expect(wrapper.find('requests-panel-stub').exists()).toBe(true)
    })
  })

  describe('DevTools Module', () => {
    it('should export the module correctly', async () => {
      const module = await import('../index')
      expect(module.default).toBeDefined()
      expect(typeof module.default).toBe('function')
    })

    it('should have correct module metadata', async () => {
      const module = await import('../index')
      const moduleInstance = module.default({}, {})
      
      expect(moduleInstance.meta.name).toBe('@ai-nuxt/devtools')
      expect(moduleInstance.meta.configKey).toBe('aiNuxtDevtools')
    })
  })

  describe('API Routes', () => {
    it('should handle requests API', async () => {
      // Mock fetch for testing
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      const { useAIRequests } = await import('../client/composables/useAIRequests')
      const { fetchRequests } = useAIRequests()
      
      await fetchRequests()
      
      expect(fetch).toHaveBeenCalledWith('/__ai_nuxt_devtools/api/requests')
    })

    it('should handle providers API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      const { useAIProviders } = await import('../client/composables/useAIProviders')
      const { fetchProviders } = useAIProviders()
      
      await fetchProviders()
      
      expect(fetch).toHaveBeenCalledWith('/__ai_nuxt_devtools/api/providers')
    })

    it('should handle cache API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      })

      const { useAICache } = await import('../client/composables/useAICache')
      const { fetchCacheItems } = useAICache()
      
      await fetchCacheItems()
      
      expect(fetch).toHaveBeenCalledWith('/__ai_nuxt_devtools/api/cache/items')
    })
  })

  describe('Composables', () => {
    describe('useAIRequests', () => {
      it('should provide requests functionality', async () => {
        const { useAIRequests } = await import('../client/composables/useAIRequests')
        const { requests, fetchRequests, clearAllRequests } = useAIRequests()
        
        expect(requests).toBeDefined()
        expect(typeof fetchRequests).toBe('function')
        expect(typeof clearAllRequests).toBe('function')
      })
    })

    describe('useAIProviders', () => {
      it('should provide providers functionality', async () => {
        const { useAIProviders } = await import('../client/composables/useAIProviders')
        const { providers, fetchProviders, testProviderConnection } = useAIProviders()
        
        expect(providers).toBeDefined()
        expect(typeof fetchProviders).toBe('function')
        expect(typeof testProviderConnection).toBe('function')
      })
    })

    describe('useAICache', () => {
      it('should provide cache functionality', async () => {
        const { useAICache } = await import('../client/composables/useAICache')
        const { cacheItems, cacheStats, fetchCacheItems, clearAllCache } = useAICache()
        
        expect(cacheItems).toBeDefined()
        expect(cacheStats).toBeDefined()
        expect(typeof fetchCacheItems).toBe('function')
        expect(typeof clearAllCache).toBe('function')
      })
    })

    describe('useAIPlayground', () => {
      it('should provide playground functionality', async () => {
        const { useAIPlayground } = await import('../client/composables/useAIPlayground')
        const { availableModels, templates, runCompletion, estimateTokens } = useAIPlayground()
        
        expect(availableModels).toBeDefined()
        expect(templates).toBeDefined()
        expect(typeof runCompletion).toBe('function')
        expect(typeof estimateTokens).toBe('function')
      })

      it('should estimate tokens correctly', async () => {
        const { useAIPlayground } = await import('../client/composables/useAIPlayground')
        const { estimateTokens } = useAIPlayground()
        
        const tokens = estimateTokens('Hello world')
        expect(tokens).toBeGreaterThan(0)
        expect(typeof tokens).toBe('number')
      })

      it('should estimate cost correctly', async () => {
        const { useAIPlayground } = await import('../client/composables/useAIPlayground')
        const { estimateCost } = useAIPlayground()
        
        const cost = estimateCost(100, 'gpt-3.5-turbo')
        expect(cost).toBeGreaterThan(0)
        expect(typeof cost).toBe('number')
      })
    })
  })
})