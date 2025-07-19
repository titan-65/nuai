/**
 * End-to-end tests for AI workflows
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

describe('AI Workflows E2E Tests', () => {
  let context: E2ETestContext
  let page: Page

  beforeEach(async () => {
    context = await setupTestPage()
    page = context.page
  })

  afterEach(async () => {
    await cleanupTestPage(context)
  })

  describe('Basic Chat Functionality', () => {
    it('should load chat interface successfully', async () => {
      await page.goto('/chat')
      
      // Check if chat interface elements are present
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible()
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
    })

    it('should send and receive chat messages', async () => {
      await page.goto('/chat')
      
      // Mock AI responses
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Hello! How can I help you today?'
      })
      
      // Send a message
      await testUtils.sendChatMessage(page, 'Hello, AI!')
      
      // Wait for AI response
      await testUtils.waitForAIResponse(page)
      
      // Check messages
      const messages = await testUtils.getChatMessages(page)
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello, AI!')
      expect(messages[1].role).toBe('assistant')
      expect(messages[1].content).toContain('Hello! How can I help you today?')
    })

    it('should handle multiple consecutive messages', async () => {
      await page.goto('/chat')
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'I understand your question.'
      })
      
      const testPrompts = testData.generatePrompts().slice(0, 3)
      
      for (const prompt of testPrompts) {
        await testUtils.sendChatMessage(page, prompt)
        await testUtils.waitForAIResponse(page)
        await page.waitForTimeout(500) // Brief pause between messages
      }
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages).toHaveLength(6) // 3 user + 3 assistant messages
    })

    it('should display loading states correctly', async () => {
      await page.goto('/chat')
      
      // Delay the mock response to test loading state
      await page.route('**/api/ai/chat', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Delayed response',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
        })
      })
      
      // Send message and check loading state
      await testUtils.sendChatMessage(page, 'Test loading')
      
      // Should show loading indicator
      await expect(page.locator('[data-testid="loading"]')).toBeVisible()
      
      // Wait for response and check loading is gone
      await testUtils.waitForLoadingComplete(page)
      await expect(page.locator('[data-testid="loading"]')).not.toBeVisible()
    })
  })

  describe('Streaming Functionality', () => {
    it('should handle streaming responses', async () => {
      await page.goto('/chat?streaming=true')
      
      // Mock streaming response
      await page.route('**/api/ai/stream', async (route) => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              const chunks = ['Hello', ' there', '! How', ' can I', ' help?']
              let i = 0
              
              const sendChunk = () => {
                if (i < chunks.length) {
                  controller.enqueue(new TextEncoder().encode(
                    `data: ${JSON.stringify({ content: chunks[i] })}\n\n`
                  ))
                  i++
                  setTimeout(sendChunk, 100)
                } else {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                  controller.close()
                }
              }
              
              sendChunk()
            }
          }),
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache'
            }
          }
        )
        
        await route.fulfill({ response })
      })
      
      await testUtils.sendChatMessage(page, 'Test streaming')
      
      // Should show streaming indicator
      await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible()
      
      // Wait for streaming to complete
      await testUtils.waitForStreamingComplete(page)
      
      // Check final message
      const messages = await testUtils.getChatMessages(page)
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.content).toBe('Hello there! How can I help?')
    })

    it('should handle streaming errors gracefully', async () => {
      await page.goto('/chat?streaming=true')
      
      // Mock streaming error
      await page.route('**/api/ai/stream', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Streaming failed' })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Test streaming error')
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      const errorText = await page.locator('[data-testid="error-message"]').textContent()
      expect(errorText).toContain('error')
    })
  })

  describe('Provider Switching', () => {
    it('should switch between AI providers', async () => {
      await page.goto('/chat')
      
      // Mock responses for different providers
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'OpenAI response'
      })
      
      await page.route('**/api/ai/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}')
        const provider = body.provider || 'openai'
        
        const responses = {
          openai: 'Response from OpenAI',
          anthropic: 'Response from Anthropic',
          ollama: 'Response from Ollama'
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: responses[provider as keyof typeof responses],
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            model: `${provider}-model`
          })
        })
      })
      
      // Test OpenAI
      await testUtils.selectProvider(page, 'openai')
      await testUtils.sendChatMessage(page, 'Test OpenAI')
      await testUtils.waitForAIResponse(page)
      
      let messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('OpenAI')
      
      // Test Anthropic
      await testUtils.selectProvider(page, 'anthropic')
      await testUtils.sendChatMessage(page, 'Test Anthropic')
      await testUtils.waitForAIResponse(page)
      
      messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Anthropic')
      
      // Test Ollama
      await testUtils.selectProvider(page, 'ollama')
      await testUtils.sendChatMessage(page, 'Test Ollama')
      await testUtils.waitForAIResponse(page)
      
      messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Ollama')
    })

    it('should handle provider configuration changes', async () => {
      await page.goto('/settings/providers')
      
      // Update OpenAI configuration
      await page.fill('[data-testid="openai-api-key"]', 'new-test-key')
      await page.fill('[data-testid="openai-base-url"]', 'https://custom-api.openai.com')
      await page.selectOption('[data-testid="openai-model"]', 'gpt-4')
      
      await page.click('[data-testid="save-provider-config"]')
      
      // Should show success message
      await expect(page.locator('[data-testid="config-saved"]')).toBeVisible()
      
      // Test the updated configuration
      await page.goto('/chat')
      await testUtils.selectProvider(page, 'openai')
      
      // Mock request to verify configuration is used
      let configUsed = false
      await page.route('**/api/ai/chat', async (route) => {
        const headers = route.request().headers()
        if (headers.authorization?.includes('new-test-key')) {
          configUsed = true
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: 'Response with new config',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Test new config')
      await testUtils.waitForAIResponse(page)
      
      expect(configUsed).toBe(true)
    })

    it('should handle provider fallback on failure', async () => {
      await page.goto('/chat')
      
      let requestCount = 0
      await page.route('**/api/ai/chat', async (route) => {
        requestCount++
        const body = JSON.parse(route.request().postData() || '{}')
        const provider = body.provider || 'openai'
        
        if (provider === 'openai' && requestCount === 1) {
          // First provider fails
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Service unavailable' })
          })
        } else {
          // Fallback provider succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: `Fallback response from ${provider}`,
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          })
        }
      })
      
      // Enable fallback in settings
      await page.goto('/settings/providers')
      await page.check('[data-testid="enable-fallback"]')
      await page.selectOption('[data-testid="fallback-provider"]', 'anthropic')
      await page.click('[data-testid="save-provider-config"]')
      
      await page.goto('/chat')
      await testUtils.sendChatMessage(page, 'Test fallback')
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Fallback response')
    })

    it('should switch between models within a provider', async () => {
      await page.goto('/chat')
      
      await page.route('**/api/ai/chat', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}')
        const model = body.model || 'default-model'
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: `Response from ${model}`,
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            model
          })
        })
      })
      
      // Test GPT-4
      await testUtils.selectModel(page, 'gpt-4')
      await testUtils.sendChatMessage(page, 'Test GPT-4')
      await testUtils.waitForAIResponse(page)
      
      let messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('gpt-4')
      
      // Test GPT-3.5
      await testUtils.selectModel(page, 'gpt-3.5-turbo')
      await testUtils.sendChatMessage(page, 'Test GPT-3.5')
      await testUtils.waitForAIResponse(page)
      
      messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('gpt-3.5-turbo')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      await page.goto('/chat')
      
      // Mock API error
      await page.route('**/api/ai/chat', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED'
          })
        })
      })
      
      await testUtils.sendChatMessage(page, 'Test error handling')
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      const errorText = await page.locator('[data-testid="error-message"]').textContent()
      expect(errorText).toContain('Rate limit')
    })

    it('should handle network errors', async () => {
      await page.goto('/chat')
      
      // Mock network error
      await page.route('**/api/ai/chat', async (route) => {
        await route.abort('failed')
      })
      
      await testUtils.sendChatMessage(page, 'Test network error')
      
      // Should show network error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    })

    it('should allow retry after errors', async () => {
      await page.goto('/chat')
      
      let requestCount = 0
      await page.route('**/api/ai/chat', async (route) => {
        requestCount++
        
        if (requestCount === 1) {
          // First request fails
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' })
          })
        } else {
          // Second request succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: 'Success after retry',
              usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          })
        }
      })
      
      await testUtils.sendChatMessage(page, 'Test retry')
      
      // Should show error first
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Click retry button
      await page.click('[data-testid="retry-button"]')
      
      // Should succeed on retry
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[messages.length - 1].content).toContain('Success after retry')
    })
  })

  describe('Performance Tests', () => {
    it('should load chat interface within performance budget', async () => {
      const { duration } = await benchmarkUtils.measurePerformance(async () => {
        await page.goto('/chat')
        await page.waitForSelector('[data-testid="chat-interface"]')
      }, 'chat-interface-load')
      
      // Should load within 2 seconds
      expect(duration).toBeLessThan(2000)
    })

    it('should handle rapid message sending', async () => {
      await page.goto('/chat')
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Quick response'
      })
      
      const benchmark = await benchmarkUtils.runBenchmark(page, async () => {
        await testUtils.sendChatMessage(page, 'Quick test')
        await testUtils.waitForAIResponse(page)
      }, 5)
      
      // Average response time should be reasonable
      expect(benchmark.avg).toBeLessThan(1000) // 1 second average
      expect(benchmark.max).toBeLessThan(2000) // 2 seconds max
    })

    it('should maintain performance with large conversation history', async () => {
      await page.goto('/chat')
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Response'
      })
      
      // Send 20 messages to build up history
      for (let i = 0; i < 20; i++) {
        await testUtils.sendChatMessage(page, `Message ${i + 1}`)
        await testUtils.waitForAIResponse(page)
      }
      
      // Measure performance with large history
      const { duration } = await benchmarkUtils.measurePerformance(async () => {
        await testUtils.sendChatMessage(page, 'Final message')
        await testUtils.waitForAIResponse(page)
      }, 'large-history-performance')
      
      // Should still respond quickly with large history
      expect(duration).toBeLessThan(1500)
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      await page.goto('/chat')
      
      // Tab to input field
      await page.keyboard.press('Tab')
      
      // Should focus on chat input
      const focusedElement = await page.locator(':focus')
      await expect(focusedElement).toHaveAttribute('data-testid', 'chat-input')
      
      // Type message and press Enter
      await page.keyboard.type('Test keyboard navigation')
      await page.keyboard.press('Enter')
      
      // Should send message
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages[0].content).toBe('Test keyboard navigation')
    })

    it('should have proper ARIA labels', async () => {
      await page.goto('/chat')
      
      // Check ARIA labels
      await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute('aria-label')
      await expect(page.locator('[data-testid="send-button"]')).toHaveAttribute('aria-label')
      await expect(page.locator('[data-testid="chat-interface"]')).toHaveAttribute('role')
    })

    it('should support screen readers', async () => {
      await page.goto('/chat')
      
      // Check for screen reader announcements
      const liveRegion = page.locator('[aria-live="polite"]')
      await expect(liveRegion).toBeAttached()
      
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Screen reader test response'
      })
      
      await testUtils.sendChatMessage(page, 'Test screen reader')
      await testUtils.waitForAIResponse(page)
      
      // Live region should announce new message
      const announcement = await liveRegion.textContent()
      expect(announcement).toContain('response')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/chat')
      
      // Should still show chat interface
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible()
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
      
      // Should be able to send messages
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Mobile response'
      })
      
      await testUtils.sendChatMessage(page, 'Mobile test')
      await testUtils.waitForAIResponse(page)
      
      const messages = await testUtils.getChatMessages(page)
      expect(messages).toHaveLength(2)
    })

    it('should handle touch interactions', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/chat')
      
      // Tap on input field
      await page.tap('[data-testid="chat-input"]')
      
      // Should focus input
      const focusedElement = await page.locator(':focus')
      await expect(focusedElement).toHaveAttribute('data-testid', 'chat-input')
      
      // Type and tap send button
      await page.fill('[data-testid="chat-input"]', 'Touch test')
      await page.tap('[data-testid="send-button"]')
      
      // Should send message
      await testUtils.waitForAIResponse(page)
    })
  })
})