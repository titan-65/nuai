import { ref, computed } from 'vue'
import { useAI } from './useAI'
import type { Message, ChatOptions } from '@ai-nuxt/core'

export interface UseAIChatOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  initialMessages?: Message[]
}

/**
 * Composable for managing AI chat conversations
 */
export function useAIChat(options: UseAIChatOptions = {}) {
  const ai = useAI(options.provider)
  
  // Reactive state
  const messages = ref<Message[]>(options.initialMessages || [])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const usage = ref<any>(null)
  
  // Computed properties
  const lastMessage = computed(() => {
    return messages.value[messages.value.length - 1]
  })
  
  const conversationLength = computed(() => {
    return messages.value.length
  })
  
  const totalTokens = computed(() => {
    return usage.value?.totalTokens || 0
  })
  
  // Methods
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date()
    }
    messages.value.push(newMessage)
    return newMessage
  }
  
  const send = async (content: string, chatOptions?: Partial<ChatOptions>) => {
    if (isLoading.value) {
      throw new Error('Chat is already processing a message')
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content
      })
      
      // Prepare chat options
      const requestOptions: ChatOptions = {
        messages: messages.value,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        ...chatOptions
      }
      
      // Send to AI
      const response = await ai.chat.create(requestOptions)
      
      // Add assistant response
      addMessage({
        role: 'assistant',
        content: response.message.content,
        metadata: response.message.metadata
      })
      
      usage.value = response.usage
      
      return response
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  const stream = async (content: string, chatOptions?: Partial<ChatOptions>) => {
    if (isLoading.value) {
      throw new Error('Chat is already processing a message')
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // Add user message
      addMessage({
        role: 'user',
        content
      })
      
      // Add placeholder assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        content: ''
      })
      
      // Prepare chat options
      const requestOptions: ChatOptions = {
        messages: messages.value.slice(0, -1), // Exclude the placeholder message
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        ...chatOptions
      }
      
      // Stream response
      let fullContent = ''
      for await (const chunk of ai.chat.stream(requestOptions)) {
        if (!chunk.finished) {
          fullContent += chunk.delta
          // Update the assistant message in place
          const messageIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
          if (messageIndex !== -1) {
            messages.value[messageIndex].content = fullContent
          }
        }
      }
      
      return { content: fullContent }
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  const retry = async () => {
    if (messages.value.length === 0) {
      throw new Error('No messages to retry')
    }
    
    const lastUserMessage = [...messages.value]
      .reverse()
      .find(m => m.role === 'user')
    
    if (!lastUserMessage) {
      throw new Error('No user message found to retry')
    }
    
    // Remove the last assistant message if it exists
    if (lastMessage.value?.role === 'assistant') {
      messages.value.pop()
    }
    
    return send(lastUserMessage.content)
  }
  
  const clear = () => {
    messages.value = []
    error.value = null
    usage.value = null
  }
  
  const removeMessage = (messageId: string) => {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }
  
  const editMessage = (messageId: string, newContent: string) => {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.content = newContent
    }
  }
  
  return {
    // State
    messages: readonly(messages),
    isLoading: readonly(isLoading),
    error: readonly(error),
    usage: readonly(usage),
    
    // Computed
    lastMessage,
    conversationLength,
    totalTokens,
    
    // Methods
    send,
    stream,
    retry,
    clear,
    addMessage,
    removeMessage,
    editMessage
  }
}

// Utility function to generate IDs
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}