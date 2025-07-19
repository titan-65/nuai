import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIInput from '../AIInput.vue'

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null
}))

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    })
  }
})

describe('AIInput', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('should render with default props', () => {
    wrapper = mount(AIInput)

    expect(wrapper.find('.ai-input').exists()).toBe(true)
    expect(wrapper.find('.ai-input__textarea').attributes('placeholder')).toBe('Type your message...')
    expect(wrapper.find('.ai-input__submit-text').text()).toBe('Send')
  })

  it('should render with custom props', () => {
    wrapper = mount(AIInput, {
      props: {
        placeholder: 'Enter your message...',
        submitText: 'Submit',
        maxLength: 1000,
        showCharacterCount: true
      }
    })

    expect(wrapper.find('.ai-input__textarea').attributes('placeholder')).toBe('Enter your message...')
    expect(wrapper.find('.ai-input__submit-text').text()).toBe('Submit')
    expect(wrapper.find('.ai-input__character-count').text()).toBe('0/1000')
  })

  it('should handle v-model correctly', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Initial value'
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    expect(textarea.element.value).toBe('Initial value')

    // Update value
    await textarea.setValue('New value')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['New value'])
  })

  it('should validate required field', async () => {
    wrapper = mount(AIInput, {
      props: {
        required: true,
        showFooter: true
      }
    })

    await nextTick()

    const validation = wrapper.find('.ai-input__validation-message--error')
    expect(validation.exists()).toBe(true)
    expect(validation.text()).toContain('This field is required')
  })

  it('should validate minimum length', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Hi',
        minLength: 5,
        showFooter: true
      }
    })

    await nextTick()

    const validation = wrapper.find('.ai-input__validation-message--error')
    expect(validation.exists()).toBe(true)
    expect(validation.text()).toContain('Minimum 5 characters required')
  })

  it('should validate maximum length', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'This is a very long message',
        maxLength: 10,
        showFooter: true
      }
    })

    await nextTick()

    const validation = wrapper.find('.ai-input__validation-message--error')
    expect(validation.exists()).toBe(true)
    expect(validation.text()).toContain('Maximum 10 characters allowed')
  })

  it('should apply custom validation', async () => {
    const customValidation = (value: string) => {
      if (value.includes('bad')) {
        return [{ type: 'error' as const, text: 'Contains bad word' }]
      }
      return []
    }

    wrapper = mount(AIInput, {
      props: {
        modelValue: 'This is bad',
        customValidation,
        showFooter: true
      }
    })

    await nextTick()

    const validation = wrapper.find('.ai-input__validation-message--error')
    expect(validation.exists()).toBe(true)
    expect(validation.text()).toContain('Contains bad word')
  })

  it('should show character count', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Hello',
        maxLength: 100,
        showCharacterCount: true
      }
    })

    await nextTick()

    const characterCount = wrapper.find('.ai-input__character-count')
    expect(characterCount.exists()).toBe(true)
    expect(characterCount.text()).toBe('5/100')
  })

  it('should show warning when near character limit', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'A'.repeat(85), // 85 characters
        maxLength: 100,
        showCharacterCount: true
      }
    })

    await nextTick()

    const characterCount = wrapper.find('.ai-input__character-count')
    expect(characterCount.classes()).toContain('ai-input__character-count--warning')
  })

  it('should show error when over character limit', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'A'.repeat(110), // 110 characters
        maxLength: 100,
        showCharacterCount: true
      }
    })

    await nextTick()

    const characterCount = wrapper.find('.ai-input__character-count')
    expect(characterCount.classes()).toContain('ai-input__character-count--error')
  })

  it('should auto-resize textarea', async () => {
    wrapper = mount(AIInput, {
      props: {
        autoResize: true,
        minRows: 1,
        maxRows: 4
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    
    // Single line
    await textarea.setValue('Single line')
    expect(textarea.attributes('rows')).toBe('1')

    // Multiple lines
    await textarea.setValue('Line 1\nLine 2\nLine 3')
    expect(textarea.attributes('rows')).toBe('3')
  })

  it('should submit on Enter key', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test message',
        submitOnEnter: true
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    await textarea.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('submit')?.[0]).toEqual(['Test message'])
  })

  it('should not submit on Shift+Enter', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test message',
        submitOnEnter: true
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })

    expect(wrapper.emitted('submit')).toBeFalsy()
  })

  it('should submit on Ctrl+Enter when submitOnEnter is false', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test message',
        submitOnEnter: false
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')?.[0]).toEqual(['Test message'])
  })

  it('should handle submit button click', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test message'
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    await submitButton.trigger('click')

    expect(wrapper.emitted('submit')?.[0]).toEqual(['Test message'])
  })

  it('should clear input after submit', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test message'
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    await submitButton.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
  })

  it('should show cancel button when loading', async () => {
    wrapper = mount(AIInput, {
      props: {
        isLoading: true,
        cancelText: 'Stop'
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    expect(submitButton.classes()).toContain('ai-input__submit-button--cancel')
    expect(submitButton.find('.ai-input__submit-text').text()).toBe('Stop')
    expect(submitButton.find('.ai-input__submit-icon').text()).toBe('⏹️')
  })

  it('should emit cancel when cancel button clicked', async () => {
    wrapper = mount(AIInput, {
      props: {
        isLoading: true
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    await submitButton.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('should disable submit when input is empty', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: ''
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    expect(submitButton.classes()).toContain('ai-input__submit-button--disabled')
    expect(submitButton.attributes('disabled')).toBeDefined()
  })

  it('should disable submit when there are validation errors', async () => {
    wrapper = mount(AIInput, {
      props: {
        modelValue: 'Test',
        minLength: 10
      }
    })

    const submitButton = wrapper.find('.ai-input__submit-button')
    expect(submitButton.classes()).toContain('ai-input__submit-button--disabled')
  })

  it('should show attachment button when enabled', () => {
    wrapper = mount(AIInput, {
      props: {
        allowAttachments: true
      }
    })

    const attachmentButton = wrapper.find('[title="Attach file"]')
    expect(attachmentButton.exists()).toBe(true)
  })

  it('should handle file attachment', async () => {
    wrapper = mount(AIInput, {
      props: {
        allowAttachments: true
      }
    })

    const attachmentButton = wrapper.find('[title="Attach file"]')
    await attachmentButton.trigger('click')

    // Should trigger file input click (tested via DOM interaction)
    const fileInput = wrapper.find('.ai-input__file-input')
    expect(fileInput.exists()).toBe(true)
  })

  it('should show voice input button when enabled', () => {
    wrapper = mount(AIInput, {
      props: {
        allowVoiceInput: true
      }
    })

    const voiceButton = wrapper.find('[title="Voice input"]')
    expect(voiceButton.exists()).toBe(true)
    expect(voiceButton.text()).toBe('🎤')
  })

  it('should handle voice input toggle', async () => {
    wrapper = mount(AIInput, {
      props: {
        allowVoiceInput: true
      }
    })

    const voiceButton = wrapper.find('[title="Voice input"]')
    await voiceButton.trigger('click')

    expect(wrapper.emitted('voiceStart')).toBeTruthy()
  })

  it('should show suggestions', async () => {
    wrapper = mount(AIInput, {
      props: {
        suggestions: ['Hello', 'How are you?', 'Thank you'],
        showFooter: true
      }
    })

    await nextTick()

    const suggestions = wrapper.findAll('.ai-input__suggestion-button')
    expect(suggestions).toHaveLength(3)
    expect(suggestions[0].text()).toBe('Hello')
    expect(suggestions[1].text()).toBe('How are you?')
    expect(suggestions[2].text()).toBe('Thank you')
  })

  it('should apply suggestion when clicked', async () => {
    wrapper = mount(AIInput, {
      props: {
        suggestions: ['Hello', 'How are you?'],
        showFooter: true
      }
    })

    await nextTick()

    const firstSuggestion = wrapper.find('.ai-input__suggestion-button')
    await firstSuggestion.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Hello'])
  })

  it('should show error message', async () => {
    wrapper = mount(AIInput, {
      props: {
        error: 'Network error occurred',
        showFooter: true
      }
    })

    await nextTick()

    const error = wrapper.find('.ai-input__error')
    expect(error.exists()).toBe(true)
    expect(error.find('.ai-input__error-text').text()).toBe('Network error occurred')
  })

  it('should show retry button on error', async () => {
    wrapper = mount(AIInput, {
      props: {
        error: 'Network error',
        showRetry: true,
        showFooter: true
      }
    })

    await nextTick()

    const retryButton = wrapper.find('.ai-input__retry-button')
    expect(retryButton.exists()).toBe(true)

    await retryButton.trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('should show keyboard shortcuts', async () => {
    wrapper = mount(AIInput, {
      props: {
        showShortcuts: true,
        showFooter: true,
        submitOnEnter: true
      }
    })

    await nextTick()

    const shortcuts = wrapper.find('.ai-input__shortcuts-text')
    expect(shortcuts.exists()).toBe(true)
    expect(shortcuts.text()).toContain('Enter to send, Shift+Enter for new line')
  })

  it('should show different shortcuts when submitOnEnter is false', async () => {
    wrapper = mount(AIInput, {
      props: {
        showShortcuts: true,
        showFooter: true,
        submitOnEnter: false
      }
    })

    await nextTick()

    const shortcuts = wrapper.find('.ai-input__shortcuts-text')
    expect(shortcuts.text()).toContain('Ctrl+Enter to send')
  })

  it('should emit focus and blur events', async () => {
    wrapper = mount(AIInput)

    const textarea = wrapper.find('.ai-input__textarea')
    
    await textarea.trigger('focus')
    expect(wrapper.emitted('focus')).toBeTruthy()

    await textarea.trigger('blur')
    expect(wrapper.emitted('blur')).toBeTruthy()
  })

  it('should be disabled when disabled prop is true', () => {
    wrapper = mount(AIInput, {
      props: {
        disabled: true
      }
    })

    expect(wrapper.find('.ai-input--disabled').exists()).toBe(true)
    expect(wrapper.find('.ai-input__textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.ai-input__submit-button').attributes('disabled')).toBeDefined()
  })

  it('should hide footer when showFooter is false', () => {
    wrapper = mount(AIInput, {
      props: {
        showFooter: false
      }
    })

    expect(wrapper.find('.ai-input__footer').exists()).toBe(false)
  })

  it('should expose methods', () => {
    wrapper = mount(AIInput)

    const vm = wrapper.vm
    expect(typeof vm.focus).toBe('function')
    expect(typeof vm.clear).toBe('function')
    expect(typeof vm.blur).toBe('function')
  })

  it('should handle paste events with files', async () => {
    wrapper = mount(AIInput, {
      props: {
        allowAttachments: true
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    
    // Mock clipboard data with file
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    const mockClipboardData = {
      items: [{
        kind: 'file',
        getAsFile: () => mockFile
      }]
    }

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: mockClipboardData as any
    })

    await textarea.element.dispatchEvent(pasteEvent)

    expect(wrapper.emitted('attachment')).toBeTruthy()
  })

  it('should truncate input when over max length', async () => {
    wrapper = mount(AIInput, {
      props: {
        maxLength: 10
      }
    })

    const textarea = wrapper.find('.ai-input__textarea')
    await textarea.setValue('This is a very long message that exceeds the limit')

    // Should be truncated to 10 characters
    expect(textarea.element.value).toBe('This is a ')
  })
})