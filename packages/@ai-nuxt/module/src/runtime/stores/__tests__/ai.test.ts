import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAIStore } from '../ai'
import type { AIMessage, AIConversation, AIConversationSettings } from '../ai'

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

describe('AI Store', () => {
  let store: ReturnType<typeof useAIStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAIStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(store.conversations).toEqual([])
      expect(store.activeConversationId).toBeNull()
      expect(store.globalSettings.defaultProvider).toBe('openai')
      expect(store.globalSettings.defaultModel).toBe('gpt-4')
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should load persisted data on initialization', () => {
      const mockConversations = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
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

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'ai-nuxt:conversations') {
          return JSON.stringify(mockConversations)
        }
        if (key === 'ai-nuxt:active-conversation') {
          return JSON.stringify('conv-1')
        }
        return null
      })

      store.loadPersistedData()

      expect(store.conversations).toHaveLength(1)
      expect(store.conversations[0].id).toBe('conv-1')
      expect(store.activeConversationId).toBe('conv-1')
    })
  })

  describe('Conversation Management', () => {
    it('should create a new conversation', () => {
      const conversation = store.createConversation()

      expect(conversation).toBeDefined()
      expect(conversation.id).toBeDefined()
      expect(conversation.title).toBe('New Conversation')
      expect(conversation.messages).toEqual([])
      expect(store.conversations).toHaveLength(1)
      expect(store.activeConversationId).toBe(conversation.id)
    })

    it('should create conversation with custom settings', () => {
      const customSettings: Partial<AIConversationSettings> = {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.5
      }

      const conversation = store.createConversation(customSettings)

      expect(conversation.settings.provider).toBe('anthropic')
      expect(conversation.settings.model).toBe('claude-3-sonnet')
      expect(conversation.settings.temperature).toBe(0.5)
    })

    it('should delete a conversation', () => {
      const conversation = store.createConversation()
      const conversationId = conversation.id

      expect(store.conversations).toHaveLength(1)
      expect(store.activeConversationId).toBe(conversationId)

      store.deleteConversation(conversationId)

      expect(store.conversations).toHaveLength(0)
      expect(store.activeConversationId).toBeNull()
    })

    it('should update conversation', () => {
      const conversation = store.createConversation()
      const newTitle = 'Updated Title'

      store.updateConversation(conversation.id, { title: newTitle })

      expect(store.conversations[0].title).toBe(newTitle)
      expect(store.conversations[0].updatedAt).toBeInstanceOf(Date)
    })

    it('should set active conversation', () => {
      const conv1 = store.createConversation()
      const conv2 = store.createConversation()

      expect(store.activeConversationId).toBe(conv2.id)

      store.setActiveConversation(conv1.id)

      expect(store.activeConversationId).toBe(conv1.id)
    })

    it('should clear conversation messages', () => {
      const conversation = store.createConversation()
      
      // Add some messages
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello'
      })
      store.addMessage(conversation.id, {
        role: 'assistant',
        content: 'Hi there!'
      })

      expect(store.conversations[0].messages).toHaveLength(2)

      store.clearConversation(conversation.id)

      expect(store.conversations[0].messages).toHaveLength(0)
      expect(store.conversations[0].metadata?.messageCount).toBe(0)
    })
  })

  describe('Message Management', () => {
    let conversation: AIConversation

    beforeEach(() => {
      conversation = store.createConversation()
    })

    it('should add a message', () => {
      const message = store.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello world'
      })

      expect(message).toBeDefined()
      expect(message.id).toBeDefined()
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello world')
      expect(message.timestamp).toBeInstanceOf(Date)
      expect(store.conversations[0].messages).toHaveLength(1)
    })

    it('should update conversation title from first user message', () => {
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'What is the weather like today?'
      })

      expect(store.conversations[0].title).toBe('What is the weather like today?')
    })

    it('should truncate long titles', () => {
      const longMessage = 'This is a very long message that should be truncated when used as a conversation title because it exceeds the maximum length'
      
      store.addMessage(conversation.id, {
        role: 'user',
        content: longMessage
      })

      expect(store.conversations[0].title).toBe('This is a very long message that should be truncat...')
    })

    it('should update message', () => {
      const message = store.addMessage(conversation.id, {
        role: 'user',
        content: 'Original content'
      })

      store.updateMessage(conversation.id, message.id, {
        content: 'Updated content'
      })

      expect(store.conversations[0].messages[0].content).toBe('Updated content')
    })

    it('should delete message', () => {
      const message = store.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello'
      })

      expect(store.conversations[0].messages).toHaveLength(1)

      store.deleteMessage(conversation.id, message.id)

      expect(store.conversations[0].messages).toHaveLength(0)
    })

    it('should update metadata when adding messages with tokens and cost', () => {
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Hello',
        metadata: {
          tokens: 10,
          cost: 0.001
        }
      })

      store.addMessage(conversation.id, {
        role: 'assistant',
        content: 'Hi there!',
        metadata: {
          tokens: 15,
          cost: 0.002
        }
      })

      const conv = store.conversations[0]
      expect(conv.metadata?.totalTokens).toBe(25)
      expect(conv.metadata?.totalCost).toBe(0.003)
      expect(conv.metadata?.messageCount).toBe(2)
    })
  })

  describe('Settings Management', () => {
    it('should update conversation settings', () => {
      const conversation = store.createConversation()
      const newSettings: Partial<AIConversationSettings> = {
        temperature: 0.9,
        maxTokens: 2000
      }

      store.updateConversationSettings(conversation.id, newSettings)

      expect(store.conversations[0].settings.temperature).toBe(0.9)
      expect(store.conversations[0].settings.maxTokens).toBe(2000)
    })

    it('should update global settings', () => {
      const newSettings = {
        defaultProvider: 'anthropic' as const,
        debugMode: true
      }

      store.updateGlobalSettings(newSettings)

      expect(store.globalSettings.defaultProvider).toBe('anthropic')
      expect(store.globalSettings.debugMode).toBe(true)
    })

    it('should manage API keys', () => {
      const apiKey = 'sk-test-key'
      
      store.setApiKey('openai', apiKey)

      expect(store.getApiKey('openai')).toBe(apiKey)
      expect(store.globalSettings.apiKeys.openai).toBe(apiKey)
    })
  })

  describe('Computed Properties', () => {
    it('should compute active conversation', () => {
      const conversation = store.createConversation()

      expect(store.activeConversation).toBe(conversation)

      store.setActiveConversation(null)

      expect(store.activeConversation).toBeNull()
    })

    it('should compute statistics', () => {
      const conv1 = store.createConversation()
      const conv2 = store.createConversation()

      store.addMessage(conv1.id, {
        role: 'user',
        content: 'Hello',
        metadata: { tokens: 10, cost: 0.001 }
      })

      store.addMessage(conv2.id, {
        role: 'assistant',
        content: 'Hi',
        metadata: { tokens: 15, cost: 0.002 }
      })

      const stats = store.stats

      expect(stats.totalConversations).toBe(2)
      expect(stats.totalMessages).toBe(2)
      expect(stats.totalTokens).toBe(25)
      expect(stats.totalCost).toBe(0.003)
    })

    it('should compute recent conversations', () => {
      // Create conversations with different update times
      const conv1 = store.createConversation()
      const conv2 = store.createConversation()
      const conv3 = store.createConversation()

      // Update timestamps to simulate different update times
      store.updateConversation(conv1.id, { updatedAt: new Date('2024-01-01') })
      store.updateConversation(conv2.id, { updatedAt: new Date('2024-01-03') })
      store.updateConversation(conv3.id, { updatedAt: new Date('2024-01-02') })

      const recent = store.recentConversations

      expect(recent).toHaveLength(3)
      expect(recent[0].id).toBe(conv2.id) // Most recent
      expect(recent[1].id).toBe(conv3.id) // Middle
      expect(recent[2].id).toBe(conv1.id) // Oldest
    })
  })

  describe('Data Import/Export', () => {
    it('should export conversations', () => {
      const conversation = store.createConversation()
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Test message'
      })

      const exported = store.exportConversations()
      const parsed = JSON.parse(exported)

      expect(parsed.conversations).toHaveLength(1)
      expect(parsed.conversations[0].id).toBe(conversation.id)
      expect(parsed.globalSettings).toBeDefined()
      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.version).toBe('1.0')
    })

    it('should import conversations', () => {
      const importData = {
        conversations: [
          {
            id: 'imported-conv',
            title: 'Imported Conversation',
            messages: [
              {
                id: 'msg-1',
                role: 'user',
                content: 'Imported message',
                timestamp: '2024-01-01T00:00:00.000Z'
              }
            ],
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
              messageCount: 1
            }
          }
        ],
        globalSettings: {
          defaultProvider: 'anthropic'
        }
      }

      store.importConversations(JSON.stringify(importData))

      expect(store.conversations).toHaveLength(1)
      expect(store.conversations[0].id).toBe('imported-conv')
      expect(store.conversations[0].messages[0].timestamp).toBeInstanceOf(Date)
      expect(store.globalSettings.defaultProvider).toBe('anthropic')
    })

    it('should handle invalid import data', () => {
      expect(() => {
        store.importConversations('invalid json')
      }).toThrow('Invalid import data format')
    })
  })

  describe('Persistence', () => {
    it('should persist data to localStorage', () => {
      const conversation = store.createConversation()
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Test'
      })

      store.persistData()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-nuxt:conversations',
        expect.any(String)
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-nuxt:active-conversation',
        expect.any(String)
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-nuxt:global-settings',
        expect.any(String)
      )
    })

    it('should not persist when persistence is disabled', () => {
      store.updateGlobalSettings({ enablePersistence: false })
      
      const conversation = store.createConversation()
      store.persistData()

      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should set loading state', () => {
      expect(store.isLoading).toBe(false)

      store.setLoading(true)

      expect(store.isLoading).toBe(true)
    })

    it('should set error state', () => {
      expect(store.error).toBeNull()

      store.setError('Test error')

      expect(store.error).toBe('Test error')

      store.setError(null)

      expect(store.error).toBeNull()
    })
  })

  describe('Clear All Data', () => {
    it('should clear all data and localStorage', () => {
      // Create some data
      const conversation = store.createConversation()
      store.addMessage(conversation.id, {
        role: 'user',
        content: 'Test'
      })
      store.setApiKey('openai', 'test-key')

      expect(store.conversations).toHaveLength(1)
      expect(store.activeConversationId).toBeTruthy()

      store.clearAllData()

      expect(store.conversations).toHaveLength(0)
      expect(store.activeConversationId).toBeNull()
      expect(store.globalSettings.apiKeys).toEqual({})
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(4) // All storage keys
    })
  })
})