import { computed } from 'vue'
import { useAIStore } from '../stores/ai'
import type { AIMessage, AIConversation, AIConversationSettings } from '../stores/ai'

/**
 * Composable for interacting with the AI store
 * Provides reactive access to conversations, settings, and state management
 */
export const useAIStore = () => {
  const store = useAIStore()

  // Reactive getters
  const conversations = computed(() => store.conversations)
  const activeConversation = computed(() => store.activeConversation)
  const activeConversationId = computed(() => store.activeConversationId)
  const globalSettings = computed(() => store.globalSettings)
  const isLoading = computed(() => store.isLoading)
  const error = computed(() => store.error)
  const stats = computed(() => store.stats)
  const recentConversations = computed(() => store.recentConversations)

  // Conversation management
  const createConversation = (settings?: Partial<AIConversationSettings>) => {
    return store.createConversation(settings)
  }

  const deleteConversation = (conversationId: string) => {
    store.deleteConversation(conversationId)
  }

  const setActiveConversation = (conversationId: string | null) => {
    store.setActiveConversation(conversationId)
  }

  const updateConversation = (conversationId: string, updates: Partial<AIConversation>) => {
    store.updateConversation(conversationId, updates)
  }

  const clearConversation = (conversationId: string) => {
    store.clearConversation(conversationId)
  }

  // Message management
  const addMessage = (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => {
    return store.addMessage(conversationId, message)
  }

  const updateMessage = (conversationId: string, messageId: string, updates: Partial<AIMessage>) => {
    store.updateMessage(conversationId, messageId, updates)
  }

  const deleteMessage = (conversationId: string, messageId: string) => {
    store.deleteMessage(conversationId, messageId)
  }

  // Settings management
  const updateConversationSettings = (conversationId: string, settings: Partial<AIConversationSettings>) => {
    store.updateConversationSettings(conversationId, settings)
  }

  const updateGlobalSettings = (settings: Partial<typeof store.globalSettings>) => {
    store.updateGlobalSettings(settings)
  }

  const setApiKey = (provider: string, apiKey: string) => {
    store.setApiKey(provider, apiKey)
  }

  const getApiKey = (provider: string) => {
    return store.getApiKey(provider)
  }

  // Utility functions
  const exportData = () => {
    return store.exportConversations()
  }

  const importData = (data: string) => {
    store.importConversations(data)
  }

  const clearAllData = () => {
    store.clearAllData()
  }

  // State management
  const setLoading = (loading: boolean) => {
    store.setLoading(loading)
  }

  const setError = (error: string | null) => {
    store.setError(error)
  }

  // Helper functions
  const getConversationById = (id: string) => {
    return conversations.value.find(c => c.id === id)
  }

  const getMessageById = (conversationId: string, messageId: string) => {
    const conversation = getConversationById(conversationId)
    return conversation?.messages.find(m => m.id === messageId)
  }

  const getConversationMessages = (conversationId: string) => {
    const conversation = getConversationById(conversationId)
    return conversation?.messages || []
  }

  const getLastMessage = (conversationId: string) => {
    const messages = getConversationMessages(conversationId)
    return messages[messages.length - 1]
  }

  const getMessagesByRole = (conversationId: string, role: AIMessage['role']) => {
    const messages = getConversationMessages(conversationId)
    return messages.filter(m => m.role === role)
  }

  const searchConversations = (query: string) => {
    const lowerQuery = query.toLowerCase()
    return conversations.value.filter(conv => 
      conv.title.toLowerCase().includes(lowerQuery) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery))
    )
  }

  const getConversationsByDateRange = (startDate: Date, endDate: Date) => {
    return conversations.value.filter(conv => 
      conv.createdAt >= startDate && conv.createdAt <= endDate
    )
  }

  const getConversationsByProvider = (provider: string) => {
    return conversations.value.filter(conv => conv.settings.provider === provider)
  }

  const getConversationsByModel = (model: string) => {
    return conversations.value.filter(conv => conv.settings.model === model)
  }

  // Initialize store on first use
  store.initialize()

  return {
    // Reactive state
    conversations,
    activeConversation,
    activeConversationId,
    globalSettings,
    isLoading,
    error,
    stats,
    recentConversations,

    // Conversation management
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversation,
    clearConversation,

    // Message management
    addMessage,
    updateMessage,
    deleteMessage,

    // Settings management
    updateConversationSettings,
    updateGlobalSettings,
    setApiKey,
    getApiKey,

    // Data management
    exportData,
    importData,
    clearAllData,

    // State management
    setLoading,
    setError,

    // Helper functions
    getConversationById,
    getMessageById,
    getConversationMessages,
    getLastMessage,
    getMessagesByRole,
    searchConversations,
    getConversationsByDateRange,
    getConversationsByProvider,
    getConversationsByModel
  }
}

// Re-export types for convenience
export type { AIMessage, AIConversation, AIConversationSettings } from '../stores/ai'