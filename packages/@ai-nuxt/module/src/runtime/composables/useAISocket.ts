import { ref, computed, onUnmounted, nextTick } from 'vue'
import { useRuntimeConfig } from '#app'

export interface WebSocketMessage {
  id: string
  type: 'chat' | 'completion' | 'ping' | 'pong' | 'error' | 'cancel' | 'system'
  data?: any
  timestamp: number
}

export interface WebSocketResponse {
  id: string
  type: 'chat_chunk' | 'completion_chunk' | 'stream_start' | 'stream_complete' | 'stream_cancelled' | 'error' | 'pong' | 'system'
  data?: any
  timestamp: number
}

export interface StreamOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface ConnectionOptions {
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
  pingInterval?: number
}

export interface UseAISocketReturn {
  // Connection state
  isConnected: Ref<boolean>
  isConnecting: Ref<boolean>
  connectionError: Ref<string | null>
  reconnectAttempts: Ref<number>
  
  // Stream state
  activeStreams: Ref<Set<string>>
  
  // Methods
  connect: () => Promise<void>
  disconnect: () => void
  sendChat: (messages: any[], options?: StreamOptions) => Promise<string>
  sendCompletion: (prompt: string, options?: StreamOptions) => Promise<string>
  cancelStream: (streamId: string) => void
  
  // Event handlers
  onMessage: (handler: (response: WebSocketResponse) => void) => void
  onChatChunk: (handler: (chunk: any, streamId: string) => void) => void
  onCompletionChunk: (handler: (chunk: any, streamId: string) => void) => void
  onStreamComplete: (handler: (data: any, streamId: string) => void) => void
  onError: (handler: (error: string, streamId?: string) => void) => void
}

export function useAISocket(options: ConnectionOptions = {}): UseAISocketReturn {
  const config = useRuntimeConfig()
  
  // Default options
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    pingInterval = 30000
  } = options
  
  // State
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const connectionError = ref<string | null>(null)
  const reconnectAttempts = ref(0)
  const activeStreams = ref(new Set<string>())
  
  // Event handlers
  const messageHandlers = ref<((response: WebSocketResponse) => void)[]>([])
  const chatChunkHandlers = ref<((chunk: any, streamId: string) => void)[]>([])
  const completionChunkHandlers = ref<((chunk: any, streamId: string) => void)[]>([])
  const streamCompleteHandlers = ref<((data: any, streamId: string) => void)[]>([])
  const errorHandlers = ref<((error: string, streamId?: string) => void)[]>([])
  
  // Timers
  let reconnectTimer: NodeJS.Timeout | null = null
  let pingTimer: NodeJS.Timeout | null = null
  
  // Generate unique message ID
  function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  // Get WebSocket URL
  function getWebSocketUrl(): string {
    if (process.client) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      return `${protocol}//${host}/api/ai/ws`
    }
    return 'ws://localhost:3000/api/ai/ws'
  }
  
  // Connect to WebSocket
  async function connect(): Promise<void> {
    if (isConnecting.value || isConnected.value) {
      return
    }
    
    isConnecting.value = true
    connectionError.value = null
    
    try {
      const wsUrl = getWebSocketUrl()
      socket.value = new WebSocket(wsUrl)
      
      socket.value.onopen = () => {
        console.log('🔌 WebSocket connected')
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts.value = 0
        connectionError.value = null
        
        // Start ping timer
        startPingTimer()
      }
      
      socket.value.onmessage = (event) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data)
          handleMessage(response)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      socket.value.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        isConnected.value = false
        isConnecting.value = false
        
        // Clear timers
        clearPingTimer()
        
        // Clear active streams
        activeStreams.value.clear()
        
        // Attempt reconnection if enabled
        if (autoReconnect && reconnectAttempts.value < maxReconnectAttempts) {
          scheduleReconnect()
        } else if (reconnectAttempts.value >= maxReconnectAttempts) {
          connectionError.value = 'Maximum reconnection attempts reached'
        }
      }
      
      socket.value.onerror = (error) => {
        console.error('🔌 WebSocket error:', error)
        connectionError.value = 'WebSocket connection error'
        isConnecting.value = false
        
        // Trigger error handlers
        errorHandlers.value.forEach(handler => {
          try {
            handler('WebSocket connection error')
          } catch (err) {
            console.error('Error handler failed:', err)
          }
        })
      }
      
    } catch (error: any) {
      console.error('Failed to create WebSocket connection:', error)
      connectionError.value = error.message || 'Failed to connect'
      isConnecting.value = false
    }
  }
  
  // Disconnect from WebSocket
  function disconnect(): void {
    if (socket.value) {
      socket.value.close(1000, 'Client disconnect')
      socket.value = null
    }
    
    // Clear timers
    clearReconnectTimer()
    clearPingTimer()
    
    // Reset state
    isConnected.value = false
    isConnecting.value = false
    connectionError.value = null
    reconnectAttempts.value = 0
    activeStreams.value.clear()
  }
  
  // Schedule reconnection
  function scheduleReconnect(): void {
    if (reconnectTimer) return
    
    reconnectAttempts.value++
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts.value - 1) // Exponential backoff
    
    console.log(`🔌 Scheduling reconnection attempt ${reconnectAttempts.value} in ${delay}ms`)
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }
  
  // Clear reconnect timer
  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
  
  // Start ping timer
  function startPingTimer(): void {
    if (pingTimer) return
    
    pingTimer = setInterval(() => {
      if (isConnected.value && socket.value) {
        sendMessage({\n          id: generateMessageId(),\n          type: 'ping',\n          timestamp: Date.now()\n        })\n      }\n    }, pingInterval)\n  }\n  \n  // Clear ping timer\n  function clearPingTimer(): void {\n    if (pingTimer) {\n      clearInterval(pingTimer)\n      pingTimer = null\n    }\n  }\n  \n  // Send message to WebSocket\n  function sendMessage(message: WebSocketMessage): void {\n    if (!isConnected.value || !socket.value) {\n      throw new Error('WebSocket is not connected')\n    }\n    \n    socket.value.send(JSON.stringify(message))\n  }\n  \n  // Handle incoming messages\n  function handleMessage(response: WebSocketResponse): void {\n    // Call general message handlers\n    messageHandlers.value.forEach(handler => {\n      try {\n        handler(response)\n      } catch (error) {\n        console.error('Message handler failed:', error)\n      }\n    })\n    \n    // Handle specific message types\n    switch (response.type) {\n      case 'chat_chunk':\n        chatChunkHandlers.value.forEach(handler => {\n          try {\n            handler(response.data, response.id)\n          } catch (error) {\n            console.error('Chat chunk handler failed:', error)\n          }\n        })\n        break\n        \n      case 'completion_chunk':\n        completionChunkHandlers.value.forEach(handler => {\n          try {\n            handler(response.data, response.id)\n          } catch (error) {\n            console.error('Completion chunk handler failed:', error)\n          }\n        })\n        break\n        \n      case 'stream_complete':\n        activeStreams.value.delete(response.id)\n        streamCompleteHandlers.value.forEach(handler => {\n          try {\n            handler(response.data, response.id)\n          } catch (error) {\n            console.error('Stream complete handler failed:', error)\n          }\n        })\n        break\n        \n      case 'stream_cancelled':\n        activeStreams.value.delete(response.id)\n        break\n        \n      case 'error':\n        if (response.id && response.id !== 'error') {\n          activeStreams.value.delete(response.id)\n        }\n        errorHandlers.value.forEach(handler => {\n          try {\n            handler(response.data?.error || 'Unknown error', response.id)\n          } catch (error) {\n            console.error('Error handler failed:', error)\n          }\n        })\n        break\n        \n      case 'pong':\n        // Handle pong response (connection is alive)\n        break\n        \n      case 'system':\n        console.log('🔌 System message:', response.data)\n        break\n    }\n  }\n  \n  // Send chat request\n  async function sendChat(messages: any[], options: StreamOptions = {}): Promise<string> {\n    if (!isConnected.value) {\n      throw new Error('WebSocket is not connected')\n    }\n    \n    const messageId = generateMessageId()\n    activeStreams.value.add(messageId)\n    \n    const message: WebSocketMessage = {\n      id: messageId,\n      type: 'chat',\n      data: {\n        messages,\n        ...options\n      },\n      timestamp: Date.now()\n    }\n    \n    sendMessage(message)\n    return messageId\n  }\n  \n  // Send completion request\n  async function sendCompletion(prompt: string, options: StreamOptions = {}): Promise<string> {\n    if (!isConnected.value) {\n      throw new Error('WebSocket is not connected')\n    }\n    \n    const messageId = generateMessageId()\n    activeStreams.value.add(messageId)\n    \n    const message: WebSocketMessage = {\n      id: messageId,\n      type: 'completion',\n      data: {\n        prompt,\n        ...options\n      },\n      timestamp: Date.now()\n    }\n    \n    sendMessage(message)\n    return messageId\n  }\n  \n  // Cancel active stream\n  function cancelStream(streamId: string): void {\n    if (!isConnected.value) {\n      throw new Error('WebSocket is not connected')\n    }\n    \n    const message: WebSocketMessage = {\n      id: generateMessageId(),\n      type: 'cancel',\n      data: {\n        streamId\n      },\n      timestamp: Date.now()\n    }\n    \n    sendMessage(message)\n  }\n  \n  // Event handler registration methods\n  function onMessage(handler: (response: WebSocketResponse) => void): void {\n    messageHandlers.value.push(handler)\n  }\n  \n  function onChatChunk(handler: (chunk: any, streamId: string) => void): void {\n    chatChunkHandlers.value.push(handler)\n  }\n  \n  function onCompletionChunk(handler: (chunk: any, streamId: string) => void): void {\n    completionChunkHandlers.value.push(handler)\n  }\n  \n  function onStreamComplete(handler: (data: any, streamId: string) => void): void {\n    streamCompleteHandlers.value.push(handler)\n  }\n  \n  function onError(handler: (error: string, streamId?: string) => void): void {\n    errorHandlers.value.push(handler)\n  }\n  \n  // Auto-connect on client side\n  if (process.client) {\n    nextTick(() => {\n      connect()\n    })\n  }\n  \n  // Cleanup on unmount\n  onUnmounted(() => {\n    disconnect()\n  })\n  \n  return {\n    // State\n    isConnected,\n    isConnecting,\n    connectionError,\n    reconnectAttempts,\n    activeStreams,\n    \n    // Methods\n    connect,\n    disconnect,\n    sendChat,\n    sendCompletion,\n    cancelStream,\n    \n    // Event handlers\n    onMessage,\n    onChatChunk,\n    onCompletionChunk,\n    onStreamComplete,\n    onError\n  }\n}