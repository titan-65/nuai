import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAIStore } from '../useAIStore'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('useAIStore Composable', () => {
  let aiStore: ReturnType<typeof useAIStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    aiStore = useAIStore()
    vi.clearAllMocks()
  })

  describe('Reactive State', () => {
    it('should provide reactive access to store state', () => {
      expect(aiStore.conversations.value).toEqual([])
      expect(aiStore.activeConversationId.value).toBeNull()
      expect(aiStore.isLoading.value).toBe(false)
      expect(aiStore.error.value).toBeNull()
    })

    it('should update reactive state when store changes', () => {
      const conversation = aiStore.createConversation()

      expect(aiStore.conversations.value).toHaveLength(1)
      expect(aiStore.activeConversationId.value).toBe(conversation.id)
      expect(aiStore.activeConversation.value).toBe(conversation)
    })
  })

  describe('Conversation Management', () => {
    it('should create conversation with default settings', () => {
      const conversation = aiStore.createConversation()

      expect(conversation.id).toBeDefined()
      expect(conversation.settings.provider).toBe('openai')
      expect(conversation.settings.model).toBe('gpt-4')
      expect(aiStore.conversations.value).toContain(conversation)
    })

    it('should create conversation with custom settings', () => {
      const customSettings = {
        provider: 'anthropic' as const,
        model: 'claude-3-sonnet',
        temperature: 0.5
      }

      const conversation = aiStore.createConversation(customSettings)

      expect(conversation.settings.provider).toBe('anthropic')
      expect(conversation.settings.model).toBe('claude-3-sonnet')
      expect(conversation.settings.temperature).toBe(0.5)
    })

    it('should delete conversation', () => {
      const conversation = aiStore.createConversation()
      const conversationId = conversation.id

      expect(aiStore.conversations.value).toHaveLength(1)

      aiStore.deleteConversation(conversationId)

      expect(aiStore.conversations.value).toHaveLength(0)
    })

    it('should set active conversation', () => {
      const conv1 = aiStore.createConversation()
      const conv2 = aiStore.createConversation()

      aiStore.setActiveConversation(conv1.id)

      expect(aiStore.activeConversationId.value).toBe(conv1.id)
      expect(aiStore.activeConversation.value).toBe(conv1)
    })

    it('should update conversation', () => {
      const conversation = aiStore.createConversation()
      const newTitle = 'Updated Title'

      aiStore.updateConversation(conversation.id, { title: newTitle })

      expect(aiStore.conversations.value[0].title).toBe(newTitle)
    })

    it('should clear conversation', () => {
      const conversation = aiStore.createConversation()
      
      aiStore.addMessage(conversation.id, {
        role: 'user',
        content: 'Test message'
      })

      expect(aiStore.conversations.value[0].messages).toHaveLength(1)

      aiStore.clearConversation(conversation.id)

      expect(aiStore.conversations.value[0].messages).toHaveLength(0)
    })
  })

  describe('Message Management', () => {
    let conversationId: string

    beforeEach(() => {
      const conversation = aiStore.createConversation()
      conversationId = conversation.id
    })

    it('should add message', () => {
      const message = aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'Hello world'
      })

      expect(message.id).toBeDefined()
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello world')
      expect(message.timestamp).toBeInstanceOf(Date)
    })

    it('should update message', () => {
      const message = aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'Original content'
      })

      aiStore.updateMessage(conversationId, message.id, {
        content: 'Updated content'
      })

      const updatedMessage = aiStore.getMessageById(conversationId, message.id)
      expect(updatedMessage?.content).toBe('Updated content')
    })

    it('should delete message', () => {
      const message = aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'Test message'
      })

      expect(aiStore.getConversationMessages(conversationId)).toHaveLength(1)

      aiStore.deleteMessage(conversationId, message.id)

      expect(aiStore.getConversationMessages(conversationId)).toHaveLength(0)
    })
  })

  describe('Settings Management', () => {
    it('should update conversation settings', () => {
      const conversation = aiStore.createConversation()
      const newSettings = {
        temperature: 0.9,
        maxTokens: 2000
      }

      aiStore.updateConversationSettings(conversation.id, newSettings)

      expect(aiStore.conversations.value[0].settings.temperature).toBe(0.9)
      expect(aiStore.conversations.value[0].settings.maxTokens).toBe(2000)
    })

    it('should update global settings', () => {
      const newSettings = {
        defaultProvider: 'anthropic' as const,
        debugMode: true
      }

      aiStore.updateGlobalSettings(newSettings)

      expect(aiStore.globalSettings.value.defaultProvider).toBe('anthropic')
      expect(aiStore.globalSettings.value.debugMode).toBe(true)
    })

    it('should manage API keys', () => {
      const apiKey = 'sk-test-key'

      aiStore.setApiKey('openai', apiKey)

      expect(aiStore.getApiKey('openai')).toBe(apiKey)
    })
  })

  describe('Helper Functions', () => {
    let conversationId: string

    beforeEach(() => {
      const conversation = aiStore.createConversation()
      conversationId = conversation.id
    })

    it('should get conversation by id', () => {
      const conversation = aiStore.getConversationById(conversationId)

      expect(conversation).toBeDefined()
      expect(conversation?.id).toBe(conversationId)
    })

    it('should get conversation messages', () => {
      aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'Message 1'
      })
      aiStore.addMessage(conversationId, {
        role: 'assistant',
        content: 'Message 2'
      })

      const messages = aiStore.getConversationMessages(conversationId)

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('Message 1')
      expect(messages[1].content).toBe('Message 2')
    })

    it('should get last message', () => {
      aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'First message'
      })
      const lastMessage = aiStore.addMessage(conversationId, {
        role: 'assistant',
        content: 'Last message'
      })

      const retrieved = aiStore.getLastMessage(conversationId)

      expect(retrieved).toBe(lastMessage)
    })

    it('should get messages by role', () => {
      aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'User message 1'
      })
      aiStore.addMessage(conversationId, {
        role: 'assistant',
        content: 'Assistant message'
      })
      aiStore.addMessage(conversationId, {
        role: 'user',
        content: 'User message 2'
      })

      const userMessages = aiStore.getMessagesByRole(conversationId, 'user')
      const assistantMessages = aiStore.getMessagesByRole(conversationId, 'assistant')

      expect(userMessages).toHaveLength(2)
      expect(assistantMessages).toHaveLength(1)
      expect(userMessages[0].content).toBe('User message 1')
      expect(userMessages[1].content).toBe('User message 2')
    })

    it('should search conversations', () => {
      const conv1 = aiStore.createConversation()
      const conv2 = aiStore.createConversation()

      aiStore.updateConversation(conv1.id, { title: 'Weather Discussion' })
      aiStore.updateConversation(conv2.id, { title: 'Cooking Recipes' })

      aiStore.addMessage(conv1.id, {
        role: 'user',
        content: 'What is the weather like today?'
      })
      aiStore.addMessage(conv2.id, {
        role: 'user',
        content: 'How do I make pasta?'
      })

      const weatherResults = aiStore.searchConversations('weather')
      const cookingResults = aiStore.searchConversations('cooking')

      expect(weatherResults).toHaveLength(1)
      expect(weatherResults[0].id).toBe(conv1.id)
      expect(cookingResults).toHaveLength(1)
      expect(cookingResults[0].id).toBe(conv2.id)
    })

    it('should get conversations by date range', () => {
      const conv1 = aiStore.createConversation()
      const conv2 = aiStore.createConversation()

      // Mock different creation dates
      aiStore.updateConversation(conv1.id, { 
        createdAt: new Date('2024-01-01') 
      })
      aiStore.updateConversation(conv2.id, { 
        createdAt: new Date('2024-01-15') 
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-10')

      const results = aiStore.getConversationsByDateRange(startDate, endDate)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(conv1.id)
    })

    it('should get conversations by provider', () => {
      const conv1 = aiStore.createConversation({ provider: 'openai' })
      const conv2 = aiStore.createConversation({ provider: 'anthropic' })

      const openaiConversations = aiStore.getConversationsByProvider('openai')
      const anthropicConversations = aiStore.getConversationsByProvider('anthropic')

      expect(openaiConversations).toHaveLength(1)
      expect(openaiConversations[0].id).toBe(conv1.id)
      expect(anthropicConversations).toHaveLength(1)
      expect(anthropicConversations[0].id).toBe(conv2.id)
    })

    it('should get conversations by model', () => {
      const conv1 = aiStore.createConversation({ model: 'gpt-4' })
      const conv2 = aiStore.createConversation({ model: 'claude-3-sonnet' })

      const gpt4Conversations = aiStore.getConversationsByModel('gpt-4')
      const claudeConversations = aiStore.getConversationsByModel('claude-3-sonnet')

      expect(gpt4Conversations).toHaveLength(1)
      expect(gpt4Conversations[0].id).toBe(conv1.id)
      expect(claudeConversations).toHaveLength(1)
      expect(claudeConversations[0].id).toBe(conv2.id)
    })
  })

  describe('Data Management', () => {
    it('should export data', () => {
      const conversation = aiStore.createConversation()
      aiStore.addMessage(conversation.id, {
        role: 'user',
        content: 'Test message'
      })

      const exported = aiStore.exportData()
      const parsed = JSON.parse(exported)

      expect(parsed.conversations).toHaveLength(1)
      expect(parsed.conversations[0].id).toBe(conversation.id)
    })

    it('should import data', () => {
      const importData = {
        conversations: [
          {
            id: 'imported-conv',
            title: 'Imported Conversation',
            messages: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            settings: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.7,
              maxTokens: 1000,
              topP: 1,
              frequencyPenalty: 0
            },
            metadata: {
              totalTokens: 0,
              totalCost: 0,
              messageCount: 0
            }
          }
        ]
      }

      aiStore.importData(JSON.stringify(importData))

      expect(aiStore.conversations.value).toHaveLength(1)
      expect(aiStore.conversations.value[0].id).toBe('imported-conv')
    })

    it('should clear all data', () => {
      const conversation = aiStore.createConversation()
      aiStore.addMessage(conversation.id, {
        role: 'user',
        content: 'Test'
      })

      expect(aiStore.conversations.value).toHaveLength(1)

      aiStore.clearAllData()

      expect(aiStore.conversations.value).toHaveLength(0)
      expect(aiStore.activeConversationId.value).toBeNull()
    })
  })

  describe('State Management', () => {
    it('should set loading state', () => {
      expect(aiStore.isLoading.value).toBe(false)

      aiStore.setLoading(true)

      expect(aiStore.isLoading.value).toBe(true)
    })

    it('should set error state', () => {
      expect(aiStore.error.value).toBeNull()

      aiStore.setError('Test error')

      expect(aiStore.error.value).toBe('Test error')
    })
  })

  describe('Statistics', () => {
    it('should compute statistics correctly', () => {
      const conv1 = aiStore.createConversation()
      const conv2 = aiStore.createConversation()

      aiStore.addMessage(conv1.id, {
        role: 'user',
        content: 'Hello',
        metadata: { tokens: 10, cost: 0.001 }
      })

      aiStore.addMessage(conv2.id, {
        role: 'assistant',
        content: 'Hi',
        metadata: { tokens: 15, cost: 0.002 }
      })

      const stats = aiStore.stats.value

      expect(stats.totalConversations).toBe(2)
      expect(stats.totalMessages).toBe(2)
      expect(stats.totalTokens).toBe(25)
      expect(stats.totalCost).toBe(0.003)
    })

    it('should compute recent conversations', () => {
      const conv1 = aiStore.createConversation()
      const conv2 = aiStore.createConversation()
      const conv3 = aiStore.createConversation()

      // Simulate different update times
      aiStore.updateConversation(conv1.id, { updatedAt: new Date('2024-01-01') })
      aiStore.updateConversation(conv2.id, { updatedAt: new Date('2024-01-03') })
      aiStore.updateConversation(conv3.id, { updatedAt: new Date('2024-01-02') })

      const recent = aiStore.recentConversations.value

      expect(recent).toHaveLength(3)
      expect(recent[0].id).toBe(conv2.id) // Most recent
    })
  })
})