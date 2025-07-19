import { defineWebSocketHandler } from 'h3'
import { useRuntimeConfig } from '#nitro'
import { getProvider, getDefaultProvider } from '@ai-nuxt/core'
import type { ChatOptions, CompletionOptions } from '@ai-nuxt/core'

interface WebSocketMessage {
  id: string
  type: 'chat' | 'completion' | 'ping' | 'pong' | 'error' | 'cancel'
  data?: any
  timestamp: number
}

interface ActiveStream {
  id: string
  type: 'chat' | 'completion'
  controller?: AbortController
  startTime: number
}

// Store active streams per connection
const activeStreams = new Map<string, Map<string, ActiveStream>>()

export default defineWebSocketHandler({
  async open(peer) {
    const config = useRuntimeConfig()
    const connectionId = peer.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Initialize connection streams map
    activeStreams.set(connectionId, new Map())
    
    console.log(`🔌 WebSocket connection opened: ${connectionId}`)
    
    // Send welcome message
    peer.send(JSON.stringify({
      id: 'welcome',
      type: 'system',
      data: {
        message: 'Connected to AI Nuxt WebSocket',
        connectionId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }))
    
    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (peer.readyState === 1) { // WebSocket.OPEN
        peer.send(JSON.stringify({
          id: 'ping',
          type: 'ping',
          timestamp: Date.now()
        }))
      } else {
        clearInterval(pingInterval)
      }
    }, 30000) // Ping every 30 seconds
    
    // Store ping interval for cleanup
    peer.pingInterval = pingInterval
  },

  async message(peer, message) {
    const config = useRuntimeConfig()
    const connectionId = peer.id || 'unknown'
    const connectionStreams = activeStreams.get(connectionId) || new Map()
    
    try {
      const wsMessage: WebSocketMessage = JSON.parse(message.text())
      
      console.log(`📨 WebSocket message received: ${wsMessage.type} (${wsMessage.id})`)
      
      switch (wsMessage.type) {
        case 'ping':
          // Respond to ping with pong
          peer.send(JSON.stringify({
            id: wsMessage.id,
            type: 'pong',
            timestamp: Date.now()
          }))
          break
          
        case 'chat':
          await handleChatStream(peer, wsMessage, connectionStreams, config)
          break
          
        case 'completion':
          await handleCompletionStream(peer, wsMessage, connectionStreams, config)
          break
          
        case 'cancel':
          await handleCancel(peer, wsMessage, connectionStreams)
          break
          
        default:
          peer.send(JSON.stringify({
            id: wsMessage.id,
            type: 'error',
            data: {
              error: `Unknown message type: ${wsMessage.type}`
            },
            timestamp: Date.now()
          }))
      }
    } catch (error: any) {
      console.error('WebSocket message error:', error)
      peer.send(JSON.stringify({
        id: 'error',
        type: 'error',
        data: {
          error: error.message || 'Failed to process message'
        },
        timestamp: Date.now()
      }))
    }
  },

  async close(peer, details) {
    const connectionId = peer.id || 'unknown'
    console.log(`🔌 WebSocket connection closed: ${connectionId}`)
    
    // Clean up ping interval
    if (peer.pingInterval) {
      clearInterval(peer.pingInterval)
    }
    
    // Cancel all active streams for this connection
    const connectionStreams = activeStreams.get(connectionId)
    if (connectionStreams) {
      for (const [streamId, stream] of connectionStreams) {
        if (stream.controller) {
          stream.controller.abort()
        }
      }
      activeStreams.delete(connectionId)
    }
  },

  async error(peer, error) {
    const connectionId = peer.id || 'unknown'
    console.error(`🔌 WebSocket error for ${connectionId}:`, error)
    
    peer.send(JSON.stringify({
      id: 'error',
      type: 'error',
      data: {
        error: 'WebSocket connection error'
      },
      timestamp: Date.now()
    }))
  }
})

async function handleChatStream(
  peer: any,
  wsMessage: WebSocketMessage,
  connectionStreams: Map<string, ActiveStream>,
  config: any
) {
  const { messages, provider: providerId, model, temperature, maxTokens, systemPrompt } = wsMessage.data
  
  // Validate required fields
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: 'Messages array is required and cannot be empty'
      },
      timestamp: Date.now()
    }))
    return
  }
  
  try {
    // Get AI provider
    const aiProvider = providerId ? getProvider(providerId) : getDefaultProvider()
    
    // Create abort controller for cancellation
    const controller = new AbortController()
    
    // Store active stream
    const activeStream: ActiveStream = {
      id: wsMessage.id,
      type: 'chat',
      controller,
      startTime: Date.now()
    }
    connectionStreams.set(wsMessage.id, activeStream)
    
    // Prepare chat options
    const chatOptions: ChatOptions = {
      messages,
      model: model || undefined,
      temperature: temperature || undefined,
      maxTokens: maxTokens || undefined,
      systemPrompt: systemPrompt || undefined,
      stream: true
    }
    
    // Send stream start confirmation
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'stream_start',
      data: {
        provider: aiProvider.id,
        model: model || aiProvider.defaultModel
      },
      timestamp: Date.now()
    }))
    
    let chunkCount = 0
    
    // Stream chat completion
    for await (const chunk of aiProvider.chat.stream(chatOptions)) {
      // Check if stream was cancelled
      if (controller.signal.aborted) {
        break
      }
      
      chunkCount++
      
      // Send chunk to client
      peer.send(JSON.stringify({
        id: wsMessage.id,
        type: 'chat_chunk',
        data: {
          ...chunk,
          chunkIndex: chunkCount,
          provider: aiProvider.id
        },
        timestamp: Date.now()
      }))
      
      if (chunk.finished) {
        break
      }
    }
    
    // Send completion signal
    const duration = Date.now() - activeStream.startTime
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'stream_complete',
      data: {
        totalChunks: chunkCount,
        duration,
        provider: aiProvider.id
      },
      timestamp: Date.now()
    }))
    
    // Clean up
    connectionStreams.delete(wsMessage.id)
    
  } catch (error: any) {
    console.error('Chat stream error:', error)
    
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: error.message || 'Chat stream failed',
        provider: error.provider
      },
      timestamp: Date.now()
    }))
    
    // Clean up
    connectionStreams.delete(wsMessage.id)
  }
}

async function handleCompletionStream(
  peer: any,
  wsMessage: WebSocketMessage,
  connectionStreams: Map<string, ActiveStream>,
  config: any
) {
  const { prompt, provider: providerId, model, temperature, maxTokens } = wsMessage.data
  
  // Validate required fields
  if (!prompt || typeof prompt !== 'string') {
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: 'Prompt is required and must be a string'
      },
      timestamp: Date.now()
    }))
    return
  }
  
  try {
    // Get AI provider
    const aiProvider = providerId ? getProvider(providerId) : getDefaultProvider()
    
    // Create abort controller for cancellation
    const controller = new AbortController()
    
    // Store active stream
    const activeStream: ActiveStream = {
      id: wsMessage.id,
      type: 'completion',
      controller,
      startTime: Date.now()
    }
    connectionStreams.set(wsMessage.id, activeStream)
    
    // Prepare completion options
    const completionOptions: CompletionOptions = {
      prompt,
      model: model || undefined,
      temperature: temperature || undefined,
      maxTokens: maxTokens || undefined,
      stream: true
    }
    
    // Send stream start confirmation
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'stream_start',
      data: {
        provider: aiProvider.id,
        model: model || aiProvider.defaultModel
      },
      timestamp: Date.now()
    }))
    
    let chunkCount = 0
    
    // Stream completion
    for await (const chunk of aiProvider.completion.stream(completionOptions)) {
      // Check if stream was cancelled
      if (controller.signal.aborted) {
        break
      }
      
      chunkCount++
      
      // Send chunk to client
      peer.send(JSON.stringify({
        id: wsMessage.id,
        type: 'completion_chunk',
        data: {
          ...chunk,
          chunkIndex: chunkCount,
          provider: aiProvider.id
        },
        timestamp: Date.now()
      }))
      
      if (chunk.finished) {
        break
      }
    }
    
    // Send completion signal
    const duration = Date.now() - activeStream.startTime
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'stream_complete',
      data: {
        totalChunks: chunkCount,
        duration,
        provider: aiProvider.id
      },
      timestamp: Date.now()
    }))
    
    // Clean up
    connectionStreams.delete(wsMessage.id)
    
  } catch (error: any) {
    console.error('Completion stream error:', error)
    
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: error.message || 'Completion stream failed',
        provider: error.provider
      },
      timestamp: Date.now()
    }))
    
    // Clean up
    connectionStreams.delete(wsMessage.id)
  }
}

async function handleCancel(
  peer: any,
  wsMessage: WebSocketMessage,
  connectionStreams: Map<string, ActiveStream>
) {
  const { streamId } = wsMessage.data
  
  if (!streamId) {
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: 'Stream ID is required for cancellation'
      },
      timestamp: Date.now()
    }))
    return
  }
  
  const activeStream = connectionStreams.get(streamId)
  if (activeStream && activeStream.controller) {
    activeStream.controller.abort()
    connectionStreams.delete(streamId)
    
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'stream_cancelled',
      data: {
        streamId,
        duration: Date.now() - activeStream.startTime
      },
      timestamp: Date.now()
    }))
  } else {
    peer.send(JSON.stringify({
      id: wsMessage.id,
      type: 'error',
      data: {
        error: `No active stream found with ID: ${streamId}`
      },
      timestamp: Date.now()
    }))
  }
}