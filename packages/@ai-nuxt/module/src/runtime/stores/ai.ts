import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types
export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    provider?: string
    tokens?: number
    cost?: number
    duration?: number
  }
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  createdAt: Date
  updatedAt: Date
  settings: AIConversationSettings
  metadata?: {
    totalTokens?: number
    totalCost?: number
    messageCount?: number
  }
}

export interface AIConversationSettings {
  provider: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  systemPrompt?: string
}

export interface AIGlobalSettings {
  defaultProvider: string
  defaultModel: string
  defaultSettings: AIConversationSettings
  apiKeys: Record<string, string>
  enablePersistence: boolean
  enableCaching: boolean
  debugMode: boolean
}

export interface AIStoreState {
  // Conversations
  conversations: AIConversation[]
  activeConversationId: string | null
  
  // Global settings
  globalSettings: AIGlobalSettings
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Statistics
  stats: {
    totalConversations: number
    totalMessages: number
    totalTokens: number
    totalCost: number
  }
}

// Default settings
const defaultGlobalSettings: AIGlobalSettings = {
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
  defaultSettings: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1,
    frequencyPenalty: 0
  },
  apiKeys: {},
  enablePersistence: true,
  enableCaching: true,
  debugMode: false
}

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'ai-nuxt:conversations',
  ACTIVE_CONVERSATION: 'ai-nuxt:active-conversation',
  GLOBAL_SETTINGS: 'ai-nuxt:global-settings',
  STATS: 'ai-nuxt:stats'
}

// Utility functions
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const generateConversationTitle = (messages: AIMessage[]): string => {
  const firstUserMessage = messages.find(m => m.role === 'user')
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim()
    return content.length > 50 ? `${content.substring(0, 50)}...` : content
  }
  return `Conversation ${new Date().toLocaleDateString()}`
}

const saveToStorage = (key: string, data: any): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  }
}

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Convert date strings back to Date objects
        if (key === STORAGE_KEYS.CONVERSATIONS) {
          return parsed.map((conv: any) => ({
            ...conv,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
            messages: conv.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }))
        }
        return parsed
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error)
    }
  }
  return defaultValue
}

export const useAIStore = defineStore('ai', () => {
  // State
  const conversations = ref<AIConversation[]>([])
  const activeConversationId = ref<string | null>(null)
  const globalSettings = ref<AIGlobalSettings>({ ...defaultGlobalSettings })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const activeConversation = computed(() => {
    return conversations.value.find(c => c.id === activeConversationId.value) || null
  })

  const stats = computed(() => {
    const totalConversations = conversations.value.length
    const totalMessages = conversations.value.reduce((sum, conv) => sum + conv.messages.length, 0)
    const totalTokens = conversations.value.reduce((sum, conv) => 
      sum + (conv.metadata?.totalTokens || 0), 0
    )
    const totalCost = conversations.value.reduce((sum, conv) => 
      sum + (conv.metadata?.totalCost || 0), 0
    )

    return {
      totalConversations,
      totalMessages,
      totalTokens,
      totalCost
    }
  })

  const recentConversations = computed(() => {
    return [...conversations.value]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
  })

  // Actions
  const loadPersistedData = (): void => {
    if (!globalSettings.value.enablePersistence) return

    conversations.value = loadFromStorage(STORAGE_KEYS.CONVERSATIONS, [])
    activeConversationId.value = loadFromStorage(STORAGE_KEYS.ACTIVE_CONVERSATION, null)
    globalSettings.value = {
      ...defaultGlobalSettings,
      ...loadFromStorage(STORAGE_KEYS.GLOBAL_SETTINGS, {})
    }
  }

  const persistData = (): void => {
    if (!globalSettings.value.enablePersistence) return

    saveToStorage(STORAGE_KEYS.CONVERSATIONS, conversations.value)
    saveToStorage(STORAGE_KEYS.ACTIVE_CONVERSATION, activeConversationId.value)
    saveToStorage(STORAGE_KEYS.GLOBAL_SETTINGS, globalSettings.value)
    saveToStorage(STORAGE_KEYS.STATS, stats.value)
  }

  const createConversation = (settings?: Partial<AIConversationSettings>): AIConversation => {
    const id = generateId()
    const now = new Date()
    
    const conversation: AIConversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      settings: {
        ...globalSettings.value.defaultSettings,
        ...settings
      },
      metadata: {
        totalTokens: 0,
        totalCost: 0,
        messageCount: 0
      }
    }

    conversations.value.push(conversation)
    activeConversationId.value = id
    persistData()

    return conversation
  }

  const deleteConversation = (conversationId: string): void => {
    const index = conversations.value.findIndex(c => c.id === conversationId)
    if (index === -1) return

    conversations.value.splice(index, 1)

    // If we deleted the active conversation, switch to the most recent one
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = conversations.value.length > 0 
        ? conversations.value[conversations.value.length - 1].id 
        : null
    }

    persistData()
  }

  const updateConversation = (conversationId: string, updates: Partial<AIConversation>): void => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return

    Object.assign(conversation, updates, { updatedAt: new Date() })
    persistData()
  }

  const setActiveConversation = (conversationId: string | null): void => {
    if (conversationId && !conversations.value.find(c => c.id === conversationId)) {
      console.warn(`Conversation ${conversationId} not found`)
      return
    }

    activeConversationId.value = conversationId
    persistData()
  }

  const addMessage = (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>): AIMessage => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const newMessage: AIMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date()
    }

    conversation.messages.push(newMessage)
    conversation.updatedAt = new Date()

    // Update conversation title if this is the first user message
    if (message.role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
      conversation.title = generateConversationTitle(conversation.messages)
    }

    // Update metadata
    if (newMessage.metadata?.tokens) {
      conversation.metadata!.totalTokens = (conversation.metadata!.totalTokens || 0) + newMessage.metadata.tokens
    }
    if (newMessage.metadata?.cost) {
      conversation.metadata!.totalCost = (conversation.metadata!.totalCost || 0) + newMessage.metadata.cost
    }
    conversation.metadata!.messageCount = conversation.messages.length

    persistData()
    return newMessage
  }

  const updateMessage = (conversationId: string, messageId: string, updates: Partial<AIMessage>): void => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return

    const message = conversation.messages.find(m => m.id === messageId)
    if (!message) return

    Object.assign(message, updates)
    conversation.updatedAt = new Date()
    persistData()
  }

  const deleteMessage = (conversationId: string, messageId: string): void => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return

    const index = conversation.messages.findIndex(m => m.id === messageId)
    if (index === -1) return

    const deletedMessage = conversation.messages[index]
    conversation.messages.splice(index, 1)
    conversation.updatedAt = new Date()

    // Update metadata
    if (deletedMessage.metadata?.tokens) {
      conversation.metadata!.totalTokens = Math.max(0, (conversation.metadata!.totalTokens || 0) - deletedMessage.metadata.tokens)
    }
    if (deletedMessage.metadata?.cost) {
      conversation.metadata!.totalCost = Math.max(0, (conversation.metadata!.totalCost || 0) - deletedMessage.metadata.cost)
    }
    conversation.metadata!.messageCount = conversation.messages.length

    persistData()
  }

  const clearConversation = (conversationId: string): void => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return

    conversation.messages = []
    conversation.updatedAt = new Date()
    conversation.metadata = {
      totalTokens: 0,
      totalCost: 0,
      messageCount: 0
    }

    persistData()
  }

  const updateConversationSettings = (conversationId: string, settings: Partial<AIConversationSettings>): void => {
    const conversation = conversations.value.find(c => c.id === conversationId)
    if (!conversation) return

    Object.assign(conversation.settings, settings)
    conversation.updatedAt = new Date()
    persistData()
  }

  const updateGlobalSettings = (settings: Partial<AIGlobalSettings>): void => {
    Object.assign(globalSettings.value, settings)
    persistData()
  }

  const setApiKey = (provider: string, apiKey: string): void => {
    globalSettings.value.apiKeys[provider] = apiKey
    persistData()
  }

  const getApiKey = (provider: string): string | undefined => {
    return globalSettings.value.apiKeys[provider]
  }

  const exportConversations = (): string => {
    return JSON.stringify({
      conversations: conversations.value,
      globalSettings: globalSettings.value,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2)
  }

  const importConversations = (data: string): void => {
    try {
      const parsed = JSON.parse(data)
      
      if (parsed.conversations && Array.isArray(parsed.conversations)) {
        // Convert date strings back to Date objects
        const importedConversations = parsed.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))

        conversations.value = importedConversations
      }

      if (parsed.globalSettings) {
        globalSettings.value = {
          ...defaultGlobalSettings,
          ...parsed.globalSettings
        }
      }

      persistData()
    } catch (error) {
      throw new Error('Invalid import data format')
    }
  }

  const clearAllData = (): void => {
    conversations.value = []
    activeConversationId.value = null
    globalSettings.value = { ...defaultGlobalSettings }
    
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    }
  }

  const setLoading = (loading: boolean): void => {
    isLoading.value = loading
  }

  const setError = (errorMessage: string | null): void => {
    error.value = errorMessage
  }

  // Initialize store
  const initialize = (): void => {
    loadPersistedData()
  }

  return {
    // State
    conversations,
    activeConversationId,
    globalSettings,
    isLoading,
    error,

    // Computed
    activeConversation,
    stats,
    recentConversations,

    // Actions
    initialize,
    createConversation,
    deleteConversation,
    updateConversation,
    setActiveConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    clearConversation,
    updateConversationSettings,
    updateGlobalSettings,
    setApiKey,
    getApiKey,
    exportConversations,
    importConversations,
    clearAllData,
    setLoading,
    setError,
    persistData,
    loadPersistedData
  }
})