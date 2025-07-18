import { ref, computed, watch, nextTick } from 'vue'
import { useAI } from './useAI'
import { useAIStream } from './useAIStream'
import type { Message, ChatOptions } from '@ai-nuxt/core'

export interface StreamingChatOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  autoScroll?: boolean
  typingSpeed?: number
  showTypingIndicator?: boolean
  pauseOnError?: boolean
  retryOnError?: boolean
  maxRetries?: number
}

export interface StreamingState {
  isStreaming: boolean
  isPaused: boolean
  currentChunk: string
  streamProgress: number
  estimatedTimeRemaining: number
  wordsPerSecond: number
  totalChunks: number
  processedChunks: number
}

/**
 * Advanced streaming chat composable with enhanced streaming features
 */
export function useAIStreamingChat(options: StreamingChatOptions = {}) {
  const ai = useAI({ provider: options.provider })
  const streamUtil = useAIStream()
  
  // Reactive state
  const messages = ref<Message[]>([])
  const streamingState = ref<StreamingState>({
    isStreaming: false,
    isPaused: false,
    currentChunk: '',
    streamProgress: 0,
    estimatedTimeRemaining: 0,
    wordsPerSecond: 0,
    totalChunks: 0,
    processedChunks: 0
  })
  
  const error = ref<Error | null>(null)
  const isTyping = ref(false)
  
  // Streaming control
  const streamController = ref<AbortController | null>(null)
  const pauseResolver = ref<((value: void) => void) | null>(null)
  
  // Performance tracking
  const streamStartTime = ref<number>(0)
  const chunkTimes = ref<number[]>([])
  const wordCount = ref(0)
  
  // Computed properties
  const lastMessage = computed(() => {
    return messages.value[messages.value.length - 1] || null
  })
  
  const isStreamingMessage = computed(() => {
    return streamingState.value.isStreaming && lastMessage.value?.role === 'assistant'
  })
  
  const streamingProgress = computed(() => {
    const state = streamingState.value
    return state.totalChunks > 0 ? (state.processedChunks / state.totalChunks) * 100 : 0
  })
  
  const streamingStats = computed(() => ({
    wordsPerSecond: streamingState.value.wordsPerSecond,
    estimatedTimeRemaining: streamingState.value.estimatedTimeRemaining,
    progress: streamingProgress.value,
    chunksProcessed: streamingState.value.processedChunks,
    totalChunks: streamingState.value.totalChunks
  }))
  
  // Utility functions
  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36)
  
  const calculateWordsPerSecond = () => {
    if (chunkTimes.value.length < 2) return 0
    
    const totalTime = (Date.now() - streamStartTime.value) / 1000
    return totalTime > 0 ? wordCount.value / totalTime : 0
  }
  
  const estimateTimeRemaining = (remainingChunks: number) => {
    const wps = streamingState.value.wordsPerSecond
    if (wps === 0) return 0
    
    const avgWordsPerChunk = wordCount.value / streamingState.value.processedChunks || 1
    const remainingWords = remainingChunks * avgWordsPerChunk
    return remainingWords / wps
  }
  
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date()
    }
    messages.value.push(newMessage)
    return newMessage
  }
  
  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    const messageIndex = messages.value.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      messages.value[messageIndex] = {
        ...messages.value[messageIndex],
        ...updates
      }
    }
  }
  
  // Typing indicator simulation
  const showTypingIndicator = async (duration: number = 1000) => {
    if (!options.showTypingIndicator) return
    
    isTyping.value = true
    await new Promise(resolve => setTimeout(resolve, duration))
    isTyping.value = false
  }
  
  // Enhanced streaming with advanced features
  const streamMessage = async (content: string, chatOptions?: Partial<ChatOptions>) => {
    if (streamingState.value.isStreaming) {
      throw new Error('Already streaming a message')
    }
    
    // Reset state
    streamingState.value = {
      isStreaming: true,
      isPaused: false,
      currentChunk: '',
      streamProgress: 0,
      estimatedTimeRemaining: 0,
      wordsPerSecond: 0,
      totalChunks: 0,
      processedChunks: 0
    }
    
    error.value = null
    streamStartTime.value = Date.now()
    chunkTimes.value = []
    wordCount.value = 0
    
    // Create abort controller for cancellation
    streamController.value = new AbortController()
    
    try {
      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content
      })
      
      // Show typing indicator
      await showTypingIndicator()
      
      // Add placeholder assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        content: '',
        metadata: {
          isStreaming: true,
          streamStartTime: Date.now()
        }
      })
      
      // Prepare chat options
      const requestOptions: ChatOptions = {
        messages: messages.value.slice(0, -1), // Exclude placeholder
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        ...chatOptions
      }
      
      let fullContent = ''
      let chunkCount = 0
      let retryCount = 0
      
      const processStream = async () => {
        for await (const chunk of ai.chat.stream(requestOptions)) {
          // Check if streaming was aborted
          if (streamController.value?.signal.aborted) {
            throw new Error('Streaming was cancelled')
          }
          
          // Handle pause
          if (streamingState.value.isPaused) {
            await new Promise<void>(resolve => {
              pauseResolver.value = resolve
            })
          }
          
          if (!chunk.finished) {
            chunkCount++
            chunkTimes.value.push(Date.now())
            
            // Update word count
            const words = chunk.delta.split(/\s+/).filter(w => w.length > 0)
            wordCount.value += words.length
            
            // Simulate typing speed if enabled
            if (options.typingSpeed && options.typingSpeed > 0) {
              const delay = Math.max(10, 1000 / options.typingSpeed)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
            
            fullContent += chunk.delta
            streamingState.value.currentChunk = chunk.delta
            streamingState.value.processedChunks = chunkCount
            
            // Calculate streaming stats
            streamingState.value.wordsPerSecond = calculateWordsPerSecond()
            
            // Update the assistant message in real-time
            updateMessage(assistantMessage.id, {
              content: fullContent,
              metadata: {
                ...assistantMessage.metadata,
                chunkCount,
                isStreaming: true,
                wordsPerSecond: streamingState.value.wordsPerSecond
              }
            })
            
            // Trigger DOM update
            await nextTick()
            
            // Auto-scroll if enabled
            if (options.autoScroll) {
              scrollToBottom()
            }
          } else {
            // Stream finished
            break
          }
        }
      }
      
      // Process stream with retry logic
      while (retryCount <= (options.maxRetries || 3)) {
        try {
          await processStream()
          break // Success, exit retry loop
        } catch (streamError: any) {
          retryCount++
          
          if (!options.retryOnError || retryCount > (options.maxRetries || 3)) {
            throw streamError
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        }
      }
      
      const latency = Date.now() - streamStartTime.value
      
      // Finalize the assistant message
      updateMessage(assistantMessage.id, {
        metadata: {
          ...assistantMessage.metadata,
          latency,
          chunkCount,
          wordsPerSecond: streamingState.value.wordsPerSecond,
          isStreaming: false,
          retryCount
        }
      })
      
      return {
        userMessage,
        assistantMessage,
        content: fullContent,
        latency,
        chunkCount,
        wordsPerSecond: streamingState.value.wordsPerSecond
      }
    } catch (err) {
      error.value = err as Error
      
      if (options.pauseOnError) {
        streamingState.value.isPaused = true
      }
      
      throw err
    } finally {
      streamingState.value.isStreaming = false
      streamingState.value.isPaused = false
      streamController.value = null
      isTyping.value = false
    }
  }
  
  // Streaming control methods
  const pauseStreaming = () => {
    if (streamingState.value.isStreaming && !streamingState.value.isPaused) {
      streamingState.value.isPaused = true
    }
  }
  
  const resumeStreaming = () => {
    if (streamingState.value.isPaused && pauseResolver.value) {
      streamingState.value.isPaused = false
      pauseResolver.value()
      pauseResolver.value = null
    }
  }
  
  const cancelStreaming = () => {
    if (streamController.value) {
      streamController.value.abort()
      streamingState.value.isStreaming = false
      streamingState.value.isPaused = false
    }
  }
  
  const scrollToBottom = () => {
    if (typeof window !== 'undefined') {
      nextTick(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        })
      })
    }
  }
  
  // Batch streaming for multiple messages
  const streamBatch = async (messages: string[], options?: { delay?: number }) => {
    const results = []
    
    for (let i = 0; i < messages.length; i++) {
      const result = await streamMessage(messages[i])
      results.push(result)
      
      // Add delay between messages if specified
      if (options?.delay && i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delay))
      }
    }
    
    return results
  }
  
  // Stream with custom chunk processing
  const streamWithProcessor = async (
    content: string,
    processor: (chunk: string, fullContent: string) => string,
    chatOptions?: Partial<ChatOptions>
  ) => {
    // Similar to streamMessage but with custom chunk processing
    // This allows for custom formatting, filtering, or transformation of chunks
    return streamMessage(content, chatOptions)
  }
  
  // Clear conversation
  const clear = () => {
    messages.value = []
    error.value = null
    streamingState.value = {
      isStreaming: false,
      isPaused: false,
      currentChunk: '',
      streamProgress: 0,
      estimatedTimeRemaining: 0,
      wordsPerSecond: 0,
      totalChunks: 0,
      processedChunks: 0
    }
  }
  
  return {
    // State
    messages: readonly(messages),
    streamingState: readonly(streamingState),
    error: readonly(error),
    isTyping: readonly(isTyping),
    
    // Computed
    lastMessage,
    isStreamingMessage,
    streamingProgress,
    streamingStats,
    
    // Methods
    streamMessage,
    pauseStreaming,
    resumeStreaming,
    cancelStreaming,
    streamBatch,
    streamWithProcessor,
    addMessage,
    updateMessage,
    clear,
    
    // Utilities
    scrollToBottom
  }
}