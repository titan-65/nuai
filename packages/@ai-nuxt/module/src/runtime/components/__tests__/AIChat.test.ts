import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIChat from '../AIChat.vue'
import type { Message } from '@ai-nuxt/core'

// Mock the streaming chat composable
const mockStreamingChat = {
  messages: { value: [] as Message[] },
  currentMessage: { value: '' },
  isStreaming: { value: false },
  isConnected: { value: true },
  error: { value: null as string | null },
  reconnectAttempts: { value: 0 },
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
  cancelStream: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn()
}

vi.mock('../composables/useAIStreamingChat', () => ({
  useAIStreamingChat: () => mockStreamingChat
}))

describe('AIChat', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock state
    mockStreamingChat.messages.value = []
    mockStreamingChat.currentMessage.value = ''
    mockStreamingChat.isStreaming.value = false
    mockStreamingChat.isConnected.value = true
    mockStreamingChat.error.value = null
    mockStreamingChat.reconnectAttempts.value = 0
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('should render with default props', () => {
    wrapper = mount(AIChat)

    expect(wrapper.find('.ai-chat').exists()).toBe(true)
    expect(wrapper.find('.ai-chat__title').text()).toBe('AI Chat')
    expect(wrapper.find('.ai-chat__welcome').text()).toContain('Hello! How can I help you today?')
    expect(wrapper.find('.ai-chat__input').attributes('placeholder')).toBe('Type your message here...')
  })

  it('should render with custom props', () => {
    wrapper = mount(AIChat, {
      props: {
        title: 'Custom Chat',
        welcomeMessage: 'Welcome to custom chat!',
        placeholder: 'Enter your message...',
        provider: 'openai',
        model: 'gpt-4'
      }
    })

    expect(wrapper.find('.ai-chat__title').text()).toBe('Custom Chat')
    expect(wrapper.find('.ai-chat__welcome').text()).toContain('Welcome to custom chat!')
    expect(wrapper.find('.ai-chat__input').attributes('placeholder')).toBe('Enter your message...')
    expect(wrapper.find('.ai-chat__input-info').text()).toContain('Provider: openai')
    expect(wrapper.find('.ai-chat__input-info').text()).toContain('Model: gpt-4')
  })

  it('should display messages correctly', async () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2023-01-01T10:00:00Z')
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2023-01-01T10:00:01Z'),
        metadata: {
          tokens: 10,
          model: 'gpt-4',
          provider: 'openai'
        }
      }
    ]

    mockStreamingChat.messages.value = messages
    wrapper = mount(AIChat)

    await nextTick()

    const messageElements = wrapper.findAll('.ai-chat__message')
    expect(messageElements).toHaveLength(2)

    // Check user message
    const userMessage = messageElements[0]
    expect(userMessage.classes()).toContain('ai-chat__message--user')
    expect(userMessage.find('.ai-chat__message-text').text()).toBe('Hello')
    expect(userMessage.find('.ai-chat__message-role').text()).toBe('user')

    // Check assistant message
    const assistantMessage = messageElements[1]
    expect(assistantMessage.classes()).toContain('ai-chat__message--assistant')
    expect(assistantMessage.find('.ai-chat__message-text').text()).toBe('Hi there!')
    expect(assistantMessage.find('.ai-chat__message-role').text()).toBe('assistant')
    expect(assistantMessage.find('.ai-chat__message-metadata').text()).toContain('Tokens: 10')
    expect(assistantMessage.find('.ai-chat__message-metadata').text()).toContain('Model: gpt-4')
  })

  it('should show streaming message', async () => {
    mockStreamingChat.isStreaming.value = true
    mockStreamingChat.currentMessage.value = 'Typing response...'
    
    wrapper = mount(AIChat)
    await nextTick()

    const streamingMessage = wrapper.find('.ai-chat__message--streaming')
    expect(streamingMessage.exists()).toBe(true)
    expect(streamingMessage.find('.ai-chat__message-text').text()).toContain('Typing response...')
    expect(streamingMessage.find('.ai-chat__cursor').exists()).toBe(true)
  })

  it('should show loading indicator when streaming without current message', async () => {
    mockStreamingChat.isStreaming.value = true
    mockStreamingChat.currentMessage.value = ''
    
    wrapper = mount(AIChat)
    await nextTick()

    const loading = wrapper.find('.ai-chat__loading')
    expect(loading.exists()).toBe(true)
    expect(loading.text()).toContain('AI is thinking...')
    expect(wrapper.findAll('.ai-chat__loading-dots span')).toHaveLength(3)
  })

  it('should handle input and send message', async () => {
    wrapper = mount(AIChat)
    
    const input = wrapper.find('.ai-chat__input')
    const sendButton = wrapper.find('.ai-chat__button--send')

    // Initially send button should be disabled
    expect(sendButton.attributes('disabled')).toBeDefined()

    // Type a message
    await input.setValue('Hello AI')
    await nextTick()

    // Send button should be enabled
    expect(sendButton.attributes('disabled')).toBeUndefined()

    // Click send button
    await sendButton.trigger('click')

    expect(mockStreamingChat.sendMessage).toHaveBeenCalledWith('Hello AI')
    expect(input.element.value).toBe('') // Input should be cleared
  })

  it('should send message on Enter key', async () => {
    wrapper = mount(AIChat)
    
    const input = wrapper.find('.ai-chat__input')
    await input.setValue('Hello AI')

    // Press Enter
    await input.trigger('keydown', { key: 'Enter' })

    expect(mockStreamingChat.sendMessage).toHaveBeenCalledWith('Hello AI')
  })

  it('should not send message on Shift+Enter', async () => {
    wrapper = mount(AIChat)
    
    const input = wrapper.find('.ai-chat__input')
    await input.setValue('Hello AI')

    // Press Shift+Enter
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })

    expect(mockStreamingChat.sendMessage).not.toHaveBeenCalled()
  })

  it('should handle cancel streaming', async () => {
    mockStreamingChat.isStreaming.value = true
    wrapper = mount(AIChat)
    await nextTick()

    const cancelButton = wrapper.find('.ai-chat__button--cancel')
    expect(cancelButton.exists()).toBe(true)

    await cancelButton.trigger('click')
    expect(mockStreamingChat.cancelStream).toHaveBeenCalled()
  })

  it('should handle clear messages', async () => {
    mockStreamingChat.messages.value = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
    ]
    
    wrapper = mount(AIChat)
    await nextTick()

    const clearButton = wrapper.find('.ai-chat__button--clear')
    await clearButton.trigger('click')

    expect(mockStreamingChat.clearMessages).toHaveBeenCalled()
  })

  it('should display error message', async () => {
    mockStreamingChat.error.value = 'Connection failed'
    wrapper = mount(AIChat)
    await nextTick()

    const error = wrapper.find('.ai-chat__error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('Connection failed')
    
    const retryButton = wrapper.find('.ai-chat__error-retry')
    expect(retryButton.exists()).toBe(true)
  })

  it('should handle retry functionality', async () => {
    wrapper = mount(AIChat)
    
    // Simulate a failed message
    const input = wrapper.find('.ai-chat__input')
    await input.setValue('Failed message')
    
    // Mock sendMessage to throw error
    mockStreamingChat.sendMessage.mockRejectedValueOnce(new Error('Network error'))
    
    const sendButton = wrapper.find('.ai-chat__button--send')
    await sendButton.trigger('click')
    
    // Message should be restored to input
    expect(input.element.value).toBe('Failed message')
    
    // Now set error state and test retry
    mockStreamingChat.error.value = 'Network error'
    await nextTick()
    
    const retryButton = wrapper.find('.ai-chat__error-retry')
    await retryButton.trigger('click')
    
    expect(mockStreamingChat.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('should show connection status for WebSocket', async () => {
    wrapper = mount(AIChat, {
      props: {
        transport: 'websocket'
      }
    })

    // Connected state
    mockStreamingChat.isConnected.value = true
    await nextTick()
    expect(wrapper.find('.ai-chat__status-text').text()).toBe('Connected')
    expect(wrapper.find('.ai-chat__status-indicator--connected').exists()).toBe(true)

    // Disconnected state
    mockStreamingChat.isConnected.value = false
    await nextTick()
    expect(wrapper.find('.ai-chat__status-text').text()).toBe('Disconnected')

    // Reconnecting state
    mockStreamingChat.reconnectAttempts.value = 2
    await nextTick()
    expect(wrapper.find('.ai-chat__status-text').text()).toBe('Reconnecting... (2)')
  })

  it('should respect disabled state', async () => {
    wrapper = mount(AIChat, {
      props: {
        disabled: true
      }
    })

    expect(wrapper.find('.ai-chat--disabled').exists()).toBe(true)
    expect(wrapper.find('.ai-chat__input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.ai-chat__button--send').attributes('disabled')).toBeDefined()
  })

  it('should handle character limit', async () => {
    wrapper = mount(AIChat, {
      props: {
        maxLength: 10
      }
    })

    const input = wrapper.find('.ai-chat__input')
    await input.setValue('This is a very long message that exceeds the limit')
    
    // Should be truncated to 10 characters
    expect(input.element.value).toBe('This is a ')
  })

  it('should emit events correctly', async () => {
    wrapper = mount(AIChat)

    // Test message emit
    const newMessage: Message = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date()
    }
    
    mockStreamingChat.messages.value = [newMessage]
    await nextTick()
    
    expect(wrapper.emitted('message')).toBeTruthy()
    expect(wrapper.emitted('message')?.[0]).toEqual([newMessage])

    // Test error emit
    mockStreamingChat.error.value = 'Test error'
    await nextTick()
    
    expect(wrapper.emitted('error')).toBeTruthy()
    expect(wrapper.emitted('error')?.[0]).toEqual(['Test error'])

    // Test clear emit
    const clearButton = wrapper.find('.ai-chat__button--clear')
    await clearButton.trigger('click')
    
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('should handle initial messages', () => {
    const initialMessages: Message[] = [
      { id: '1', role: 'user', content: 'Initial message', timestamp: new Date() }
    ]

    wrapper = mount(AIChat, {
      props: {
        initialMessages
      }
    })

    expect(mockStreamingChat.messages.value).toEqual(initialMessages)
  })

  it('should hide header when showHeader is false', () => {
    wrapper = mount(AIChat, {
      props: {
        showHeader: false
      }
    })

    expect(wrapper.find('.ai-chat__header').exists()).toBe(false)
  })

  it('should hide input footer when showInputFooter is false', () => {
    wrapper = mount(AIChat, {
      props: {
        showInputFooter: false
      }
    })

    expect(wrapper.find('.ai-chat__input-footer').exists()).toBe(false)
  })

  it('should use custom height', () => {
    wrapper = mount(AIChat, {
      props: {
        height: '600px'
      }
    })

    const messagesContainer = wrapper.find('.ai-chat__messages')
    expect(messagesContainer.attributes('style')).toContain('height: 600px')
  })

  it('should handle auto-resize input', async () => {
    wrapper = mount(AIChat, {
      props: {
        autoResize: true
      }
    })

    const input = wrapper.find('.ai-chat__input')
    
    // Single line
    await input.setValue('Single line')
    expect(input.attributes('rows')).toBe('1')

    // Multiple lines
    await input.setValue('Line 1\nLine 2\nLine 3')
    expect(input.attributes('rows')).toBe('3')
  })

  it('should expose methods via defineExpose', () => {
    wrapper = mount(AIChat)
    
    const vm = wrapper.vm
    expect(typeof vm.sendMessage).toBe('function')
    expect(typeof vm.clearMessages).toBe('function')
    expect(typeof vm.focusInput).toBe('function')
    expect(typeof vm.connect).toBe('function')
    expect(typeof vm.disconnect).toBe('function')
  })
})