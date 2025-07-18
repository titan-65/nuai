import { ref, computed, watch } from 'vue'
import { useAI } from './useAI'
import { useAIStore } from './useAIStore'
import type { AIMessage, AIConversationSettings } from '../stores/ai'

export interface ChatStoreOptions extends Partial<AIConversationSettings> {
  conversationId?: string
  autoSave?: boolean
  stream?: boolean
}

/**
 * Enhanced AI Chat composable that integrates with Pinia store for persistence
 * Provides conversation management, message history, and state persistence
 */
export const useAIChatStore = (options: ChatStoreOptions = {}) => {
  const { chat } = useAI()
  const aiStore = useAIStore()
  
  // State
  const conversationId = ref<string | null>(options.conversationId || null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const autoSave = ref(options.autoSave ?? true)
  
  // Configuration
  const config = ref<AIConversationSettings>({
    provider: options.provider || aiStore.globalSettings.value.defaultProvider,
    model: options.model || aiStore.globalSettings.value.defaultModel,
    temperature: options.temperature || aiStore.globalSettings.value.defaultSettings.temperature,
    maxTokens: options.maxTokens || aiStore.globalSettings.value.defaultSettings.maxTokens,
    topP: options.topP || aiStore.globalSettings.value.defaultSettings.topP,
    frequencyPenalty: options.frequencyPenalty || aiStore.globalSettings.value.defaultSettings.frequencyPenalty,
    systemPrompt: options.systemPrompt
  })
  
  // Computed
  const conversation = computed(() => {
    return conversationId.value ? aiStore.getConversationById(conversationId.value) : null
  })
  
  const messages = computed(() => {
    return conversation.value?.messages || []
  })
  
  const lastMessage = computed(() => {
    const msgs = messages.value
    return msgs[msgs.length - 1]
  })
  
  const userMessages = computed(() => {
    return messages.value.filter(m => m.role === 'user')
  })
  
  const assistantMessages = computed(() => {
    return messages.value.filter(m => m.role === 'assistant')
  })
  
  const conversationHistory = computed(() => {
    return messages.value.map(m => ({
      role: m.role,
      content: m.content
    }))
  })
  
  const conversationStats = computed(() => {
    const conv = conversation.value
    return conv?.metadata || {
      totalTokens: 0,
      totalCost: 0,
      messageCount: 0
    }
  })
  
  // Methods
  const createNewConversation = (settings?: Partial<AIConversationSettings>) => {
    const newConversation = aiStore.createConversation({
      ...config.value,
      ...settings
    })
    conversationId.value = newConversation.id
    return newConversation
  }
  
  const loadConversation = (id: string) => {
    const conv = aiStore.getConversationById(id)
    if (conv) {
      conversationId.value = id
      config.value = { ...conv.settings }
      return conv
    }
    return null
  }
  
  const ensureConversation = () => {
    if (!conversationId.value) {
      createNewConversation()
    }
    return conversationId.value!
  }
  
  const addMessage = (role: AIMessage['role'], content: string, metadata?: AIMessage['metadata']): AIMessage => {
    const convId = ensureConversation()
    return aiStore.addMessage(convId, {
      role,
      content,
      metadata
    })
  }
  
  const updateMessage = (messageId: string, updates: Partial<AIMessage>): void => {
    if (conversationId.value) {
      aiStore.updateMessage(conversationId.value, messageId, updates)
    }
  }
  
  const deleteMessage = (messageId: string): void => {
    if (conversationId.value) {
      aiStore.deleteMessage(conversationId.value, messageId)
    }
  }
  
  const clearMessages = (): void => {
    if (conversationId.value) {
      aiStore.clearConversation(conversationId.value)
    }
  }
  
  const sendMessage = async (content: string): Promise<AIMessage | null> => {
    if (!content.trim()) return null
    
    const convId = ensureConversation()
    
    // Add user message
    const userMessage = addMessage('user', content.trim())
    
    // Clear any previous errors
    error.value = null
    isLoading.value = true
    aiStore.setLoading(true)
    
    try {
      // Prepare messages for API
      const apiMessages = [
        ...(config.value.systemPrompt ? [{ role: 'system' as const, content: config.value.systemPrompt }] : []),
        ...conversationHistory.value
      ]
      
      // Send to AI
      const response = await chat({
        messages: apiMessages,
        provider: config.value.provider,
        model: config.value.model,
        temperature: config.value.temperature,
        maxTokens: config.value.maxTokens,
        stream: options.stream ?? true
      })
      
      // Add assistant response
      const assistantMessage = addMessage('assistant', response.text, {
        model: response.model,
        provider: config.value.provider,
        tokens: response.usage?.totalTokens,
        cost: response.cost
      })
      
      // Update conversation settings if they changed
      if (autoSave.value) {
        aiStore.updateConversationSettings(convId, config.value)
      }
      
      return assistantMessage
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send message'
      error.value = errorMessage
      aiStore.setError(errorMessage)
      return null
    } finally {
      isLoading.value = false
      aiStore.setLoading(false)
    }
  }
  
  const regenerateLastResponse = async (): Promise<AIMessage | null> => {
    const lastAssistantMessage = [...messages.value].reverse().find(m => m.role === 'assistant')
    if (!lastAssistantMessage) return null
    
    // Remove the last assistant message
    deleteMessage(lastAssistantMessage.id)
    
    // Get the last user message
    const lastUserMessage = [...messages.value].reverse().find(m => m.role === 'user')
    if (!lastUserMessage) return null
    
    // Regenerate response
    return await sendMessage(lastUserMessage.content)
  }
  
  const updateConfig = (newConfig: Partial<AIConversationSettings>): void => {
    config.value = { ...config.value, ...newConfig }
    
    // Update conversation settings if auto-save is enabled
    if (autoSave.value && conversationId.value) {
      aiStore.updateConversationSettings(conversationId.value, config.value)
    }
  }
  
  const saveConversation = () => {
    if (conversationId.value) {
      aiStore.updateConversationSettings(conversationId.value, config.value)
      aiStore.persistData()
    }
  }
  
  const deleteConversation = () => {
    if (conversationId.value) {
      aiStore.deleteConversation(conversationId.value)
      conversationId.value = null
    }
  }
  
  const exportConversation = () => {
    if (conversation.value) {
      return JSON.stringify(conversation.value, null, 2)
    }
    return null
  }
  
  const setActiveConversation = () => {
    if (conversationId.value) {
      aiStore.setActiveConversation(conversationId.value)
    }
  }
  
  // Watch for config changes from options
  watch(() => options, (newOptions) => {
    if (newOptions) {
      const { conversationId: newConvId, autoSave: newAutoSave, ...configOptions } = newOptions
      
      if (newConvId && newConvId !== conversationId.value) {
        loadConversation(newConvId)
      }
      
      if (newAutoSave !== undefined) {
        autoSave.value = newAutoSave
      }
      
      updateConfig(configOptions)
    }
  }, { deep: true })
  
  // Initialize conversation if provided
  if (options.conversationId) {
    loadConversation(options.conversationId)
  }
  
  return {
    // State
    conversationId,
    conversation,
    messages,
    isLoading,
    error,
    config,
    autoSave,
    
    // Computed
    lastMessage,
    userMessages,
    assistantMessages,
    conversationHistory,
    conversationStats,
    
    // Conversation management
    createNewConversation,
    loadConversation,
    saveConversation,
    deleteConversation,
    exportConversation,
    setActiveConversation,
    
    // Message management
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    sendMessage,
    regenerateLastResponse,
    
    // Configuration
    updateConfig
  }
}