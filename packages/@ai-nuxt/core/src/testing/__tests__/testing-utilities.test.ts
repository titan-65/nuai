import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  createTestProvider, 
  createTestAgent, 
  createTestTool,
  mockUseAI,
  mockUseAIChat,
  createComponentTestHelper,
  waitFor,
  setupTestEnvironment
} from '../test-utilities'
import { MockProviderFactory } from '../mock-providers'
import { sampleMessages, samplePrompts, testDataHelpers } from '../fixtures'

describe('Testing Utilities', () => {
  describe('Mock Providers', () => {
    it('should create a test provider with default responses', async () => {
      const provider = createTestProvider()
      
      expect(provider.name).toBe('test-provider')
      
      const chatResponse = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }]
      })
      
      expect(chatResponse.text).toBe('Test response')
      expect(chatResponse.finishReason).toBe('stop')
    })

    it('should create provider with custom responses', async () => {
      const provider = createTestProvider({
        responses: {
          chat: { text: 'Custom response', model: 'custom-model' }
        }
      })
      
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })
      
      expect(response.text).toBe('Custom response')
      expect(response.model).toBe('custom-model')
    })

    it('should simulate delays', async () => {
      const provider = createTestProvider({
        delays: { chat: 100 }
      })
      
      const start = Date.now()
      await provider.chat({ messages: [{ role: 'user', content: 'Test' }] })
      const duration = Date.now() - start
      
      expect(duration).toBeGreaterThanOrEqual(90) // Allow some variance
    })

    it('should simulate errors', async () => {
      const provider = createTestProvider({
        errors: { chat: 'Test error' }
      })
      
      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Test error')
    })

    it('should track usage statistics', async () => {
      const provider = createTestProvider()
      
      expect(provider.getUsage().chatCalls).toBe(0)
      
      await provider.chat({ messages: [{ role: 'user', content: 'Test' }] })
      await provider.completion({ prompt: 'Test prompt' })
      
      const usage = provider.getUsage()
      expect(usage.chatCalls).toBe(1)
      expect(usage.completionCalls).toBe(1)
      expect(usage.totalTokens).toBeGreaterThan(0)
    })
  })

  describe('Mock Provider Factory', () => {
    it('should create success provider', async () => {
      const provider = MockProviderFactory.createSuccessProvider()
      
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })
      
      expect(response.text).toBe('Success response')
      expect(response.finishReason).toBe('stop')
    })

    it('should create error provider', async () => {
      const provider = MockProviderFactory.createErrorProvider()
      
      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Mock chat error')
    })

    it('should create realistic provider with delays', async () => {
      const provider = MockProviderFactory.createRealisticProvider()
      
      const start = Date.now()
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }]
      })
      const duration = Date.now() - start
      
      expect(duration).toBeGreaterThan(500) // Should have realistic delay
      expect(response.text).toContain('Realistic response')
    })

    it('should create pattern provider with intelligent responses', async () => {
      const provider = MockProviderFactory.createPatternProvider('smart', {
        chat: (messages) => {
          const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || ''
          if (lastMessage.includes('weather')) {
            return { text: 'It\'s sunny today!' }
          }
          return { text: 'I don\'t understand that topic.' }
        }
      })
      
      const weatherResponse = await provider.chat({
        messages: [{ role: 'user', content: 'What\'s the weather like?' }]
      })
      expect(weatherResponse.text).toBe('It\'s sunny today!')
      
      const otherResponse = await provider.chat({
        messages: [{ role: 'user', content: 'Tell me about cats' }]
      })
      expect(otherResponse.text).toBe('I don\'t understand that topic.')
    })
  })

  describe('Test Agent Creation', () => {
    it('should create a test agent with default configuration', () => {
      const agent = createTestAgent()
      
      expect(agent.config.id).toBe('test-agent')
      expect(agent.config.name).toBe('Test Agent')
      expect(agent.config.capabilities.canUseTool).toBe(true)
    })

    it('should create agent with custom configuration', () => {
      const agent = createTestAgent({
        name: 'Custom Agent',
        role: 'specialist'
      })
      
      expect(agent.config.name).toBe('Custom Agent')
      expect(agent.config.role).toBe('specialist')
    })

    it('should execute agent with mock provider', async () => {
      const agent = createTestAgent()
      
      const result = await agent.execute('Test input')
      
      expect(result.success).toBe(true)
      expect(result.output).toBe('Test response')
    })
  })

  describe('Test Tool Creation', () => {
    it('should create a test tool with default configuration', () => {
      const tool = createTestTool()
      
      expect(tool.id).toBe('test-tool')
      expect(tool.name).toBe('Test Tool')
      expect(vi.isMockFunction(tool.execute)).toBe(true)
    })

    it('should create tool with custom configuration', () => {
      const customExecute = vi.fn().mockResolvedValue('Custom result')
      const tool = createTestTool({
        id: 'custom-tool',
        name: 'Custom Tool',
        execute: customExecute
      })
      
      expect(tool.id).toBe('custom-tool')
      expect(tool.name).toBe('Custom Tool')
      expect(tool.execute).toBe(customExecute)
    })
  })

  describe('Composable Mocking', () => {
    it('should mock useAI composable', () => {
      const mockAI = mockUseAI({
        data: { text: 'Mock AI response' }
      })
      
      expect(vi.isMockFunction(mockAI.ai.chat)).toBe(true)
      expect(vi.isMockFunction(mockAI.ai.completion)).toBe(true)
      expect(vi.isMockFunction(mockAI.ai.embedding)).toBe(true)
    })

    it('should mock useAIChat composable', () => {
      const mockChat = mockUseAIChat({
        data: { messages: [] }
      })
      
      expect(Array.isArray(mockChat.messages.value)).toBe(true)
      expect(vi.isMockFunction(mockChat.sendMessage)).toBe(true)
      expect(vi.isMockFunction(mockChat.clearMessages)).toBe(true)
    })

    it('should simulate chat conversation', async () => {
      const messages: any[] = []
      const mockChat = mockUseAIChat({
        data: { messages }
      })
      
      await mockChat.sendMessage('Hello')
      
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
      expect(messages[1].role).toBe('assistant')
    })
  })

  describe('Component Test Helper', () => {
    let helper: ReturnType<typeof createComponentTestHelper>

    beforeEach(() => {
      helper = createComponentTestHelper()
    })

    afterEach(() => {
      helper.clearMocks()
    })

    it('should mock individual composables', () => {
      helper.mockUseAI({ data: { text: 'Test response' } })
      
      const mock = helper.getMock('useAI')
      expect(mock).toBeDefined()
    })

    it('should mock multiple composables at once', () => {
      helper.mockAll({
        useAI: { data: { text: 'AI response' } },
        useAIChat: { data: { messages: [] } }
      })
      
      expect(helper.getMock('useAI')).toBeDefined()
      expect(helper.getMock('useAIChat')).toBeDefined()
    })

    it('should clear all mocks', () => {
      helper.mockUseAI()
      helper.mockUseAIChat()
      
      helper.clearMocks()
      
      expect(helper.getMock('useAI')).toBeUndefined()
      expect(helper.getMock('useAIChat')).toBeUndefined()
    })
  })

  describe('Utility Functions', () => {
    it('should wait for condition to be true', async () => {
      let condition = false
      setTimeout(() => { condition = true }, 100)
      
      await waitFor(() => condition, 1000)
      
      expect(condition).toBe(true)
    })

    it('should timeout if condition is never met', async () => {
      await expect(waitFor(() => false, 100))
        .rejects.toThrow('Condition not met within 100ms')
    })

    it('should setup test environment', () => {
      const { helper, cleanup } = setupTestEnvironment()
      
      expect(helper).toBeDefined()
      expect(typeof cleanup).toBe('function')
      
      // Test that localStorage is mocked
      expect(global.localStorage).toBeDefined()
      expect(vi.isMockFunction(global.localStorage.getItem)).toBe(true)
      
      // Test that fetch is mocked
      expect(global.fetch).toBeDefined()
      expect(vi.isMockFunction(global.fetch)).toBe(true)
      
      cleanup()
    })
  })

  describe('Integration with Sample Data', () => {
    it('should work with sample messages', async () => {
      const provider = createTestProvider()
      
      const response = await provider.chat({
        messages: sampleMessages
      })
      
      expect(response.text).toBeDefined()
      expect(response.usage?.totalTokens).toBeGreaterThan(0)
    })

    it('should work with sample prompts', async () => {
      const provider = createTestProvider()
      
      const response = await provider.completion({
        prompt: samplePrompts.completion.simple
      })
      
      expect(response.text).toBeDefined()
      expect(response.text).toContain('Complete this sentence')
    })

    it('should create test data using helpers', () => {
      const message = testDataHelpers.createRandomMessage('user')
      expect(message.role).toBe('user')
      expect(message.content).toMatch(/^Random message/)
      
      const conversation = testDataHelpers.createConversation(4)
      expect(conversation).toHaveLength(4)
      expect(conversation[0].role).toBe('user')
      expect(conversation[1].role).toBe('assistant')
      
      const embedding = testDataHelpers.createRandomEmbedding(512)
      expect(embedding).toHaveLength(512)
      expect(embedding.every(n => n >= -1 && n <= 1)).toBe(true)
      
      const document = testDataHelpers.createTestDocument()
      expect(document.id).toMatch(/^test-doc-/)
      expect(document.content).toMatch(/^Test document content/)
      expect(document.embedding).toHaveLength(1536)
    })
  })

  describe('Error Simulation', () => {
    it('should simulate network errors', async () => {
      const provider = createTestProvider({
        errors: { chat: new Error('Network error') }
      })
      
      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Network error')
      
      const usage = provider.getUsage()
      expect(usage.errors).toBe(1)
    })

    it('should simulate timeout errors', async () => {
      const provider = createTestProvider({
        delays: { chat: 1000 },
        errors: { chat: new Error('Timeout') }
      })
      
      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Timeout')
    })

    it('should simulate rate limit errors', async () => {
      const provider = createTestProvider()
      
      // Simulate rate limiting after 3 calls
      let callCount = 0
      provider.updateConfig({
        patterns: {
          chat: () => {
            callCount++
            if (callCount > 3) {
              throw new Error('Rate limit exceeded')
            }
            return { text: 'Success' }
          }
        }
      })
      
      // First 3 calls should succeed
      for (let i = 0; i < 3; i++) {
        const response = await provider.chat({
          messages: [{ role: 'user', content: `Test ${i}` }]
        })
        expect(response.text).toBe('Success')
      }
      
      // 4th call should fail
      await expect(provider.chat({
        messages: [{ role: 'user', content: 'Test 4' }]
      })).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Performance Testing', () => {
    it('should measure response times', async () => {
      const provider = createTestProvider({
        delays: { chat: 200 }
      })
      
      const start = Date.now()
      await provider.chat({
        messages: [{ role: 'user', content: 'Performance test' }]
      })
      const duration = Date.now() - start
      
      expect(duration).toBeGreaterThanOrEqual(180) // Allow some variance
      expect(duration).toBeLessThan(300)
    })

    it('should handle concurrent requests', async () => {
      const provider = createTestProvider({
        delays: { chat: 100 }
      })
      
      const promises = Array.from({ length: 5 }, (_, i) =>
        provider.chat({
          messages: [{ role: 'user', content: `Concurrent test ${i}` }]
        })
      )
      
      const start = Date.now()
      const responses = await Promise.all(promises)
      const duration = Date.now() - start
      
      expect(responses).toHaveLength(5)
      expect(duration).toBeLessThan(200) // Should be concurrent, not sequential
      
      const usage = provider.getUsage()
      expect(usage.chatCalls).toBe(5)
    })

    it('should track token usage accurately', async () => {
      const provider = createTestProvider({
        responses: {
          chat: {
            text: 'Response',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
          }
        }
      })
      
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }]
      })
      
      const usage = provider.getUsage()
      expect(usage.totalTokens).toBe(15)
    })
  })
})