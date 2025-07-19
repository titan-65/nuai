import { ref, computed, watch, nextTick } from 'vue'
import { useRuntimeConfig } from '#app'
import { useAISocket } from './useAISocket'
import type { Message } from '@ai-nuxt/core'

export interface StreamingChatOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  transport?: 'sse' | 'websocket'
  autoConnect?: boolean
}

export interface UseAIStreamingChatReturn {
  // Messages
  messages: Ref<Message[]>
  currentMessage: Ref<string>
  
  // State
  isStreaming: Ref<boolean>
  isConnected: Ref<boolean>
  error: Ref<string | null>
  
  // Methods
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  cancelStream: () => void
  connect: () => Promise<void>
  disconnect: () => void
  
  // WebSocket specific
  reconnectAttempts: Ref<number>
  activeStreams: Ref<Set<string>>
}

export function useAIStreamingChat(options: StreamingChatOptions = {}): UseAIStreamingChatReturn {
  const config = useRuntimeConfig()
  
  // Default options
  const {
    provider,
    model,
    temperature,
    maxTokens,
    systemPrompt,
    transport = config.public?.aiNuxt?.streaming?.transport || 'sse',
    autoConnect = true
  } = options
  
  // State
  const messages = ref<Message[]>([])
  const currentMessage = ref('')
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const currentStreamId = ref<string | null>(null)
  
  // WebSocket instance (only used if transport is websocket)
  const socket = transport === 'websocket' ? useAISocket({\n    autoReconnect: true,\n    maxReconnectAttempts: 5,\n    reconnectDelay: 1000\n  }) : null\n  \n  // Computed properties\n  const isConnected = computed(() => {\n    if (transport === 'websocket') {\n      return socket?.isConnected.value || false\n    }\n    return true // SSE doesn't require persistent connection\n  })\n  \n  const reconnectAttempts = computed(() => {\n    return socket?.reconnectAttempts.value || 0\n  })\n  \n  const activeStreams = computed(() => {\n    return socket?.activeStreams.value || new Set<string>()\n  })\n  \n  // Generate unique message ID\n  function generateMessageId(): string {\n    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`\n  }\n  \n  // Add message to conversation\n  function addMessage(role: 'user' | 'assistant', content: string): Message {\n    const message: Message = {\n      id: generateMessageId(),\n      role,\n      content,\n      timestamp: new Date()\n    }\n    \n    messages.value.push(message)\n    return message\n  }\n  \n  // Send message using WebSocket\n  async function sendMessageViaWebSocket(content: string): Promise<void> {\n    if (!socket) {\n      throw new Error('WebSocket not initialized')\n    }\n    \n    if (!socket.isConnected.value) {\n      throw new Error('WebSocket not connected')\n    }\n    \n    // Add user message\n    addMessage('user', content)\n    \n    // Prepare messages for API\n    const apiMessages = messages.value.map(msg => ({\n      role: msg.role,\n      content: msg.content\n    }))\n    \n    // Add system prompt if provided\n    if (systemPrompt) {\n      apiMessages.unshift({\n        role: 'system',\n        content: systemPrompt\n      })\n    }\n    \n    try {\n      isStreaming.value = true\n      error.value = null\n      currentMessage.value = ''\n      \n      // Send chat request\n      const streamId = await socket.sendChat(apiMessages, {\n        provider,\n        model,\n        temperature,\n        maxTokens\n      })\n      \n      currentStreamId.value = streamId\n      \n    } catch (err: any) {\n      error.value = err.message || 'Failed to send message'\n      isStreaming.value = false\n    }\n  }\n  \n  // Send message using SSE\n  async function sendMessageViaSSE(content: string): Promise<void> {\n    // Add user message\n    addMessage('user', content)\n    \n    // Prepare messages for API\n    const apiMessages = messages.value.map(msg => ({\n      role: msg.role,\n      content: msg.content\n    }))\n    \n    // Add system prompt if provided\n    if (systemPrompt) {\n      apiMessages.unshift({\n        role: 'system',\n        content: systemPrompt\n      })\n    }\n    \n    try {\n      isStreaming.value = true\n      error.value = null\n      currentMessage.value = ''\n      \n      const response = await fetch('/api/ai/stream', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json'\n        },\n        body: JSON.stringify({\n          type: 'chat',\n          messages: apiMessages,\n          provider,\n          model,\n          temperature,\n          maxTokens\n        })\n      })\n      \n      if (!response.ok) {\n        throw new Error(`HTTP ${response.status}: ${response.statusText}`)\n      }\n      \n      const reader = response.body?.getReader()\n      if (!reader) {\n        throw new Error('No response body reader available')\n      }\n      \n      const decoder = new TextDecoder()\n      let buffer = ''\n      \n      while (true) {\n        const { done, value } = await reader.read()\n        \n        if (done) break\n        \n        buffer += decoder.decode(value, { stream: true })\n        const lines = buffer.split('\\n')\n        buffer = lines.pop() || ''\n        \n        for (const line of lines) {\n          if (line.startsWith('data: ')) {\n            const data = line.slice(6)\n            \n            if (data === '[DONE]') {\n              isStreaming.value = false\n              \n              // Add assistant message if we have content\n              if (currentMessage.value.trim()) {\n                addMessage('assistant', currentMessage.value)\n                currentMessage.value = ''\n              }\n              break\n            }\n            \n            try {\n              const chunk = JSON.parse(data)\n              \n              if (chunk.error) {\n                throw new Error(chunk.error)\n              }\n              \n              if (chunk.delta) {\n                currentMessage.value += chunk.delta\n              }\n              \n              if (chunk.finished) {\n                isStreaming.value = false\n                \n                // Add assistant message\n                if (currentMessage.value.trim()) {\n                  addMessage('assistant', currentMessage.value)\n                  currentMessage.value = ''\n                }\n                break\n              }\n            } catch (parseError) {\n              console.error('Failed to parse SSE data:', parseError)\n            }\n          }\n        }\n      }\n      \n    } catch (err: any) {\n      error.value = err.message || 'Failed to send message'\n      isStreaming.value = false\n    }\n  }\n  \n  // Send message (chooses transport method)\n  async function sendMessage(content: string): Promise<void> {\n    if (!content.trim()) {\n      throw new Error('Message content cannot be empty')\n    }\n    \n    if (transport === 'websocket') {\n      await sendMessageViaWebSocket(content)\n    } else {\n      await sendMessageViaSSE(content)\n    }\n  }\n  \n  // Clear all messages\n  function clearMessages(): void {\n    messages.value = []\n    currentMessage.value = ''\n    error.value = null\n  }\n  \n  // Cancel current stream\n  function cancelStream(): void {\n    if (transport === 'websocket' && socket && currentStreamId.value) {\n      socket.cancelStream(currentStreamId.value)\n    }\n    \n    isStreaming.value = false\n    currentStreamId.value = null\n  }\n  \n  // Connect (WebSocket only)\n  async function connect(): Promise<void> {\n    if (transport === 'websocket' && socket) {\n      await socket.connect()\n    }\n  }\n  \n  // Disconnect (WebSocket only)\n  function disconnect(): void {\n    if (transport === 'websocket' && socket) {\n      socket.disconnect()\n    }\n  }\n  \n  // Setup WebSocket event handlers\n  if (transport === 'websocket' && socket) {\n    // Handle chat chunks\n    socket.onChatChunk((chunk, streamId) => {\n      if (streamId === currentStreamId.value) {\n        if (chunk.delta) {\n          currentMessage.value += chunk.delta\n        }\n      }\n    })\n    \n    // Handle stream completion\n    socket.onStreamComplete((data, streamId) => {\n      if (streamId === currentStreamId.value) {\n        isStreaming.value = false\n        \n        // Add assistant message if we have content\n        if (currentMessage.value.trim()) {\n          addMessage('assistant', currentMessage.value)\n          currentMessage.value = ''\n        }\n        \n        currentStreamId.value = null\n      }\n    })\n    \n    // Handle errors\n    socket.onError((errorMessage, streamId) => {\n      if (!streamId || streamId === currentStreamId.value) {\n        error.value = errorMessage\n        isStreaming.value = false\n        currentStreamId.value = null\n      }\n    })\n    \n    // Auto-connect if enabled\n    if (autoConnect) {\n      nextTick(() => {\n        connect()\n      })\n    }\n  }\n  \n  return {\n    // Messages\n    messages,\n    currentMessage,\n    \n    // State\n    isStreaming,\n    isConnected,\n    error,\n    \n    // Methods\n    sendMessage,\n    clearMessages,\n    cancelStream,\n    connect,\n    disconnect,\n    \n    // WebSocket specific\n    reconnectAttempts,\n    activeStreams\n  }\n}