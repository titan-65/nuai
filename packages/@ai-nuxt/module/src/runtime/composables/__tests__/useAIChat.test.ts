import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAIChat } from '../useAIChat'
import { useAI } from '../useAI'
import type { Message } from '@ai-nuxt/core'

// Mock useAI composable
vi.mock('../useAI', () => ({
  useAI: vi.fn()
}))

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

describe('useAIChat', () => {
  let mockAI: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock AI interface
    mockAI = {
      chat: {
        create: vi.fn(),
        stream: vi.fn()
      }
    }
    
    vi.mocked(useAI).mockReturnValue(mockAI)
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const chat = useAIChat()
      
      expect(chat.messages.value).toEqual([])
      expect(chat.isLoading.value).toBe(false)
      expect(chat.isStreaming.value).toBe(false)
      expect(chat.error.value).toBeNull()
      expect(chat.conversationLength.value).toBe(0)
    })
    
    it('should initialize with initial messages', () => {
      const initialMessages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }
      ]
      
      const chat = useAIChat({ initialMessages })
      
      expect(chat.messages.value).toEqual(initialMessages)
      expect(chat.conversationLength.value).toBe(1)
    })
    
    it('should initialize with custom options', () => {
      const chat = useAIChat({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.8,
        maxTokens: 2000,
        systemPrompt: 'You are helpful',
        maxMessages: 100,
        contextWindow: 10
      })
      
      expect(chat.messages.value).toEqual([])
      expect(useAI).toHaveBeenCalledWith({ provider: 'anthropic' })
    })
  })
  
  describe('message management', () => {
    it('should add messages correctly', () => {
      const chat = useAIChat()
      
      const message = chat.addMessage({
        role: 'user',
        content: 'Test message'
      })
      
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeInstanceOf(Date)
      expect(message.role).toBe('user')
      expect(message.content).toBe('Test message')
      expect(chat.messages.value).toHaveLength(1)
    })
    
    it('should update messages', () => {
      const chat = useAIChat()
      
      const message = chat.addMessage({
        role: 'user',
        content: 'Original content'
      })
      
      chat.updateMessage(message.id, {
        content: 'Updated content',
        metadata: { tokens: 10 }
      })
      
      const updatedMessage = chat.messages.value.find(m => m.id === message.id)
      expect(updatedMessage?.content).toBe('Updated content')
      expect(updatedMessage?.metadata?.tokens).toBe(10)
    })
    
    it('should remove messages', () => {
      const chat = useAIChat()
      
      const message1 = chat.addMessage({ role: 'user', content: 'Message 1' })
      const message2 = chat.addMessage({ role: 'user', content: 'Message 2' })
      
      expect(chat.messages.value).toHaveLength(2)
      
      chat.removeMessage(message1.id)
      
      expect(chat.messages.value).toHaveLength(1)
      expect(chat.messages.value[0].id).toBe(message2.id)
    })
    
    it('should edit messages', () => {
      const chat = useAIChat()
      
      const message = chat.addMessage({
        role: 'user',
        content: 'Original content'
      })
      
      chat.editMessage(message.id, 'Edited content')
      
      const editedMessage = chat.messages.value.find(m => m.id === message.id)
      expect(editedMessage?.content).toBe('Edited content')
    })
    
    it('should insert messages at specific index', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'Message 1' })
      chat.addMessage({ role: 'user', content: 'Message 3' })
      
      const insertedMessage = chat.insertMessage(
        { role: 'user', content: 'Message 2' },
        1
      )
      
      expect(chat.messages.value).toHaveLength(3)
      expect(chat.messages.value[1].id).toBe(insertedMessage.id)
      expect(chat.messages.value[1].content).toBe('Message 2')
    })
    
    it('should enforce max messages limit', () => {
      const chat = useAIChat({ maxMessages: 3 })
      
      chat.addMessage({ role: 'user', content: 'Message 1' })
      chat.addMessage({ role: 'assistant', content: 'Response 1' })
      chat.addMessage({ role: 'user', content: 'Message 2' })
      chat.addMessage({ role: 'assistant', content: 'Response 2' })
      
      expect(chat.messages.value).toHaveLength(3)
      expect(chat.messages.value[0].content).toBe('Response 1')
    })
  })
  
  describe('computed properties', () => {
    it('should compute last message correctly', () => {
      const chat = useAIChat()
      
      expect(chat.lastMessage.value).toBeNull()
      
      const message1 = chat.addMessage({ role: 'user', content: 'First' })
      expect(chat.lastMessage.value?.id).toBe(message1.id)
      
      const message2 = chat.addMessage({ role: 'assistant', content: 'Second' })
      expect(chat.lastMessage.value?.id).toBe(message2.id)
    })
    
    it('should compute last user message correctly', () => {
      const chat = useAIChat()
      
      expect(chat.lastUserMessage.value).toBeNull()
      
      const userMessage = chat.addMessage({ role: 'user', content: 'User message' })
      chat.addMessage({ role: 'assistant', content: 'Assistant message' })
      
      expect(chat.lastUserMessage.value?.id).toBe(userMessage.id)
    })
    
    it('should compute conversation summary', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'User 1', metadata: { tokens: 5 } })
      chat.addMessage({ role: 'assistant', content: 'Assistant 1', metadata: { tokens: 10 } })
      chat.addMessage({ role: 'user', content: 'User 2', metadata: { tokens: 3 } })
      
      const summary = chat.conversationSummary.value
      
      expect(summary.totalMessages).toBe(3)
      expect(summary.userMessages).toBe(2)
      expect(summary.assistantMessages).toBe(1)
      expect(summary.totalTokens).toBe(18)
    })
    
    it('should compute context messages with window limit', () => {
      const chat = useAIChat({ contextWindow: 2 })
      
      chat.addMessage({ role: 'system', content: 'System prompt' })
      chat.addMessage({ role: 'user', content: 'Message 1' })
      chat.addMessage({ role: 'assistant', content: 'Response 1' })
      chat.addMessage({ role: 'user', content: 'Message 2' })
      chat.addMessage({ role: 'assistant', content: 'Response 2' })
      
      const contextMessages = chat.contextMessages.value
      
      expect(contextMessages).toHaveLength(3) // System + last 2 messages
      expect(contextMessages[0].role).toBe('system')
      expect(contextMessages[1].content).toBe('Message 2')
      expect(contextMessages[2].content).toBe('Response 2')
    })
  })
  
  describe('chat operations', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        message: {
          id: 'ai-response',
          role: 'assistant' as const,
          content: 'AI response',
          timestamp: new Date()
        },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      mockAI.chat.create.mockResolvedValue(mockResponse)
      
      const chat = useAIChat()
      const result = await chat.send('Hello AI')
      
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[0].role).toBe('user')
      expect(chat.messages.value[0].content).toBe('Hello AI')
      expect(chat.messages.value[1].role).toBe('assistant')
      expect(chat.messages.value[1].content).toBe('AI response')
      expect(result.latency).toBeGreaterThan(0)
    })
    
    it('should handle send errors', async () => {
      const mockError = new Error('API Error')
      mockAI.chat.create.mockRejectedValue(mockError)
      
      const chat = useAIChat()
      
      await expect(chat.send('Hello')).rejects.toThrow('API Error')
      expect(chat.error.value).toBe(mockError)
      expect(chat.isLoading.value).toBe(false)
    })
    
    it('should prevent concurrent sends', async () => {
      mockAI.chat.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const chat = useAIChat()
      
      const promise1 = chat.send('Message 1')
      
      await expect(chat.send('Message 2')).rejects.toThrow('Chat is already processing a message')
      
      await promise1
    })
    
    it('should stream messages successfully', async () => {
      const mockStream = [
        { content: 'Hello', delta: 'Hello', finished: false },
        { content: ' there', delta: ' there', finished: false },
        { content: '', delta: '', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStream) {
          yield chunk
        }
      })
      
      const chat = useAIChat()
      const result = await chat.stream('Hello AI')
      
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[1].content).toBe('Hello there')
      expect(result.content).toBe('Hello there')
      expect(result.chunkCount).toBe(2)
    })
    
    it('should retry last user message', async () => {
      const mockResponse = {
        message: {
          id: 'retry-response',
          role: 'assistant' as const,
          content: 'Retry response',
          timestamp: new Date()
        },
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      mockAI.chat.create.mockResolvedValue(mockResponse)
      
      const chat = useAIChat()
      
      // Add some messages
      chat.addMessage({ role: 'user', content: 'Original message' })
      chat.addMessage({ role: 'assistant', content: 'Original response' })
      
      await chat.retry()
      
      expect(chat.messages.value).toHaveLength(3)
      expect(chat.messages.value[2].content).toBe('Retry response')
      
      // Check retry count was incremented
      const userMessage = chat.messages.value[0]
      expect(userMessage.metadata?.retryCount).toBe(1)
    })
    
    it('should regenerate last assistant message', async () => {
      const mockResponse = {
        message: {
          id: 'regenerated',
          role: 'assistant' as const,
          content: 'Regenerated response',
          timestamp: new Date()
        },
        usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 },
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      }
      
      mockAI.chat.create.mockResolvedValue(mockResponse)
      
      const chat = useAIChat()
      
      // Add messages
      chat.addMessage({ role: 'user', content: 'User message' })
      const assistantMessage = chat.addMessage({ role: 'assistant', content: 'Original response' })
      
      await chat.regenerate()
      
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[1].content).toBe('Regenerated response')
      expect(chat.messages.value[1].id).not.toBe(assistantMessage.id)
    })
  })
  
  describe('history management', () => {
    it('should support undo/redo operations', () => {
      const chat = useAIChat()
      
      // Initial state
      expect(chat.canUndo.value).toBe(false)
      expect(chat.canRedo.value).toBe(false)
      
      // Add a message
      chat.addMessage({ role: 'user', content: 'Message 1' })
      
      expect(chat.canUndo.value).toBe(true)
      expect(chat.messages.value).toHaveLength(1)
      
      // Undo
      chat.undo()
      
      expect(chat.messages.value).toHaveLength(0)
      expect(chat.canRedo.value).toBe(true)
      
      // Redo
      chat.redo()
      
      expect(chat.messages.value).toHaveLength(1)
      expect(chat.messages.value[0].content).toBe('Message 1')
    })
  })
  
  describe('persistence', () => {
    it('should save to localStorage when autoSave is enabled', () => {
      const chat = useAIChat({ 
        persistenceKey: 'test-chat',
        autoSave: true 
      })
      
      chat.addMessage({ role: 'user', content: 'Test message' })
      
      // Wait for next tick to allow watcher to trigger
      setTimeout(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'ai-chat-test-chat',
          expect.stringContaining('Test message')
        )
      }, 0)
    })
    
    it('should load from localStorage on initialization', () => {
      const storedData = {
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Stored message',
            timestamp: new Date().toISOString()
          }
        ],
        conversationId: 'stored-id',
        totalCost: 0.05,
        timestamp: new Date().toISOString()
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      
      const chat = useAIChat({ persistenceKey: 'test-chat' })
      
      expect(chat.messages.value).toHaveLength(1)
      expect(chat.messages.value[0].content).toBe('Stored message')
    })
    
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })
      
      // Should not throw
      expect(() => useAIChat({ persistenceKey: 'test-chat' })).not.toThrow()
    })
  })
  
  describe('export/import', () => {
    it('should export conversation as JSON', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'Hello' })
      chat.addMessage({ role: 'assistant', content: 'Hi there!' })
      
      const exported = chat.exportConversation('json')
      const parsed = JSON.parse(exported)
      
      expect(parsed.messages).toHaveLength(2)
      expect(parsed.messages[0].content).toBe('Hello')
      expect(parsed.messages[1].content).toBe('Hi there!')
      expect(parsed.exportedAt).toBeTruthy()
    })
    
    it('should export conversation as markdown', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'Hello' })
      chat.addMessage({ role: 'assistant', content: 'Hi there!' })
      
      const exported = chat.exportConversation('markdown')
      
      expect(exported).toContain('## User')
      expect(exported).toContain('Hello')
      expect(exported).toContain('## Assistant')
      expect(exported).toContain('Hi there!')
    })
    
    it('should export conversation as text', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'Hello' })
      chat.addMessage({ role: 'assistant', content: 'Hi there!' })
      
      const exported = chat.exportConversation('text')
      
      expect(exported).toContain('USER: Hello')
      expect(exported).toContain('ASSISTANT: Hi there!')
    })
    
    it('should import conversation from JSON', () => {
      const chat = useAIChat()
      
      const importData = {
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Imported message',
            timestamp: new Date().toISOString()
          }
        ],
        summary: { totalCost: 0.02 }
      }
      
      chat.importConversation(JSON.stringify(importData))
      
      expect(chat.messages.value).toHaveLength(1)
      expect(chat.messages.value[0].content).toBe('Imported message')
    })
  })
  
  describe('utility methods', () => {
    it('should clear conversation', () => {
      const chat = useAIChat()
      
      chat.addMessage({ role: 'user', content: 'Message 1' })
      chat.addMessage({ role: 'assistant', content: 'Response 1' })
      
      expect(chat.messages.value).toHaveLength(2)
      
      chat.clear()
      
      expect(chat.messages.value).toHaveLength(0)
      expect(chat.error.value).toBeNull()
      expect(chat.usage.value).toBeNull()
    })
    
    it('should calculate total tokens correctly', () => {
      const chat = useAIChat()
      
      chat.addMessage({ 
        role: 'user', 
        content: 'Message 1',
        metadata: { tokens: 10 }
      })
      chat.addMessage({ 
        role: 'assistant', 
        content: 'Response 1',
        metadata: { tokens: 15 }
      })
      
      expect(chat.totalTokens.value).toBe(25)
    })
  })
})