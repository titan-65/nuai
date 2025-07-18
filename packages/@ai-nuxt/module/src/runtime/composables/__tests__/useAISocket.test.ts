import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useAISocket } from '../useAISocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 10)
  }

  send(data: string) {
    // Mock sending data
    console.log('Mock WebSocket send:', data)
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }))
    }
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  // Helper method to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any

// Mock window.location for WebSocket URL generation
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:3000'
  },
  writable: true
})

// Mock useRuntimeConfig
vi.mock('#app', () => ({
  useRuntimeConfig: () => ({
    public: {
      aiNuxt: {
        streaming: {
          enabled: true,
          transport: 'websocket'
        }
      }
    }
  })
}))

describe('useAISocket', () => {
  let mockSocket: MockWebSocket

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset WebSocket mock
    vi.spyOn(global, 'WebSocket').mockImplementation((url: string) => {
      mockSocket = new MockWebSocket(url)
      return mockSocket as any
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with correct default state', () => {
    const socket = useAISocket()

    expect(socket.isConnected.value).toBe(false)
    expect(socket.isConnecting.value).toBe(false)
    expect(socket.connectionError.value).toBe(null)
    expect(socket.reconnectAttempts.value).toBe(0)
    expect(socket.activeStreams.value.size).toBe(0)
  })

  it('should connect to WebSocket successfully', async () => {
    const socket = useAISocket()

    await socket.connect()
    await nextTick()

    expect(socket.isConnecting.value).toBe(true)

    // Wait for connection to open
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(socket.isConnected.value).toBe(true)
    expect(socket.isConnecting.value).toBe(false)
    expect(socket.connectionError.value).toBe(null)
  })

  it('should handle connection errors', async () => {
    const socket = useAISocket()
    const errorHandler = vi.fn()
    socket.onError(errorHandler)

    await socket.connect()
    await nextTick()

    // Simulate connection error
    mockSocket.simulateError()

    expect(socket.connectionError.value).toBe('WebSocket connection error')
    expect(errorHandler).toHaveBeenCalledWith('WebSocket connection error')
  })

  it('should send chat messages', async () => {
    const socket = useAISocket()
    const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send')

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const messages = [
      { role: 'user', content: 'Hello' }
    ]

    const streamId = await socket.sendChat(messages, {
      provider: 'openai',
      temperature: 0.7
    })

    expect(sendSpy).toHaveBeenCalled()
    expect(socket.activeStreams.value.has(streamId)).toBe(true)

    const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
    expect(sentMessage.type).toBe('chat')
    expect(sentMessage.data.messages).toEqual(messages)
    expect(sentMessage.data.provider).toBe('openai')
    expect(sentMessage.data.temperature).toBe(0.7)
  })

  it('should send completion requests', async () => {
    const socket = useAISocket()
    const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send')

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const prompt = 'Complete this sentence'
    const streamId = await socket.sendCompletion(prompt, {
      model: 'gpt-4',
      maxTokens: 100
    })

    expect(sendSpy).toHaveBeenCalled()
    expect(socket.activeStreams.value.has(streamId)).toBe(true)

    const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
    expect(sentMessage.type).toBe('completion')
    expect(sentMessage.data.prompt).toBe(prompt)
    expect(sentMessage.data.model).toBe('gpt-4')
    expect(sentMessage.data.maxTokens).toBe(100)
  })

  it('should handle chat chunk responses', async () => {
    const socket = useAISocket()
    const chunkHandler = vi.fn()
    socket.onChatChunk(chunkHandler)

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const streamId = 'test-stream-id'
    const chunkData = {
      content: 'Hello',
      delta: 'Hello',
      finished: false,
      chunkIndex: 1,
      provider: 'openai'
    }

    // Simulate receiving a chat chunk
    mockSocket.simulateMessage({
      id: streamId,
      type: 'chat_chunk',
      data: chunkData,
      timestamp: Date.now()
    })

    expect(chunkHandler).toHaveBeenCalledWith(chunkData, streamId)
  })

  it('should handle completion chunk responses', async () => {
    const socket = useAISocket()
    const chunkHandler = vi.fn()
    socket.onCompletionChunk(chunkHandler)

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const streamId = 'test-stream-id'
    const chunkData = {
      text: 'Hello',
      delta: 'Hello',
      finished: false,
      chunkIndex: 1,
      provider: 'openai'
    }

    // Simulate receiving a completion chunk
    mockSocket.simulateMessage({
      id: streamId,
      type: 'completion_chunk',
      data: chunkData,
      timestamp: Date.now()
    })

    expect(chunkHandler).toHaveBeenCalledWith(chunkData, streamId)
  })

  it('should handle stream completion', async () => {
    const socket = useAISocket()
    const completeHandler = vi.fn()
    socket.onStreamComplete(completeHandler)

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const streamId = 'test-stream-id'
    socket.activeStreams.value.add(streamId)

    const completeData = {
      totalChunks: 5,
      duration: 1000,
      provider: 'openai'
    }

    // Simulate stream completion
    mockSocket.simulateMessage({
      id: streamId,
      type: 'stream_complete',
      data: completeData,
      timestamp: Date.now()
    })

    expect(completeHandler).toHaveBeenCalledWith(completeData, streamId)
    expect(socket.activeStreams.value.has(streamId)).toBe(false)
  })

  it('should cancel active streams', async () => {
    const socket = useAISocket()
    const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send')

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    const streamId = 'test-stream-id'
    socket.cancelStream(streamId)

    expect(sendSpy).toHaveBeenCalled()
    const sentMessage = JSON.parse(sendSpy.mock.calls[0][0])
    expect(sentMessage.type).toBe('cancel')
    expect(sentMessage.data.streamId).toBe(streamId)
  })

  it('should handle disconnection and cleanup', async () => {
    const socket = useAISocket()

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    // Add some active streams
    socket.activeStreams.value.add('stream1')
    socket.activeStreams.value.add('stream2')

    socket.disconnect()

    expect(socket.isConnected.value).toBe(false)
    expect(socket.isConnecting.value).toBe(false)
    expect(socket.activeStreams.value.size).toBe(0)
  })

  it('should attempt reconnection on connection loss', async () => {
    const socket = useAISocket({
      autoReconnect: true,
      maxReconnectAttempts: 2,
      reconnectDelay: 100
    })

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(socket.isConnected.value).toBe(true)

    // Simulate connection loss
    mockSocket.close(1006, 'Connection lost')

    expect(socket.isConnected.value).toBe(false)
    expect(socket.reconnectAttempts.value).toBe(0)

    // Wait for reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(socket.reconnectAttempts.value).toBe(1)
  })

  it('should stop reconnecting after max attempts', async () => {
    const socket = useAISocket({
      autoReconnect: true,
      maxReconnectAttempts: 1,
      reconnectDelay: 50
    })

    // Mock WebSocket to always fail
    vi.spyOn(global, 'WebSocket').mockImplementation(() => {
      const ws = new MockWebSocket('ws://test')
      setTimeout(() => ws.simulateError(), 10)
      return ws as any
    })

    await socket.connect()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(socket.reconnectAttempts.value).toBe(1)
    expect(socket.connectionError.value).toBe('Maximum reconnection attempts reached')
  })

  it('should throw error when sending without connection', async () => {
    const socket = useAISocket()

    expect(() => socket.sendChat([])).toThrow('WebSocket is not connected')
    expect(() => socket.sendCompletion('test')).toThrow('WebSocket is not connected')
    expect(() => socket.cancelStream('test')).toThrow('WebSocket is not connected')
  })
})