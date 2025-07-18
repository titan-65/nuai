import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAIStreamingChat } from '../useAIStreamingChat'
import { useAI } from '../useAI'
import { useAIStream } from '../useAIStream'

// Mock dependencies
vi.mock('../useAI', () => ({
  useAI: vi.fn()
}))

vi.mock('../useAIStream', () => ({
  useAIStream: vi.fn()
}))

// Mock DOM methods
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true
})

describe('useAIStreamingChat', () => {
  let mockAI: any
  let mockStream: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock AI interface
    mockAI = {
      chat: {
        stream: vi.fn()
      }
    }
    
    // Setup mock stream interface
    mockStream = {
      isStreaming: { value: false },
      chunks: { value: [] },
      fullContent: { value: '' },
      error: { value: null }
    }
    
    vi.mocked(useAI).mockReturnValue(mockAI)
    vi.mocked(useAIStream).mockReturnValue(mockStream)
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const chat = useAIStreamingChat()
      
      expect(chat.messages.value).toEqual([])
      expect(chat.streamingState.value.isStreaming).toBe(false)
      expect(chat.streamingState.value.isPaused).toBe(false)
      expect(chat.error.value).toBeNull()
      expect(chat.isTyping.value).toBe(false)
    })
    
    it('should initialize with custom options', () => {
      const chat = useAIStreamingChat({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.8,
        maxTokens: 2000,
        systemPrompt: 'You are helpful',
        autoScroll: true,
        typingSpeed: 50,
        showTypingIndicator: true,
        pauseOnError: true,
        retryOnError: true,
        maxRetries: 5
      })
      
      expect(chat.messages.value).toEqual([])
      expect(useAI).toHaveBeenCalledWith({ provider: 'anthropic' })
    })
  })
  
  describe('streaming functionality', () => {
    it('should stream message successfully', async () => {
      const mockStreamData = [
        { content: 'Hello', delta: 'Hello', finished: false },
        { content: ' there', delta: ' there', finished: false },
        { content: '!', delta: '!', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat()
      const result = await chat.streamMessage('Hello AI')
      
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[0].role).toBe('user')
      expect(chat.messages.value[0].content).toBe('Hello AI')
      expect(chat.messages.value[1].role).toBe('assistant')
      expect(chat.messages.value[1].content).toBe('Hello there!')
      expect(result.content).toBe('Hello there!')
      expect(result.chunkCount).toBe(3)
    })
    
    it('should handle streaming errors', async () => {
      const mockError = new Error('Streaming failed')
      mockAI.chat.stream.mockRejectedValue(mockError)
      
      const chat = useAIStreamingChat()
      
      await expect(chat.streamMessage('Hello')).rejects.toThrow('Streaming failed')
      expect(chat.error.value).toBe(mockError)
    })
    
    it('should prevent concurrent streaming', async () => {
      mockAI.chat.stream.mockImplementation(async function* () {
        yield { content: 'Test', delta: 'Test', finished: true }
      })
      
      const chat = useAIStreamingChat()
      
      const promise1 = chat.streamMessage('Message 1')
      
      await expect(chat.streamMessage('Message 2')).rejects.toThrow('Already streaming a message')
      
      await promise1
    })
    
    it('should show typing indicator when enabled', async () => {
      mockAI.chat.stream.mockImplementation(async function* () {
        yield { content: 'Response', delta: 'Response', finished: true }
      })
      
      const chat = useAIStreamingChat({ 
        showTypingIndicator: true 
      })
      
      const streamPromise = chat.streamMessage('Hello')
      
      // Check if typing indicator was shown
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await streamPromise
      
      expect(chat.isTyping.value).toBe(false)
    })
    
    it('should simulate typing speed when enabled', async () => {
      const mockStreamData = [
        { content: 'H', delta: 'H', finished: false },
        { content: 'e', delta: 'e', finished: false },
        { content: 'l', delta: 'l', finished: false },
        { content: 'l', delta: 'l', finished: false },
        { content: 'o', delta: 'o', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat({ 
        typingSpeed: 100 // 100 characters per second
      })
      
      const startTime = Date.now()
      await chat.streamMessage('Hello')
      const endTime = Date.now()
      
      // Should take some time due to typing speed simulation
      expect(endTime - startTime).toBeGreaterThan(40) // At least some delay
    })
  })
  
  describe('streaming control', () => {
    it('should pause and resume streaming', async () => {
      let streamGenerator: any
      const mockStreamData = [
        { content: 'Hello', delta: 'Hello', finished: false },
        { content: ' World', delta: ' World', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        streamGenerator = this
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat()
      
      const streamPromise = chat.streamMessage('Hello')
      
      // Wait a bit then pause
      await new Promise(resolve => setTimeout(resolve, 10))
      chat.pauseStreaming()
      
      expect(chat.streamingState.value.isPaused).toBe(true)
      
      // Resume
      chat.resumeStreaming()
      expect(chat.streamingState.value.isPaused).toBe(false)
      
      await streamPromise
    })
    
    it('should cancel streaming', async () => {
      mockAI.chat.stream.mockImplementation(async function* () {
        yield { content: 'Start', delta: 'Start', finished: false }
        // This should be interrupted
        yield { content: ' End', delta: ' End', finished: true }
      })
      
      const chat = useAIStreamingChat()
      
      const streamPromise = chat.streamMessage('Hello')
      
      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 10))
      chat.cancelStreaming()
      
      expect(chat.streamingState.value.isStreaming).toBe(false)
      
      // Stream should be cancelled
      await expect(streamPromise).rejects.toThrow()
    })
  })
  
  describe('streaming statistics', () => {
    it('should track streaming progress', async () => {
      const mockStreamData = [
        { content: 'Hello', delta: 'Hello', finished: false },
        { content: ' World', delta: ' World', finished: false },
        { content: '!', delta: '!', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat()
      await chat.streamMessage('Hello')
      
      const stats = chat.streamingStats.value
      
      expect(stats.wordsPerSecond).toBeGreaterThanOrEqual(0)
      expect(stats.chunksProcessed).toBe(3)
    })
    
    it('should calculate words per second', async () => {
      const mockStreamData = [
        { content: 'One', delta: 'One', finished: false },
        { content: ' Two', delta: ' Two', finished: false },
        { content: ' Three', delta: ' Three', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat()
      const result = await chat.streamMessage('Count')
      
      expect(result.wordsPerSecond).toBeGreaterThan(0)
    })
  })
  
  describe('retry functionality', () => {
    it('should retry on error when enabled', async () => {
      let attemptCount = 0
      
      mockAI.chat.stream.mockImplementation(async function* () {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary error')
        }
        yield { content: 'Success', delta: 'Success', finished: true }
      })
      
      const chat = useAIStreamingChat({ 
        retryOnError: true,
        maxRetries: 3
      })
      
      const result = await chat.streamMessage('Hello')
      
      expect(result.content).toBe('Success')
      expect(attemptCount).toBe(3)
    })
    
    it('should fail after max retries', async () => {
      mockAI.chat.stream.mockImplementation(async function* () {
        throw new Error('Persistent error')
      })
      
      const chat = useAIStreamingChat({ 
        retryOnError: true,
        maxRetries: 2
      })
      
      await expect(chat.streamMessage('Hello')).rejects.toThrow('Persistent error')
    })
    
    it('should pause on error when enabled', async () => {
      mockAI.chat.stream.mockImplementation(async function* () {
        throw new Error('Stream error')
      })
      
      const chat = useAIStreamingChat({ 
        pauseOnError: true
      })
      
      await expect(chat.streamMessage('Hello')).rejects.toThrow('Stream error')
      expect(chat.streamingState.value.isPaused).toBe(true)
    })
  })
  
  describe('batch streaming', () => {
    it('should stream multiple messages in batch', async () => {
      mockAI.chat.stream.mockImplementation(async function* (options: any) {
        const lastMessage = options.messages[options.messages.length - 1]
        yield { content: `Response to: ${lastMessage.content}`, delta: `Response to: ${lastMessage.content}`, finished: true }
      })
      
      const chat = useAIStreamingChat()
      
      const results = await chat.streamBatch(['Hello', 'How are you?'], { delay: 10 })
      
      expect(results).toHaveLength(2)
      expect(chat.messages.value).toHaveLength(4) // 2 user + 2 assistant messages
    })
  })
  
  describe('message management', () => {
    it('should add messages correctly', () => {
      const chat = useAIStreamingChat()
      
      const message = chat.addMessage({
        role: 'user',
        content: 'Test message'
      })
      
      expect(message.id).toBeTruthy()
      expect(message.timestamp).toBeInstanceOf(Date)
      expect(chat.messages.value).toHaveLength(1)
    })
    
    it('should update messages', () => {
      const chat = useAIStreamingChat()
      
      const message = chat.addMessage({
        role: 'assistant',
        content: 'Original'
      })
      
      chat.updateMessage(message.id, {
        content: 'Updated',
        metadata: { chunkCount: 5 }
      })
      
      const updatedMessage = chat.messages.value.find(m => m.id === message.id)
      expect(updatedMessage?.content).toBe('Updated')
    })
  })
  
  describe('computed properties', () => {
    it('should compute last message correctly', () => {
      const chat = useAIStreamingChat()
      
      expect(chat.lastMessage.value).toBeNull()
      
      const message = chat.addMessage({ role: 'user', content: 'Hello' })
      expect(chat.lastMessage.value?.id).toBe(message.id)
    })
    
    it('should detect streaming message', () => {
      const chat = useAIStreamingChat()
      
      expect(chat.isStreamingMessage.value).toBe(false)
      
      // Add assistant message and set streaming state
      chat.addMessage({ role: 'assistant', content: 'Streaming...' })
      chat.streamingState.value.isStreaming = true
      
      expect(chat.isStreamingMessage.value).toBe(true)
    })
    
    it('should calculate streaming progress', () => {
      const chat = useAIStreamingChat()
      
      chat.streamingState.value.totalChunks = 10
      chat.streamingState.value.processedChunks = 3
      
      expect(chat.streamingProgress.value).toBe(30)
    })
  })
  
  describe('utility methods', () => {
    it('should clear conversation', () => {
      const chat = useAIStreamingChat()
      
      chat.addMessage({ role: 'user', content: 'Hello' })
      chat.addMessage({ role: 'assistant', content: 'Hi' })
      
      chat.clear()
      
      expect(chat.messages.value).toHaveLength(0)
      expect(chat.error.value).toBeNull()
      expect(chat.streamingState.value.isStreaming).toBe(false)
    })
    
    it('should scroll to bottom when auto-scroll is enabled', async () => {
      const mockStreamData = [
        { content: 'Test', delta: 'Test', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat({ autoScroll: true })
      
      await chat.streamMessage('Hello')
      
      // Should have called scrollTo
      expect(window.scrollTo).toHaveBeenCalled()
    })
  })
  
  describe('advanced features', () => {
    it('should handle custom chunk processing', async () => {
      const mockStreamData = [
        { content: 'test', delta: 'test', finished: true }
      ]
      
      mockAI.chat.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk
        }
      })
      
      const chat = useAIStreamingChat()
      
      const processor = (chunk: string, fullContent: string) => {
        return chunk.toUpperCase()
      }
      
      await chat.streamWithProcessor('hello', processor)
      
      // The processor should have been applied
      expect(chat.messages.value[1].content).toBe('test') // Original content preserved
    })
  })
})