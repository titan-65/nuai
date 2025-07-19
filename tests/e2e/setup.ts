/**
 * End-to-end test setup for AI Nuxt
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setup, createPage, url } from '@nuxt/test-utils/e2e'
import type { Browser, Page } from 'playwright'

// Global test configuration
export interface E2ETestContext {
  browser: Browser
  page: Page
  baseURL: string
}

// Test environment setup
beforeAll(async () => {
  // Setup Nuxt test environment
  await setup({
    // Use test configuration
    nuxtConfig: {
      aiNuxt: {
        // Use mock providers for testing
        providers: {
          openai: {
            apiKey: 'test-key',
            mock: true
          },
          anthropic: {
            apiKey: 'test-key',
            mock: true
          }
        },
        
        // Enable debug mode for testing
        debug: true,
        
        // Disable external services
        monitoring: {
          enabled: false
        },
        
        // Use memory-based services
        caching: {
          provider: 'memory',
          enabled: true
        },
        
        vectorStore: {
          provider: 'memory'
        }
      }
    },
    
    // Test server configuration
    server: true,
    port: 3001,
    
    // Browser configuration
    browser: true,
    browserOptions: {
      type: 'chromium',
      launch: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    }
  })
})

afterAll(async () => {
  // Cleanup test environment
  // This is handled automatically by @nuxt/test-utils
})

// Page setup for each test
export async function setupTestPage(): Promise<E2ETestContext> {
  const page = await createPage()
  
  // Set up page defaults
  await page.setViewportSize({ width: 1280, height: 720 })
  
  // Add console logging for debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Browser console error:', msg.text())
    }
  })
  
  // Handle uncaught exceptions
  page.on('pageerror', (error) => {
    console.error('Page error:', error)
  })
  
  return {
    browser: page.context().browser()!,
    page,
    baseURL: url('/')
  }
}

// Cleanup page after each test
export async function cleanupTestPage(context: E2ETestContext) {
  await context.page.close()
}

// Test utilities
export const testUtils = {
  /**
   * Wait for AI response
   */
  async waitForAIResponse(page: Page, timeout = 10000) {
    await page.waitForSelector('[data-testid="ai-response"]', { timeout })
  },

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(page: Page, timeout = 5000) {
    await page.waitForSelector('[data-testid="loading"]', { state: 'detached', timeout })
  },

  /**
   * Fill and submit chat input
   */
  async sendChatMessage(page: Page, message: string) {
    await page.fill('[data-testid="chat-input"]', message)
    await page.click('[data-testid="send-button"]')
  },

  /**
   * Get chat messages
   */
  async getChatMessages(page: Page) {
    return await page.$$eval('[data-testid="chat-message"]', (elements) =>
      elements.map((el) => ({
        role: el.getAttribute('data-role'),
        content: el.textContent?.trim()
      }))
    )
  },

  /**
   * Wait for streaming to complete
   */
  async waitForStreamingComplete(page: Page, timeout = 15000) {
    await page.waitForSelector('[data-testid="streaming-indicator"]', { 
      state: 'detached', 
      timeout 
    })
  },

  /**
   * Select AI provider
   */
  async selectProvider(page: Page, provider: string) {
    await page.selectOption('[data-testid="provider-selector"]', provider)
    await page.waitForTimeout(500) // Wait for provider switch
  },

  /**
   * Select AI model
   */
  async selectModel(page: Page, model: string) {
    await page.selectOption('[data-testid="model-selector"]', model)
    await page.waitForTimeout(500) // Wait for model switch
  },

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(page: Page) {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })
  },

  /**
   * Check for console errors
   */
  async getConsoleErrors(page: Page): Promise<string[]> {
    const errors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    return errors
  },

  /**
   * Mock API responses
   */
  async mockAIProvider(page: Page, provider: string, responses: Record<string, any>) {
    await page.route(`**/api/ai/**`, async (route) => {
      const url = route.request().url()
      const method = route.request().method()
      
      if (method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        
        // Mock chat responses
        if (url.includes('/chat')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: responses.chat || 'Mock AI response',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
              model: body.model || 'mock-model'
            })
          })
          return
        }
        
        // Mock completion responses
        if (url.includes('/completion')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: responses.completion || 'Mock completion',
              usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 },
              model: body.model || 'mock-model'
            })
          })
          return
        }
        
        // Mock embedding responses
        if (url.includes('/embedding')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
              usage: { promptTokens: 3, totalTokens: 3 },
              model: body.model || 'mock-embedding-model'
            })
          })
          return
        }
      }
      
      // Default to continuing the request
      await route.continue()
    })
  },

  /**
   * Mock specific API endpoints
   */
  async mockEndpoint(page: Page, endpoint: string, response: any, options?: {
    status?: number
    delay?: number
    method?: string
  }) {
    const { status = 200, delay = 0, method = 'POST' } = options || {}
    
    await page.route(`**${endpoint}`, async (route) => {
      if (route.request().method() === method) {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      } else {
        await route.continue()
      }
    })
  },

  /**
   * Simulate network conditions
   */
  async simulateNetworkConditions(page: Page, conditions: {
    offline?: boolean
    latency?: number
    downloadThroughput?: number
    uploadThroughput?: number
  }) {
    const client = await page.context().newCDPSession(page)
    
    if (conditions.offline) {
      await client.send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0
      })
    } else {
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: conditions.latency || 0,
        downloadThroughput: conditions.downloadThroughput || -1,
        uploadThroughput: conditions.uploadThroughput || -1
      })
    }
  },

  /**
   * Wait for specific network requests
   */
  async waitForRequest(page: Page, urlPattern: string, timeout = 5000) {
    return page.waitForRequest(request => 
      request.url().includes(urlPattern), { timeout }
    )
  },

  /**
   * Wait for specific network responses
   */
  async waitForResponse(page: Page, urlPattern: string, timeout = 5000) {
    return page.waitForResponse(response => 
      response.url().includes(urlPattern), { timeout }
    )
  },

  /**
   * Get all network requests made during a test
   */
  async captureNetworkRequests(page: Page, callback: () => Promise<void>) {
    const requests: any[] = []
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      })
    })
    
    await callback()
    
    return requests
  },

  /**
   * Verify accessibility
   */
  async checkAccessibility(page: Page) {
    // Basic accessibility checks
    const issues = await page.evaluate(() => {
      const issues: string[] = []
      
      // Check for missing alt text on images
      const images = document.querySelectorAll('img:not([alt])')
      if (images.length > 0) {
        issues.push(`${images.length} images missing alt text`)
      }
      
      // Check for missing form labels
      const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
      const unlabeledInputs = Array.from(inputs).filter(input => {
        const labels = document.querySelectorAll(`label[for="${input.id}"]`)
        return labels.length === 0
      })
      if (unlabeledInputs.length > 0) {
        issues.push(`${unlabeledInputs.length} inputs missing labels`)
      }
      
      // Check for missing headings structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      if (headings.length === 0) {
        issues.push('No heading structure found')
      }
      
      return issues
    })
    
    return issues
  },

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(page: Page, expectedFocusableElements: string[]) {
    const focusedElements: string[] = []
    
    for (let i = 0; i < expectedFocusableElements.length; i++) {
      await page.keyboard.press('Tab')
      const focusedElement = await page.locator(':focus').getAttribute('data-testid')
      if (focusedElement) {
        focusedElements.push(focusedElement)
      }
    }
    
    return focusedElements
  }
}

// Performance benchmarking utilities
export const benchmarkUtils = {
  /**
   * Measure operation performance
   */
  async measurePerformance<T>(
    operation: () => Promise<T>,
    name: string
  ): Promise<{ result: T; duration: number; memory?: number }> {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize
    
    const result = await operation()
    
    const endTime = performance.now()
    const endMemory = (performance as any).memory?.usedJSHeapSize
    
    return {
      result,
      duration: endTime - startTime,
      memory: endMemory && startMemory ? endMemory - startMemory : undefined
    }
  },

  /**
   * Run performance benchmark
   */
  async runBenchmark(
    page: Page,
    operation: () => Promise<void>,
    iterations = 10
  ) {
    const results: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      await operation()
      const endTime = performance.now()
      results.push(endTime - startTime)
      
      // Small delay between iterations
      await page.waitForTimeout(100)
    }
    
    return {
      min: Math.min(...results),
      max: Math.max(...results),
      avg: results.reduce((a, b) => a + b, 0) / results.length,
      median: results.sort((a, b) => a - b)[Math.floor(results.length / 2)],
      results
    }
  }
}

// Test data generators
export const testData = {
  /**
   * Generate test messages
   */
  generateMessages(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${i + 1}`,
      timestamp: new Date(Date.now() - (count - i) * 1000)
    }))
  },

  /**
   * Generate test prompts
   */
  generatePrompts() {
    return [
      'Hello, how are you?',
      'What is the weather like today?',
      'Can you help me with a coding problem?',
      'Tell me a joke',
      'Explain quantum computing in simple terms',
      'What are the benefits of renewable energy?',
      'How do I make a good cup of coffee?',
      'What is the meaning of life?'
    ]
  },

  /**
   * Generate test documents for RAG
   */
  generateDocuments(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `doc-${i}`,
      content: `This is test document ${i + 1}. It contains information about topic ${i + 1}.`,
      metadata: {
        title: `Document ${i + 1}`,
        category: `Category ${(i % 3) + 1}`,
        timestamp: new Date(Date.now() - i * 86400000) // Days ago
      }
    }))
  }
}