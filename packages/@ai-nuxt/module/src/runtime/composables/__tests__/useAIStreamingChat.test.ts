import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useAIStreamingChat } from '../useAIStreamingChat'

// Mock fetch for SSE testing
global.fetch = vi.fn()

// Mock useRuntimeConfig
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      aiNuxt: {
        streaming: {
          enabled: true,
          transport: 'sse'
        }
      }
    }
  })
}))

// Mock useAISocket
const mockSocket = {
  isConnected: { value: false },
  reconnectAttempts: { value: 0 },
  activeStreams: { value: new Set() },
  connect: vi.fn(),
  disconnect: vi.fn(),
  sendChat: vi.fn(),
  cancelStream: vi.fn(),
  onChatChunk: vi.fn(),
  onStreamComplete: vi.fn(),
  onError: vi.fn()
}

vi.mock('./useAISocket', () => ({
  useAISocket: () => mockSocket
}))

describe('useAIStreamingChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.isConnected.value = false
    mockSocket.reconnectAttempts.value = 0
    mockSocket.activeStreams.value = new Set()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with correct default state', () => {
    const chat = useAIStreamingChat()

    expect(chat.messages.value).toEqual([])
    expect(chat.currentMessage.value).toBe('')
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.error.value).toBe(null)
  })

  it('should initialize with SSE transport by default', () => {
    const chat = useAIStreamingChat()
    expect(chat.isConnected.value).toBe(true) // SSE doesn't require persistent connection
  })

  it('should initialize with WebSocket transport when specified', () => {
    const chat = useAIStreamingChat({ transport: 'websocket' })
    expect(chat.isConnected.value).toBe(false) // WebSocket starts disconnected
  })

  it('should send message via SSE', async () => {
    // Mock successful SSE response
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"delta": "Hello", "finished": false}\n\n')
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"delta": " World", "finished": false}\n\n')
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"delta": "!", "finished": true}\n\n')
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined
        })
    }

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader
      }
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const chat = useAIStreamingChat({ transport: 'sse' })
    
    await chat.sendMessage('Test message')

    expect(fetch).toHaveBeenCalledWith('/api/ai/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'chat',
        messages: [{ role: 'user', content: 'Test message' }],
        provider: undefined,
        model: undefined,
        temperature: undefined,
        maxTokens: undefined
      })
    })

    // Wait for streaming to complete
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[0].content).toBe('Test message')
    expect(chat.messages.value[1].role).toBe('assistant')
    expect(chat.messages.value[1].content).toBe('Hello World!')
    expect(chat.isStreaming.value).toBe(false)
  })

  it('should send message via WebSocket', async () => {
    mockSocket.isConnected.value = true
    mockSocket.sendChat.mockResolvedValue('stream-123')

    const chat = useAIStreamingChat({ 
      transport: 'websocket',
      provider: 'openai',
      temperature: 0.7
    })

    await chat.sendMessage('Test message')

    expect(mockSocket.sendChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Test message' }],
      {
        provider: 'openai',
        model: undefined,
        temperature: 0.7,
        maxTokens: undefined
      }
    )

    expect(chat.messages.value).toHaveLength(1)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[0].content).toBe('Test message')
    expect(chat.isStreaming.value).toBe(true)
  })

  it('should handle WebSocket chat chunks', async () => {
    mockSocket.isConnected.value = true
    mockSocket.sendChat.mockResolvedValue('stream-123')

    const chat = useAIStreamingChat({ transport: 'websocket' })

    // Get the chunk handler that was registered
    const chunkHandler = mockSocket.onChatChunk.mock.calls[0][0]

    await chat.sendMessage('Test message')

    // Simulate receiving chunks
    chunkHandler({ delta: 'Hello' }, 'stream-123')
    chunkHandler({ delta: ' World' }, 'stream-123')

    expect(chat.currentMessage.value).toBe('Hello World')
  })

  it('should handle WebSocket stream completion', async () => {
    mockSocket.isConnected.value = true
    mockSocket.sendChat.mockResolvedValue('stream-123')

    const chat = useAIStreamingChat({ transport: 'websocket' })

    // Get the handlers that were registered
    const chunkHandler = mockSocket.onChatChunk.mock.calls[0][0]
    const completeHandler = mockSocket.onStreamComplete.mock.calls[0][0]

    await chat.sendMessage('Test message')

    // Simulate receiving chunks
    chunkHandler({ delta: 'Hello World!' }, 'stream-123')

    // Simulate stream completion
    completeHandler({ totalChunks: 3, duration: 1000 }, 'stream-123')

    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[1].role).toBe('assistant')
    expect(chat.messages.value[1].content).toBe('Hello World!')
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.currentMessage.value).toBe('')
  })

  it('should handle errors', async () => {
    const chat = useAIStreamingChat({ transport: 'websocket' })

    // Get the error handler that was registered
    const errorHandler = mockSocket.onError.mock.calls[0][0]

    // Simulate error
    errorHandler('Connection failed', 'stream-123')

    expect(chat.error.value).toBe('Connection failed')
    expect(chat.isStreaming.value).toBe(false)
  })

  it('should include system prompt when provided', async () => {
    mockSocket.isConnected.value = true
    mockSocket.sendChat.mockResolvedValue('stream-123')

    const chat = useAIStreamingChat({ 
      transport: 'websocket',
      systemPrompt: 'You are a helpful assistant.'
    })

    await chat.sendMessage('Test message')

    expect(mockSocket.sendChat).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Test message' }
      ],
      expect.any(Object)
    )
  })

  it('should clear messages', () => {
    const chat = useAIStreamingChat()

    // Add some messages
    chat.messages.value = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      { id: '2', role: 'assistant', content: 'Hi there!', timestamp: new Date() }
    ]
    chat.currentMessage.value = 'Partial message'
    chat.error.value = 'Some error'

    chat.clearMessages()

    expect(chat.messages.value).toEqual([])
    expect(chat.currentMessage.value).toBe('')
    expect(chat.error.value).toBe(null)
  })

  it('should cancel stream for WebSocket', () => {
    const chat = useAIStreamingChat({ transport: 'websocket' })
    
    // Simulate active stream
    chat.isStreaming.value = true

    chat.cancelStream()

    expect(chat.isStreaming.value).toBe(false)
  })

  it('should connect and disconnect WebSocket', async () => {
    const chat = useAIStreamingChat({ transport: 'websocket', autoConnect: false })

    await chat.connect()
    expect(mockSocket.connect).toHaveBeenCalled()

    chat.disconnect()
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should throw error for empty message', async () => {
    const chat = useAIStreamingChat()

    await expect(chat.sendMessage('')).rejects.toThrow('Message content cannot be empty')
    await expect(chat.sendMessage('   ')).rejects.toThrow('Message content cannot be empty')
  })

  it('should handle SSE fetch errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const chat = useAIStreamingChat({ transport: 'sse' })

    await chat.sendMessage('Test message')

    expect(chat.error.value).toBe('Network error')
    expect(chat.isStreaming.value).toBe(false)
  })

  it('should handle SSE HTTP errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    }

    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const chat = useAIStreamingChat({ transport: 'sse' })

    await chat.sendMessage('Test message')

    expect(chat.error.value).toBe('HTTP 500: Internal Server Error')
    expect(chat.isStreaming.value).toBe(false)
  })

  it('should handle WebSocket connection errors', async () => {
    mockSocket.isConnected.value = false

    const chat = useAIStreamingChat({ transport: 'websocket' })

    await expect(chat.sendMessage('Test message')).rejects.toThrow('WebSocket not connected')
  })

  it('should auto-connect WebSocket when enabled', async () => {
    const chat = useAIStreamingChat({ 
      transport: 'websocket', 
      autoConnect: true 
    })

    await nextTick()

    expect(mockSocket.connect).toHaveBeenCalled()
  })

  it('should not auto-connect WebSocket when disabled', async () => {
    const chat = useAIStreamingChat({ 
      transport: 'websocket', 
      autoConnect: false 
    })

    await nextTick()

    expect(mockSocket.connect).not.toHaveBeenCalled()
  })
})