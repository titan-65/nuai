import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIMessageList from '../AIMessageList.vue'
import type { Message } from '@ai-nuxt/core'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

describe('AIMessageList', () => {
  let wrapper: VueWrapper<any>
  
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date('2023-01-01T10:00:00Z')
    },
    {
      id: '2',
      role: 'assistant',
      content: 'I am doing well, thank you for asking!',
      timestamp: new Date('2023-01-01T10:00:30Z'),
      metadata: {
        tokens: 15,
        model: 'gpt-4',
        provider: 'openai',
        cost: 0.0001
      }
    },
    {
      id: '3',
      role: 'user',
      content: 'What can you help me with?',
      timestamp: new Date('2023-01-02T09:00:00Z')
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('should render empty state when no messages', () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: []
      }
    })

    expect(wrapper.find('.ai-message-list__empty').exists()).toBe(true)
    expect(wrapper.find('.ai-message-list__empty-text').text()).toBe('No messages yet. Start a conversation!')
  })

  it('should render custom empty message', () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: [],
        emptyMessage: 'Custom empty message'
      }
    })

    expect(wrapper.find('.ai-message-list__empty-text').text()).toBe('Custom empty message')
  })

  it('should render messages correctly', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages
      }
    })

    await nextTick()

    const messageElements = wrapper.findAll('.ai-message-list__message')
    expect(messageElements).toHaveLength(3)

    // Check first message (user)
    const firstMessage = messageElements[0]
    expect(firstMessage.classes()).toContain('ai-message-list__message--user')
    expect(firstMessage.find('.ai-message-list__text').text()).toBe('Hello, how are you?')
    expect(firstMessage.find('.ai-message-list__role').text()).toBe('User')

    // Check second message (assistant with metadata)
    const secondMessage = messageElements[1]
    expect(secondMessage.classes()).toContain('ai-message-list__message--assistant')
    expect(secondMessage.find('.ai-message-list__text').text()).toBe('I am doing well, thank you for asking!')
    expect(secondMessage.find('.ai-message-list__metadata').text()).toContain('Tokens: 15')
    expect(secondMessage.find('.ai-message-list__metadata').text()).toContain('Model: gpt-4')
    expect(secondMessage.find('.ai-message-list__metadata').text()).toContain('Provider: openai')
    expect(secondMessage.find('.ai-message-list__metadata').text()).toContain('Cost: $0.0001')
  })

  it('should show date separators', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        showDateSeparators: true
      }
    })

    await nextTick()

    const separators = wrapper.findAll('.ai-message-list__date-separator')
    expect(separators.length).toBeGreaterThan(0)
    
    // Should have separators for different dates
    expect(separators[0].find('.ai-message-list__date-separator-text').text()).toContain('Jan')
  })

  it('should hide date separators when disabled', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        showDateSeparators: false
      }
    })

    await nextTick()

    const separators = wrapper.findAll('.ai-message-list__date-separator')
    expect(separators).toHaveLength(0)
  })

  it('should show loading indicator', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        isLoading: true,
        loadingMessage: 'AI is thinking...'
      }
    })

    await nextTick()

    const loading = wrapper.find('.ai-message-list__loading')
    expect(loading.exists()).toBe(true)
    expect(loading.find('.ai-message-list__loading-text').text()).toBe('AI is thinking...')
    expect(wrapper.findAll('.ai-message-list__loading-dots span')).toHaveLength(3)
  })

  it('should show current streaming message', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        currentMessage: 'This is being typed...',
        isLoading: true
      }
    })

    await nextTick()

    const messages = wrapper.findAll('.ai-message-list__message')
    const streamingMessage = messages[messages.length - 1]
    
    expect(streamingMessage.classes()).toContain('ai-message-list__message--streaming')
    expect(streamingMessage.find('.ai-message-list__text').text()).toContain('This is being typed...')
    expect(streamingMessage.find('.ai-message-list__cursor').exists()).toBe(true)
  })

  it('should handle message actions', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        showActions: true,
        allowCopy: true,
        allowRegenerate: true,
        allowDelete: true
      }
    })

    await nextTick()

    const assistantMessage = wrapper.findAll('.ai-message-list__message')[1]
    const actions = assistantMessage.find('.ai-message-list__actions')
    
    expect(actions.exists()).toBe(true)
    
    const actionButtons = actions.findAll('.ai-message-list__action-button')
    expect(actionButtons.length).toBeGreaterThan(0)
  })

  it('should emit copy event when copy button clicked', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        allowCopy: true
      }
    })

    await nextTick()

    const assistantMessage = wrapper.findAll('.ai-message-list__message')[1]
    const copyButton = assistantMessage.find('[title="Copy message"]')
    
    await copyButton.trigger('click')

    expect(wrapper.emitted('copy')).toBeTruthy()
    expect(wrapper.emitted('copy')?.[0]).toEqual([mockMessages[1]])
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockMessages[1].content)
  })

  it('should emit regenerate event when regenerate button clicked', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        allowRegenerate: true
      }
    })

    await nextTick()

    const assistantMessage = wrapper.findAll('.ai-message-list__message')[1]
    const regenerateButton = assistantMessage.find('[title="Regenerate response"]')
    
    await regenerateButton.trigger('click')

    expect(wrapper.emitted('regenerate')).toBeTruthy()
    expect(wrapper.emitted('regenerate')?.[0]).toEqual([mockMessages[1]])
  })

  it('should emit delete event when delete button clicked', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        allowDelete: true
      }
    })

    await nextTick()

    const firstMessage = wrapper.findAll('.ai-message-list__message')[0]
    const deleteButton = firstMessage.find('[title="Delete message"]')
    
    await deleteButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual([mockMessages[0]])
  })

  it('should handle message selection', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        allowSelection: true
      }
    })

    await nextTick()

    const firstMessage = wrapper.findAll('.ai-message-list__message')[0]
    await firstMessage.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([mockMessages[0]])
  })

  it('should show selected message with highlight', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        allowSelection: true,
        selectedMessageId: '1'
      }
    })

    await nextTick()

    const firstMessage = wrapper.findAll('.ai-message-list__message')[0]
    expect(firstMessage.classes()).toContain('ai-message-list__message--selected')
  })

  it('should hide metadata when disabled', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        showMetadata: false
      }
    })

    await nextTick()

    const metadata = wrapper.find('.ai-message-list__metadata')
    expect(metadata.exists()).toBe(false)
  })

  it('should hide actions when disabled', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        showActions: false
      }
    })

    await nextTick()

    const actions = wrapper.find('.ai-message-list__actions')
    expect(actions.exists()).toBe(false)
  })

  it('should use custom avatars from slots', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages
      },
      slots: {
        'avatar-user': '<div class="custom-user-avatar">U</div>',
        'avatar-assistant': '<div class="custom-assistant-avatar">A</div>'
      }
    })

    await nextTick()

    expect(wrapper.find('.custom-user-avatar').exists()).toBe(true)
    expect(wrapper.find('.custom-assistant-avatar').exists()).toBe(true)
  })

  it('should use custom message content from slot', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages
      },
      slots: {
        message: '<div class="custom-message">Custom: {{ message.content }}</div>'
      }
    })

    await nextTick()

    expect(wrapper.find('.custom-message').exists()).toBe(true)
  })

  it('should show scroll to bottom button when needed', async () => {
    // Mock scroll properties
    const mockScrollHeight = 1000
    const mockClientHeight = 400
    const mockScrollTop = 0

    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        scrollThreshold: 100
      }
    })

    await nextTick()

    // Mock container scroll properties
    const container = wrapper.find('.ai-message-list').element as HTMLElement
    Object.defineProperty(container, 'scrollHeight', { value: mockScrollHeight })
    Object.defineProperty(container, 'clientHeight', { value: mockClientHeight })
    Object.defineProperty(container, 'scrollTop', { value: mockScrollTop })

    // Trigger scroll event
    await container.dispatchEvent(new Event('scroll'))
    await nextTick()

    // Should show scroll button when far from bottom
    expect(wrapper.find('.ai-message-list__scroll-button').exists()).toBe(true)
  })

  it('should emit scroll event', async () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages
      }
    })

    await nextTick()

    const container = wrapper.find('.ai-message-list').element as HTMLElement
    await container.dispatchEvent(new Event('scroll'))

    expect(wrapper.emitted('scroll')).toBeTruthy()
  })

  it('should handle custom height', () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages,
        height: '600px'
      }
    })

    const container = wrapper.find('.ai-message-list')
    expect(container.attributes('style')).toContain('height: 600px')
  })

  it('should show error messages', async () => {
    const messagesWithError: Message[] = [
      {
        ...mockMessages[0],
        error: 'Failed to send message'
      }
    ]

    wrapper = mount(AIMessageList, {
      props: {
        messages: messagesWithError
      }
    })

    await nextTick()

    const errorElement = wrapper.find('.ai-message-list__error')
    expect(errorElement.exists()).toBe(true)
    expect(errorElement.find('.ai-message-list__error-text').text()).toBe('Failed to send message')
  })

  it('should expose methods', () => {
    wrapper = mount(AIMessageList, {
      props: {
        messages: mockMessages
      }
    })

    const vm = wrapper.vm
    expect(typeof vm.scrollToBottom).toBe('function')
    expect(typeof vm.scrollToTop).toBe('function')
    expect(typeof vm.scrollToMessage).toBe('function')
  })
})