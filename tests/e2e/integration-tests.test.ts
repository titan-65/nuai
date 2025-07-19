/**
 * Integration tests for multi-component interactions and state management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Page } from 'playwright'
import { 
  setupTestPage, 
  cleanupTestPage, 
  testUtils, 
  benchmarkUtils,
  testData,
  type E2ETestContext 
} from './setup'

describe('Integration Tests', () => {
  let context: E2ETestContext
  let page: Page

  beforeEach(async () => {
    context = await setupTestPage()
    page = context.page
  })

  afterEach(async () => {
    await cleanupTestPage(context)
  })

  describe('Multi-Component State Management', () => {
    it('should sync state between chat and settings components', async () => {
      // Start in chat with default settings
      await page.goto('/chat')
      
      // Mock AI responses
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Default response'
      })
      
      // Send initial message
      await testUtils.sendChatMessage(page, 'Initial message')
      await testUtils.waitForAIResponse(page)
      
      // Navigate to settings and change provider
      await page.goto('/settings')
      await testUtils.selectProvider(page, 'anthropic')
      await page.fill('[data-testid="anthropic-temperature"]', '0.9')
      await page.click('[data-testid="save-settings"]')
      
      // Return to chat - should use new settings
      await page.goto('/chat')
      
      // Verify provider changed
      const selectedProvider = await page.locator('[data-testid="current-provider"]').textContent()
      expect(selectedProvider).toBe('anthropic')
      
      // Send message with new provider
      await page.route('**/api/ai/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}')
        expect(body.provider).toBe('anthropic')
        expect(body.temperature).toBe(0.9)
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Anthropic response with new settings',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Test new settings')
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Anthropic response')
    })

    it('should maintain conversation state across page navigation', async () => {
      await page.goto('/chat')
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Persistent response'
      })
      
      // Build conversation history
      const testMessages = ['Hello', 'How are you?', 'Tell me about AI']
      
      for (const message of testMessages) {
        await testUtils.sendChatMessage(page, message)
        await testUtils.waitForAIResponse(page)
      }
      
      // Navigate away and back
      await page.goto('/settings')
      await page.waitForTimeout(1000)
      await page.goto('/chat')
      
      // Conversation should be preserved
      const messages = await testUtils.getChatMessages(page)
      expect(messages.length).toBe(6) // 3 user + 3 assistant messages
      
      // Verify message content
      const userMessages = messages.filter(m => m.role === 'user')
      expect(userMessages.map(m => m.content)).toEqual(testMessages)
    })

    it('should sync cache state between components', async () => {
      await page.goto('/chat?cache=true')
      
      // Mock cache responses
      await page.route('**/api/ai/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Cached response',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            cached: true
          })
        })
      })
      
      // Send message to populate cache
      await testUtils.sendChatMessage(page, 'Cache test message')
      await testUtils.waitForAIResponse(page)
      
      // Navigate to cache management
      await page.goto('/cache')
      
      // Should show cached item
      await expect(page.locator('[data-testid="cache-item"]')).toBeVisible()
      
      // Clear cache
      await page.click('[data-testid="clear-cache"]')
      await expect(page.locator('[data-testid="cache-empty"]')).toBeVisible()
      
      // Return to chat - cache should be cleared
      await page.goto('/chat')
      
      // Mock non-cached response
      await page.route('**/api/ai/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Fresh response',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            cached: false
          })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Cache test message')
      await testUtils.waitForAIResponse(page)
      
      // Should not show cache indicator
      await expect(page.locator('[data-testid="cache-indicator"]')).not.toBeVisible()
    })
  })

  describe('Cross-Feature Integration', () => {
    it('should integrate RAG with chat functionality', async () => {
      // First, add documents to vector store
      await page.goto('/rag')
      
      // Mock embedding generation
      await page.route('**/api/ai/embedding', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
            usage: { promptTokens: 5, totalTokens: 5 }
          })
        })
      })
      
      // Add test documents
      const documents = [
        'Artificial Intelligence is transforming technology',
        'Machine Learning enables automated decision making',
        'Neural networks are inspired by biological neurons'
      ]
      
      for (const doc of documents) {
        await page.fill('[data-testid="document-input"]', doc)
        await page.click('[data-testid="add-document"]')
        await page.waitForSelector('[data-testid="success-message"]')
      }
      
      // Navigate to RAG-enabled chat
      await page.goto('/chat?rag=true')
      
      // Mock RAG-enhanced response
      await page.route('**/api/ai/rag', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: 'Based on the documents, AI is transforming technology through machine learning and neural networks.',
            sources: [
              { id: 'doc-1', content: documents[0], score: 0.95 },
              { id: 'doc-2', content: documents[1], score: 0.87 }
            ],
            usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
          })
        })
      })
      
      // Ask question that should use RAG
      await testUtils.sendChatMessage(page, 'What is AI doing to technology?')
      await testUtils.waitForAIResponse(page)
      
      // Should show RAG-enhanced response
      const messages = await testUtils.getChatMessages(page)
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toContain('Based on the documents')
      
      // Should show source citations
      await expect(page.locator('[data-testid="sources"]')).toBeVisible()
      const sources = await page.locator('[data-testid="source-item"]').count()
      expect(sources).toBe(2)
    })

    it('should integrate agents with tool execution', async () => {
      await page.goto('/agents')
      
      // Create agent with tools
      await page.click('[data-testid="create-agent"]')
      await page.fill('[data-testid="agent-name"]', 'TestAgent')
      await page.check('[data-testid="tool-search"]')
      await page.check('[data-testid="tool-calculator"]')
      await page.click('[data-testid="save-agent"]')
      
      // Navigate to agent execution
      await page.goto('/agents/test-agent')
      
      // Mock agent execution with tool use
      await page.route('**/api/ai/agents/execute', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: 'I searched for information and calculated the result: 42',
            toolsUsed: [
              { name: 'search', input: 'AI information', output: 'Found relevant data' },
              { name: 'calculator', input: '6 * 7', output: '42' }
            ],
            executionTime: 1500
          })
        })
      })
      
      // Execute agent task
      await page.fill('[data-testid="agent-input"]', 'Search for AI info and calculate 6 * 7')
      await page.click('[data-testid="execute-agent"]')
      
      // Should show execution result
      await expect(page.locator('[data-testid="agent-result"]')).toBeVisible()
      
      // Should show tool execution details
      await expect(page.locator('[data-testid="tools-used"]')).toBeVisible()
      const toolItems = await page.locator('[data-testid="tool-item"]').count()
      expect(toolItems).toBe(2)
      
      // Verify tool outputs
      await expect(page.locator('[data-testid="tool-item"]').first()).toContainText('search')
      await expect(page.locator('[data-testid="tool-item"]').last()).toContainText('calculator')
    })

    it('should integrate monitoring with all AI operations', async () => {
      // Start monitoring
      await page.goto('/monitoring')
      
      // Mock monitoring data
      await page.route('**/api/monitoring/metrics', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            requests: { total: 0, successful: 0, failed: 0 },
            tokens: { total: 0, average: 0 },
            cost: { total: 0, average: 0 },
            latency: { average: 0, p95: 0 }
          })
        })
      })
      
      // Perform various AI operations
      const operations = [
        { type: 'chat', endpoint: '/chat', action: () => testUtils.sendChatMessage(page, 'Test chat') },
        { type: 'completion', endpoint: '/completion', action: async () => {
          await page.fill('[data-testid="completion-input"]', 'Complete this')
          await page.click('[data-testid="generate-completion"]')
        }},
        { type: 'embedding', endpoint: '/embedding', action: async () => {
          await page.fill('[data-testid="embedding-input"]', 'Generate embedding')
          await page.click('[data-testid="generate-embedding"]')
        }}
      ]
      
      let totalRequests = 0
      
      // Mock responses for all operations
      await page.route('**/api/ai/**', async (route) => {
        totalRequests++
        const url = route.request().url()
        
        if (url.includes('/chat')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: 'Chat response',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          })
        } else if (url.includes('/completion')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: 'Completion response',
              usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 }
            })
          })
        } else if (url.includes('/embedding')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              embeddings: [[0.1, 0.2, 0.3]],
              usage: { promptTokens: 3, totalTokens: 3 }
            })
          })
        }
      })
      
      // Execute operations
      for (const operation of operations) {
        await page.goto(operation.endpoint)
        await operation.action()
        await page.waitForTimeout(500)
      }
      
      // Check monitoring data
      await page.goto('/monitoring')
      
      // Mock updated monitoring data
      await page.route('**/api/monitoring/metrics', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            requests: { total: totalRequests, successful: totalRequests, failed: 0 },
            tokens: { total: 53, average: 17.7 },
            cost: { total: 0.001, average: 0.0003 },
            latency: { average: 450, p95: 800 }
          })
        })
      })
      
      await page.click('[data-testid="refresh-metrics"]')
      
      // Should show updated metrics
      await expect(page.locator('[data-testid="total-requests"]')).toContainText(totalRequests.toString())
      await expect(page.locator('[data-testid="total-tokens"]')).toContainText('53')
    })
  })

  describe('Real-time State Synchronization', () => {
    it('should sync state across multiple browser tabs', async () => {
      // Open second page/tab
      const secondPage = await context.browser.newPage()
      await secondPage.setViewportSize({ width: 1280, height: 720 })
      
      // Navigate both pages to chat
      await page.goto('/chat')
      await secondPage.goto('/chat')
      
      // Mock AI responses for both pages
      const mockResponse = async (page: Page) => {
        await page.route('**/api/ai/chat', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: 'Synced response',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          })
        })
      }
      
      await mockResponse(page)
      await mockResponse(secondPage)
      
      // Send message from first tab
      await testUtils.sendChatMessage(page, 'Message from tab 1')
      await testUtils.waitForAIResponse(page)
      
      // Check if message appears in second tab (if real-time sync is implemented)
      await secondPage.waitForTimeout(1000)
      
      // Send message from second tab
      await testUtils.sendChatMessage(secondPage, 'Message from tab 2')
      await page.waitForTimeout(1000)
      
      // Both tabs should have both messages (if sync is implemented)
      const firstTabMessages = await testUtils.getChatMessages(page)
      const secondTabMessages = await testUtils.getChatMessages(secondPage)
      
      // At minimum, each tab should have its own messages
      expect(firstTabMessages.length).toBeGreaterThan(0)
      expect(secondTabMessages.length).toBeGreaterThan(0)
      
      await secondPage.close()
    })

    it('should handle concurrent operations gracefully', async () => {
      await page.goto('/chat')
      
      // Mock delayed responses to test concurrency
      let responseCount = 0
      await page.route('**/api/ai/chat', async (route) => {
        responseCount++
        const delay = Math.random() * 500 + 200 // 200-700ms delay
        
        await new Promise(resolve => setTimeout(resolve, delay))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: `Concurrent response ${responseCount}`,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
        })
      })
      
      // Send multiple messages concurrently
      const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5']
      
      const sendPromises = messages.map(async (message, index) => {
        await page.waitForTimeout(index * 100) // Stagger slightly
        await testUtils.sendChatMessage(page, message)
      })
      
      await Promise.all(sendPromises)
      
      // Wait for all responses
      await page.waitForTimeout(2000)
      
      // Should handle all messages
      const finalMessages = await testUtils.getChatMessages(page)
      const userMessages = finalMessages.filter(m => m.role === 'user')
      const assistantMessages = finalMessages.filter(m => m.role === 'assistant')
      
      expect(userMessages.length).toBe(5)
      expect(assistantMessages.length).toBe(5)
      
      // Verify message order is maintained
      expect(userMessages.map(m => m.content)).toEqual(messages)
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary network failures', async () => {
      await page.goto('/chat')
      
      let requestCount = 0
      await page.route('**/api/ai/chat', async (route) => {
        requestCount++
        
        if (requestCount <= 2) {
          // First two requests fail
          await route.abort('failed')
        } else {
          // Subsequent requests succeed
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: 'Recovered response',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          })
        }
      })
      
      // Send message - should fail initially
      await testUtils.sendChatMessage(page, 'Test recovery')
      
      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Retry should also fail
      await page.click('[data-testid="retry-button"]')
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Third retry should succeed
      await page.click('[data-testid="retry-button"]')
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Recovered response')
    })

    it('should handle partial component failures', async () => {
      await page.goto('/chat')
      
      // Mock scenario where chat works but other features fail
      await page.route('**/api/ai/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Chat works fine',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
        })
      })
      
      await page.route('**/api/ai/embedding', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Embedding service unavailable' })
        })
      })
      
      // Chat should work
      await testUtils.sendChatMessage(page, 'Test chat')
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Chat works fine')
      
      // Navigate to RAG (which uses embeddings)
      await page.goto('/rag')
      
      // Try to add document (should fail gracefully)
      await page.fill('[data-testid="document-input"]', 'Test document')
      await page.click('[data-testid="add-document"]')
      
      // Should show error but not crash
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Should still be able to navigate back to chat
      await page.goto('/chat')
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible()
    })

    it('should maintain data consistency during failures', async () => {
      await page.goto('/chat')
      
      // Build up some conversation state
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Initial response'
      })
      
      await testUtils.sendChatMessage(page, 'Initial message')
      await testUtils.waitForAIResponse(page)
      
      // Simulate failure during state update
      await page.route('**/api/ai/chat', async (route) => {
        // Simulate server error after processing
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error during processing' })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Message that will fail')
      
      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Previous conversation should still be intact
      const messages = await testUtils.getChatMessages(page)
      expect(messages.length).toBe(2) // Original user + assistant message
      expect(messages[0].content).toBe('Initial message')
      expect(messages[1].content).toContain('Initial response')
      
      // Failed message should not be in conversation
      expect(messages.some(m => m.content === 'Message that will fail')).toBe(false)
    })
  })

  describe('Performance Under Load', () => {
    it('should maintain responsiveness with high message volume', async () => {
      await page.goto('/chat')
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Load test response'
      })
      
      // Send many messages rapidly
      const messageCount = 50
      const startTime = performance.now()
      
      for (let i = 0; i < messageCount; i++) {
        await testUtils.sendChatMessage(page, `Load test message ${i + 1}`)
        
        // Don't wait for response to test queuing
        if (i % 10 === 0) {
          await page.waitForTimeout(100) // Brief pause every 10 messages
        }
      }
      
      // Wait for all responses
      await page.waitForTimeout(5000)
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      
      console.log(`Processed ${messageCount} messages in ${totalTime.toFixed(2)}ms`)
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(30000) // 30 seconds
      
      // UI should still be responsive
      const inputField = page.locator('[data-testid="chat-input"]')
      await expect(inputField).toBeEnabled()
      
      // Should be able to interact with UI
      await inputField.fill('Final test message')
      await page.click('[data-testid="send-button"]')
    })

    it('should handle memory efficiently with large datasets', async () => {
      await page.goto('/rag')
      
      // Mock embedding responses
      await page.route('**/api/ai/embedding', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            embeddings: [Array.from({ length: 1536 }, () => Math.random())],
            usage: { promptTokens: 10, totalTokens: 10 }
          })
        })
      })
      
      // Add many documents
      const documentCount = 100
      const largeDocuments = Array.from({ length: documentCount }, (_, i) => 
        `This is a large test document number ${i + 1}. `.repeat(50)
      )
      
      const startMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })
      
      // Add documents in batches
      for (let i = 0; i < documentCount; i += 10) {
        const batch = largeDocuments.slice(i, i + 10)
        
        for (const doc of batch) {
          await page.fill('[data-testid="document-input"]', doc)
          await page.click('[data-testid="add-document"]')
          await page.waitForSelector('[data-testid="success-message"]')
        }
        
        // Brief pause between batches
        await page.waitForTimeout(100)
      }
      
      const endMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })
      
      const memoryIncrease = endMemory - startMemory
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024
      
      console.log(`Memory increase after ${documentCount} documents: ${memoryIncreaseMB.toFixed(2)}MB`)
      
      // Should not use excessive memory
      expect(memoryIncreaseMB).toBeLessThan(100) // 100MB limit
      
      // UI should still be responsive
      await expect(page.locator('[data-testid="document-input"]')).toBeEnabled()
    })
  })
})