import { ref, computed, watch, nextTick } from 'vue'
import { useAI } from './useAI'
import type { Message, ChatOptions, TokenUsage } from '@ai-nuxt/core'

export interface UseAIChatOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  initialMessages?: Message[]
  persistenceKey?: string
  maxMessages?: number
  autoSave?: boolean
  contextWindow?: number
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: Error | null
  usage: TokenUsage | null
  totalCost: number
  conversationId: string
}

export interface MessageMetadata {
  tokens?: number
  model?: string
  provider?: string
  cost?: number
  latency?: number
  retryCount?: number
  timestamp?: Date
}

/**
 * Enhanced composable for managing AI chat conversations with persistence and advanced features
 */
export function useAIChat(options: UseAIChatOptions = {}) {
  const ai = useAI({ provider: options.provider })
  
  // Generate conversation ID
  const conversationId = generateId()
  
  // Reactive state
  const state = ref<ChatState>({
    messages: options.initialMessages || [],
    isLoading: false,
    isStreaming: false,
    error: null,
    usage: null,
    totalCost: 0,
    conversationId
  })
  
  // Message history management
  const messageHistory = ref<Message[][]>([])
  const currentHistoryIndex = ref(-1)
  
  // Computed properties
  const messages = computed(() => state.value.messages)
  
  const lastMessage = computed(() => {
    const msgs = state.value.messages
    return msgs.length > 0 ? msgs[msgs.length - 1] : null
  })
  
  const lastUserMessage = computed(() => {
    return [...state.value.messages]
      .reverse()
      .find(m => m.role === 'user') || null
  })
  
  const lastAssistantMessage = computed(() => {
    return [...state.value.messages]
      .reverse()
      .find(m => m.role === 'assistant') || null
  })
  
  const conversationLength = computed(() => state.value.messages.length)
  
  const totalTokens = computed(() => {
    return state.value.messages.reduce((total, msg) => {
      return total + (msg.metadata?.tokens || 0)
    }, 0)
  })
  
  const conversationSummary = computed(() => {
    const msgs = state.value.messages
    const userMsgCount = msgs.filter(m => m.role === 'user').length
    const assistantMsgCount = msgs.filter(m => m.role === 'assistant').length
    
    return {
      totalMessages: msgs.length,
      userMessages: userMsgCount,
      assistantMessages: assistantMsgCount,
      totalTokens: totalTokens.value,
      totalCost: state.value.totalCost,
      duration: msgs.length > 0 ? 
        new Date().getTime() - msgs[0].timestamp.getTime() : 0
    }
  })
  
  const contextMessages = computed(() => {
    if (!options.contextWindow) return state.value.messages
    
    // Keep system messages and last N messages within context window
    const systemMessages = state.value.messages.filter(m => m.role === 'system')
    const otherMessages = state.value.messages.filter(m => m.role !== 'system')
    
    const contextMessages = otherMessages.slice(-options.contextWindow)
    return [...systemMessages, ...contextMessages]
  })
  
  // Persistence
  const saveToStorage = () => {
    if (!options.persistenceKey || typeof window === 'undefined') return
    
    try {
      const data = {
        messages: state.value.messages,
        conversationId: state.value.conversationId,
        totalCost: state.value.totalCost,
        timestamp: new Date().toISOString()
      }
      
      localStorage.setItem(`ai-chat-${options.persistenceKey}`, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save chat to localStorage:', error)
    }
  }
  
  const loadFromStorage = () => {
    if (!options.persistenceKey || typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(`ai-chat-${options.persistenceKey}`)
      if (stored) {
        const data = JSON.parse(stored)
        state.value.messages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        state.value.totalCost = data.totalCost || 0
      }
    } catch (error) {
      console.warn('Failed to load chat from localStorage:', error)
    }
  }
  
  // Auto-save functionality
  if (options.autoSave !== false) {
    watch(
      () => state.value.messages,
      () => saveToStorage(),
      { deep: true }
    )
  }
  
  // Message management methods
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
      metadata: {
        ...message.metadata,
        timestamp: new Date()
      }
    }
    
    state.value.messages.push(newMessage)
    
    // Enforce max messages limit
    if (options.maxMessages && state.value.messages.length > options.maxMessages) {
      // Keep system messages and remove oldest non-system messages
      const systemMessages = state.value.messages.filter(m => m.role === 'system')
      const otherMessages = state.value.messages.filter(m => m.role !== 'system')
      const keepMessages = otherMessages.slice(-(options.maxMessages - systemMessages.length))
      state.value.messages = [...systemMessages, ...keepMessages]
    }
    
    return newMessage
  }
  
  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    const messageIndex = state.value.messages.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      state.value.messages[messageIndex] = {
        ...state.value.messages[messageIndex],
        ...updates,
        metadata: {
          ...state.value.messages[messageIndex].metadata,
          ...updates.metadata
        }
      }
    }
  }
  
  const removeMessage = (messageId: string) => {
    const index = state.value.messages.findIndex(m => m.id === messageId)
    if (index !== -1) {
      state.value.messages.splice(index, 1)
    }
  }
  
  const editMessage = (messageId: string, newContent: string) => {
    updateMessage(messageId, { content: newContent })
  }
  
  const insertMessage = (message: Omit<Message, 'id' | 'timestamp'>, index: number) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date()
    }
    
    state.value.messages.splice(index, 0, newMessage)
    return newMessage
  }
  
  // History management
  const saveToHistory = () => {
    messageHistory.value.push([...state.value.messages])
    currentHistoryIndex.value = messageHistory.value.length - 1
    
    // Limit history size
    if (messageHistory.value.length > 50) {
      messageHistory.value.shift()
      currentHistoryIndex.value--
    }
  }
  
  const undo = () => {
    if (currentHistoryIndex.value > 0) {
      currentHistoryIndex.value--
      state.value.messages = [...messageHistory.value[currentHistoryIndex.value]]
    }
  }
  
  const redo = () => {
    if (currentHistoryIndex.value < messageHistory.value.length - 1) {
      currentHistoryIndex.value++
      state.value.messages = [...messageHistory.value[currentHistoryIndex.value]]
    }
  }
  
  const canUndo = computed(() => currentHistoryIndex.value > 0)
  const canRedo = computed(() => currentHistoryIndex.value < messageHistory.value.length - 1)
  
  // Core chat methods
  const send = async (content: string, chatOptions?: Partial<ChatOptions>) => {
    if (state.value.isLoading) {
      throw new Error('Chat is already processing a message')
    }
    
    saveToHistory()
    state.value.isLoading = true
    state.value.error = null
    
    const startTime = Date.now()
    
    try {
      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content
      })
      
      // Prepare chat options with context window
      const requestOptions: ChatOptions = {
        messages: contextMessages.value,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        ...chatOptions
      }
      
      // Send to AI
      const response = await ai.chat.create(requestOptions)
      const latency = Date.now() - startTime
      
      // Calculate cost (rough estimation)
      const cost = estimateCost(response.usage, response.model, response.provider)
      
      // Add assistant response
      const assistantMessage = addMessage({
        role: 'assistant',
        content: response.message.content,
        metadata: {
          ...response.message.metadata,
          latency,
          cost
        }
      })
      
      state.value.usage = response.usage
      state.value.totalCost += cost
      
      return {
        userMessage,
        assistantMessage,
        response,
        latency
      }
    } catch (err) {
      state.value.error = err as Error
      throw err
    } finally {
      state.value.isLoading = false
    }
  }
  
  const stream = async (content: string, chatOptions?: Partial<ChatOptions>) => {
    if (state.value.isLoading || state.value.isStreaming) {
      throw new Error('Chat is already processing a message')
    }
    
    saveToHistory()
    state.value.isStreaming = true
    state.value.error = null
    
    const startTime = Date.now()
    
    try {
      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content
      })
      
      // Add placeholder assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        content: ''
      })
      
      // Prepare chat options with context window
      const requestOptions: ChatOptions = {
        messages: contextMessages.value.slice(0, -1), // Exclude placeholder
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        ...chatOptions
      }
      
      // Stream response
      let fullContent = ''
      let chunkCount = 0
      
      for await (const chunk of ai.chat.stream(requestOptions)) {
        if (!chunk.finished) {
          fullContent += chunk.delta
          chunkCount++
          
          // Update the assistant message in place
          updateMessage(assistantMessage.id, {
            content: fullContent,
            metadata: {
              ...assistantMessage.metadata,
              chunkCount,
              isStreaming: true
            }
          })
          
          // Allow Vue to update the DOM
          await nextTick()
        }
      }
      
      const latency = Date.now() - startTime
      
      // Finalize the assistant message
      updateMessage(assistantMessage.id, {
        metadata: {
          ...assistantMessage.metadata,
          latency,
          isStreaming: false,
          chunkCount
        }
      })
      
      return {
        userMessage,
        assistantMessage,
        content: fullContent,
        latency,
        chunkCount
      }
    } catch (err) {
      state.value.error = err as Error
      throw err
    } finally {
      state.value.isStreaming = false
    }
  }
  
  const retry = async (messageId?: string) => {
    const targetMessage = messageId 
      ? state.value.messages.find(m => m.id === messageId)
      : lastUserMessage.value
    
    if (!targetMessage || targetMessage.role !== 'user') {
      throw new Error('No user message found to retry')
    }
    
    // Remove messages after the target message
    const targetIndex = state.value.messages.findIndex(m => m.id === targetMessage.id)
    if (targetIndex !== -1) {
      state.value.messages = state.value.messages.slice(0, targetIndex + 1)
    }
    
    // Update retry count
    const retryCount = (targetMessage.metadata?.retryCount || 0) + 1
    updateMessage(targetMessage.id, {
      metadata: {
        ...targetMessage.metadata,
        retryCount
      }
    })
    
    return send(targetMessage.content)
  }
  
  const regenerate = async () => {
    if (!lastAssistantMessage.value) {
      throw new Error('No assistant message to regenerate')
    }
    
    // Remove the last assistant message
    removeMessage(lastAssistantMessage.value.id)
    
    // Retry the last user message
    return retry()
  }
  
  const clear = () => {
    saveToHistory()
    state.value.messages = []
    state.value.error = null
    state.value.usage = null
    state.value.totalCost = 0
  }
  
  const exportConversation = (format: 'json' | 'markdown' | 'text' = 'json') => {
    switch (format) {
      case 'json':
        return JSON.stringify({
          conversationId: state.value.conversationId,
          messages: state.value.messages,
          summary: conversationSummary.value,
          exportedAt: new Date().toISOString()
        }, null, 2)
      
      case 'markdown':
        return state.value.messages
          .map(msg => {
            const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
            return `## ${role}\n\n${msg.content}\n`
          })
          .join('\n')
      
      case 'text':
        return state.value.messages
          .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join('\n\n')
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  const importConversation = (data: string, format: 'json' = 'json') => {
    try {
      if (format === 'json') {
        const parsed = JSON.parse(data)
        if (parsed.messages && Array.isArray(parsed.messages)) {
          state.value.messages = parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          state.value.totalCost = parsed.summary?.totalCost || 0
        }
      }
    } catch (error) {
      throw new Error(`Failed to import conversation: ${error}`)
    }
  }
  
  // Initialize
  if (options.persistenceKey) {
    loadFromStorage()
  }
  
  // Save initial state to history
  saveToHistory()
  
  return {
    // State
    state: readonly(state),
    messages,
    isLoading: computed(() => state.value.isLoading),
    isStreaming: computed(() => state.value.isStreaming),
    error: computed(() => state.value.error),
    usage: computed(() => state.value.usage),
    
    // Computed
    lastMessage,
    lastUserMessage,
    lastAssistantMessage,
    conversationLength,
    totalTokens,
    conversationSummary,
    contextMessages,
    
    // History
    canUndo,
    canRedo,
    
    // Methods
    send,
    stream,
    retry,
    regenerate,
    clear,
    addMessage,
    updateMessage,
    removeMessage,
    editMessage,
    insertMessage,
    undo,
    redo,
    saveToStorage,
    loadFromStorage,
    exportConversation,
    importConversation
  }
}

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function estimateCost(usage: TokenUsage, model: string, provider: string): number {
  // Rough cost estimation - in a real app, this would be more sophisticated
  const rates = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 }
  }
  
  const rate = rates[model as keyof typeof rates] || { input: 0.001, output: 0.002 }
  
  return (usage.promptTokens * rate.input + usage.completionTokens * rate.output) / 1000
}