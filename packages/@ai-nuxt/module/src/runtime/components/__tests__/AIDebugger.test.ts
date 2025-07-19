import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIDebugger from '../AIDebugger.vue'
import type { DebugRequest } from '../AIDebugger.vue'

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: vi.fn(),
    remove: vi.fn()
  }))
})

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn()
})

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn()
})

describe('AIDebugger', () => {
  let wrapper: VueWrapper<any>

  const mockRequests: DebugRequest[] = [
    {
      id: 'req-1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      method: 'chat',
      provider: 'openai',
      model: 'gpt-4',
      status: 'success',
      duration: 1500,
      request: { prompt: 'Hello world' },
      response: { text: 'Hello! How can I help you?' },
      tokens: { prompt: 10, completion: 15, total: 25 },
      cost: 0.001
    },
    {
      id: 'req-2',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      method: 'completion',
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      status: 'error',
      duration: 800,
      request: { prompt: 'Generate code' },
      error: 'API rate limit exceeded'
    },
    {
      id: 'req-3',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      method: 'embedding',
      provider: 'openai',
      model: 'text-embedding-ada-002',
      status: 'pending',
      duration: 0,
      request: { text: 'Sample text for embedding' }
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
    wrapper = mount(AIDebugger)

    expect(wrapper.find('.ai-debugger').exists()).toBe(true)
    expect(wrapper.find('.ai-debugger__title').text()).toContain('AI Debugger')
  })

  it('should start collapsed when autoCollapse is true', () => {
    wrapper = mount(AIDebugger, {
      props: {
        autoCollapse: true
      }
    })

    expect(wrapper.find('.ai-debugger--collapsed').exists()).toBe(true)
    expect(wrapper.find('.ai-debugger__content').exists()).toBe(false)
  })

  it('should toggle collapse when header is clicked', async () => {
    wrapper = mount(AIDebugger)

    const header = wrapper.find('.ai-debugger__header')
    await header.trigger('click')

    expect(wrapper.find('.ai-debugger--collapsed').exists()).toBe(true)

    await header.trigger('click')

    expect(wrapper.find('.ai-debugger--collapsed').exists()).toBe(false)
  })

  it('should display summary statistics', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    const stats = wrapper.findAll('.ai-debugger__stat-value')
    expect(stats[0].text()).toBe('3') // Total requests
    expect(stats[1].text()).toBe('25') // Total tokens
    expect(stats[2].text()).toBe('$0.0010') // Total cost
    expect(stats[3].text()).toBe('1150ms') // Average latency (1500 + 800) / 2
  })

  it('should show correct tab counts', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    const tabCounts = wrapper.findAll('.ai-debugger__tab-count')
    expect(tabCounts[0].text()).toBe('3') // Requests count
    expect(tabCounts[1].text()).toBe('1') // Errors count
  })

  it('should switch between tabs', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    // Start on requests tab
    expect(wrapper.find('.ai-debugger__requests').exists()).toBe(true)

    // Switch to performance tab
    const performanceTab = wrapper.findAll('.ai-debugger__tab')[1]
    await performanceTab.trigger('click')

    expect(wrapper.find('.ai-debugger__performance').exists()).toBe(true)
    expect(wrapper.find('.ai-debugger__requests').exists()).toBe(false)
  })

  it('should display request list correctly', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    const requestItems = wrapper.findAll('.ai-debugger__request')
    expect(requestItems).toHaveLength(3)

    // Check first request
    const firstRequest = requestItems[0]
    expect(firstRequest.find('.ai-debugger__request-method').text()).toBe('CHAT')
    expect(firstRequest.find('.ai-debugger__request-provider').text()).toBe('openai')
    expect(firstRequest.find('.ai-debugger__request-model').text()).toBe('gpt-4')
    expect(firstRequest.find('.ai-debugger__request-duration').text()).toBe('1500ms')
    expect(firstRequest.classes()).toContain('ai-debugger__request--success')

    // Check error request
    const errorRequest = requestItems[1]
    expect(errorRequest.classes()).toContain('ai-debugger__request--error')

    // Check pending request
    const pendingRequest = requestItems[2]
    expect(pendingRequest.classes()).toContain('ai-debugger__request--pending')
  })

  it('should expand request details when clicked', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    const firstRequest = wrapper.find('.ai-debugger__request')
    await firstRequest.trigger('click')

    expect(wrapper.find('.ai-debugger__request-details').exists()).toBe(true)
    expect(wrapper.find('.ai-debugger__code').exists()).toBe(true)
  })

  it('should show performance charts', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    // Switch to performance tab
    const performanceTab = wrapper.findAll('.ai-debugger__tab')[1]
    await performanceTab.trigger('click')

    expect(wrapper.find('.ai-debugger__charts').exists()).toBe(true)
    expect(wrapper.findAll('.ai-debugger__chart')).toHaveLength(2)
    expect(wrapper.find('.ai-debugger__perf-metrics').exists()).toBe(true)
  })

  it('should calculate performance metrics correctly', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    // Switch to performance tab
    const performanceTab = wrapper.findAll('.ai-debugger__tab')[1]
    await performanceTab.trigger('click')

    const perfValues = wrapper.findAll('.ai-debugger__perf-value')
    expect(perfValues[0].text()).toBe('800ms') // Fastest response
    expect(perfValues[1].text()).toBe('1500ms') // Slowest response
    expect(perfValues[2].text()).toBe('50%') // Success rate (1 success out of 2 completed)
    expect(perfValues[3].text()).toBe('25') // Average tokens
  })

  it('should show errors tab correctly', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    // Switch to errors tab
    const errorsTab = wrapper.findAll('.ai-debugger__tab')[2]
    await errorsTab.trigger('click')

    expect(wrapper.find('.ai-debugger__errors').exists()).toBe(true)
    
    const errorItems = wrapper.findAll('.ai-debugger__error-item')
    expect(errorItems).toHaveLength(1)
    
    const errorItem = errorItems[0]
    expect(errorItem.find('.ai-debugger__error-provider').text()).toBe('anthropic/claude-3-sonnet')
    expect(errorItem.find('.ai-debugger__error-message').text()).toBe('API rate limit exceeded')
  })

  it('should handle settings changes', async () => {
    wrapper = mount(AIDebugger)

    await nextTick()

    // Switch to settings tab
    const settingsTab = wrapper.findAll('.ai-debugger__tab')[3]
    await settingsTab.trigger('click')

    expect(wrapper.find('.ai-debugger__settings').exists()).toBe(true)

    // Toggle enabled setting
    const enabledCheckbox = wrapper.find('input[type=\"checkbox\"]')
    await enabledCheckbox.setChecked(false)

    expect(wrapper.emitted('settings-change')).toBeTruthy()
    const settingsChange = wrapper.emitted('settings-change')?.[0]?.[0] as any
    expect(settingsChange.enabled).toBe(false)
  })

  it('should clear history when clear button is clicked', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    const clearButton = wrapper.find('[title=\"Clear history\"]')
    await clearButton.trigger('click')

    // Should clear internal requests (when not in controlled mode)
    expect(wrapper.vm.internalRequests).toHaveLength(0)
  })

  it('should export data when export button is clicked', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()

    // Switch to settings tab
    const settingsTab = wrapper.findAll('.ai-debugger__tab')[3]
    await settingsTab.trigger('click')

    const exportButton = wrapper.find('.ai-debugger__export-button')
    await exportButton.trigger('click')

    expect(wrapper.emitted('export')).toBeTruthy()
    expect(wrapper.emitted('export')?.[0]?.[0]).toEqual(mockRequests)
  })

  it('should format time correctly', () => {
    wrapper = mount(AIDebugger)

    const vm = wrapper.vm
    const testDate = new Date('2024-01-01T10:30:45Z')
    const formatted = vm.formatTime(testDate)

    expect(typeof formatted).toBe('string')
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })

  it('should handle empty state correctly', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        requests: []
      }
    })

    await nextTick()

    expect(wrapper.find('.ai-debugger__empty').exists()).toBe(true)
    expect(wrapper.find('.ai-debugger__empty').text()).toContain('No requests yet')

    // Switch to errors tab
    const errorsTab = wrapper.findAll('.ai-debugger__tab')[2]
    await errorsTab.trigger('click')

    expect(wrapper.find('.ai-debugger__empty').text()).toContain('No errors recorded')
  })

  it('should handle controlled mode vs internal mode', async () => {
    // Test controlled mode (external requests)
    wrapper = mount(AIDebugger, {
      props: {
        requests: mockRequests
      }
    })

    await nextTick()
    expect(wrapper.vm.requests).toEqual(mockRequests)

    wrapper.unmount()

    // Test internal mode (no external requests)
    wrapper = mount(AIDebugger, {
      props: {
        requests: []
      }
    })

    await nextTick()
    expect(wrapper.vm.requests).toEqual(wrapper.vm.internalRequests)
  })

  it('should expose methods correctly', () => {
    wrapper = mount(AIDebugger)

    const vm = wrapper.vm
    expect(typeof vm.addRequest).toBe('function')
    expect(typeof vm.updateRequest).toBe('function')
    expect(typeof vm.clearHistory).toBe('function')
    expect(typeof vm.exportData).toBe('function')
    expect(typeof vm.toggleCollapse).toBe('function')
  })

  it('should add and update requests in internal mode', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        enabled: true,
        maxEntries: 10
      }
    })

    const vm = wrapper.vm

    // Add a request
    const newRequest: DebugRequest = {
      id: 'test-req',
      timestamp: new Date(),
      method: 'chat',
      provider: 'openai',
      model: 'gpt-4',
      status: 'pending',
      duration: 0,
      request: { prompt: 'Test' }
    }

    vm.addRequest(newRequest)
    await nextTick()

    expect(vm.internalRequests).toHaveLength(1)
    expect(vm.internalRequests[0].id).toBe('test-req')

    // Update the request
    vm.updateRequest('test-req', {
      status: 'success',
      duration: 1000,
      response: { text: 'Test response' }
    })
    await nextTick()

    expect(vm.internalRequests[0].status).toBe('success')
    expect(vm.internalRequests[0].duration).toBe(1000)
    expect(vm.internalRequests[0].response).toEqual({ text: 'Test response' })
  })

  it('should respect maxEntries setting', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        enabled: true,
        maxEntries: 2
      }
    })

    const vm = wrapper.vm

    // Add 3 requests (should keep only last 2)
    for (let i = 1; i <= 3; i++) {
      vm.addRequest({
        id: `req-${i}`,
        timestamp: new Date(),
        method: 'chat',
        provider: 'openai',
        model: 'gpt-4',
        status: 'success',
        duration: 1000,
        request: { prompt: `Test ${i}` }
      })
    }

    await nextTick()

    expect(vm.internalRequests).toHaveLength(2)
    expect(vm.internalRequests[0].id).toBe('req-2')
    expect(vm.internalRequests[1].id).toBe('req-3')
  })

  it('should not add requests when disabled', async () => {
    wrapper = mount(AIDebugger, {
      props: {
        enabled: false
      }
    })

    const vm = wrapper.vm

    vm.addRequest({
      id: 'test-req',
      timestamp: new Date(),
      method: 'chat',
      provider: 'openai',
      model: 'gpt-4',
      status: 'pending',
      duration: 0,
      request: { prompt: 'Test' }
    })

    await nextTick()

    expect(vm.internalRequests).toHaveLength(0)
  })
})