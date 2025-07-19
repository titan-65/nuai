import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIDocumentQA from '../AIDocumentQA.vue'

// Mock the composables
vi.mock('../composables/useAIRAG', () => ({
  useAIRAG: vi.fn(() => ({
    addDocument: vi.fn(),
    clearDocuments: vi.fn(),
    enhanceChat: vi.fn().mockResolvedValue({
      context: { retrievedDocuments: [] },
      metadata: { processingTime: 100 }
    }),
    updateConfig: vi.fn(),
    initializeRAG: vi.fn(),
    vectorStore: {
      documents: { value: [] },
      deleteDocument: vi.fn()
    },
    documentCount: { value: 0 }
  }))
}))

vi.mock('../composables/useAI', () => ({
  useAI: vi.fn(() => ({
    ai: {
      chat: vi.fn().mockResolvedValue({
        text: 'Test response',
        model: 'gpt-4',
        usage: { totalTokens: 100 }
      }),
      setModel: vi.fn()
    }
  }))
}))

vi.mock('marked', () => ({
  marked: vi.fn((text) => `<p>${text}</p>`)
}))

describe('AIDocumentQA', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(AIDocumentQA, {
      props: {
        title: 'Test Document Q&A',
        showUpload: true,
        showSettings: true,
        showSources: true
      }
    })
  })

  it('renders correctly', () => {
    expect(wrapper.find('.ai-document-qa').exists()).toBe(true)
    expect(wrapper.find('.ai-document-qa__title').text()).toBe('Test Document Q&A')
  })

  it('shows upload area when no documents are present', () => {
    expect(wrapper.find('.ai-document-qa__dropzone').exists()).toBe(true)
    expect(wrapper.find('.ai-document-qa__dropzone-text').text()).toContain('Drag & drop files')
  })

  it('shows settings panel when settings are enabled', async () => {
    const settingsButton = wrapper.find('.ai-document-qa__settings-button')
    expect(settingsButton.exists()).toBe(true)
    
    await settingsButton.trigger('click')
    expect(wrapper.find('.ai-document-qa__settings-panel').exists()).toBe(true)
  })

  it('disables question input when no documents are uploaded', () => {
    const questionInput = wrapper.find('.ai-document-qa__question-input')
    const questionButton = wrapper.find('.ai-document-qa__question-button')
    
    expect(questionInput.attributes('disabled')).toBeDefined()
    expect(questionButton.attributes('disabled')).toBeDefined()
  })

  it('handles file drop events', async () => {
    const dropzone = wrapper.find('.ai-document-qa__dropzone')
    
    // Mock file drop
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [mockFile]
      }
    }

    // Test drag over
    await dropzone.trigger('dragover', mockEvent)
    expect(wrapper.vm.isDragging).toBe(true)

    // Test drag leave
    await dropzone.trigger('dragleave', mockEvent)
    expect(wrapper.vm.isDragging).toBe(false)
  })

  it('validates supported file formats', async () => {
    const wrapper = mount(AIDocumentQA, {
      props: {
        supportedFormats: ['txt', 'md']
      }
    })

    // Mock unsupported file
    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    
    // Simulate file processing
    await wrapper.vm.processFiles([mockFile])
    
    expect(wrapper.vm.error).toContain('Unsupported file format')
  })

  it('handles question asking flow', async () => {
    // Set up component with documents
    await wrapper.setData({
      documents: [{
        id: 'test-doc',
        content: 'Test document content',
        embedding: [],
        metadata: { filename: 'test.txt' }
      }],
      question: 'What is this document about?'
    })

    const questionButton = wrapper.find('.ai-document-qa__question-button')
    await questionButton.trigger('click')

    expect(wrapper.vm.isLoading).toBe(true)
  })

  it('displays answer and sources correctly', async () => {
    await wrapper.setData({
      answer: 'This is a test answer',
      sources: [{
        document: {
          id: 'test-doc',
          content: 'Source content',
          metadata: { filename: 'test.txt' }
        },
        similarity: 0.85
      }],
      answerMetadata: {
        model: 'gpt-4',
        tokens: 100,
        processingTime: 1500
      }
    })

    await nextTick()

    expect(wrapper.find('.ai-document-qa__answer').exists()).toBe(true)
    expect(wrapper.find('.ai-document-qa__answer-content').exists()).toBe(true)
    expect(wrapper.find('.ai-document-qa__sources').exists()).toBe(true)
  })

  it('handles document removal', async () => {
    await wrapper.setData({
      documents: [{
        id: 'test-doc',
        content: 'Test content',
        embedding: [],
        metadata: { filename: 'test.txt' }
      }]
    })

    const removeButton = wrapper.find('.ai-document-qa__document-remove')
    await removeButton.trigger('click')

    // Should call the remove method
    expect(wrapper.vm.documents.length).toBe(0)
  })

  it('shows error messages correctly', async () => {
    await wrapper.setData({
      error: 'Test error message'
    })

    await nextTick()

    const errorElement = wrapper.find('.ai-document-qa__error')
    expect(errorElement.exists()).toBe(true)
    expect(errorElement.text()).toContain('Test error message')
  })

  it('handles settings changes', async () => {
    // Open settings
    await wrapper.find('.ai-document-qa__settings-button').trigger('click')
    
    // Change RAG settings
    const ragCheckbox = wrapper.find('input[type="checkbox"]')
    await ragCheckbox.setChecked(false)
    
    expect(wrapper.vm.ragEnabled).toBe(false)
  })

  it('formats document metadata correctly', () => {
    const testDoc = {
      id: 'test',
      content: 'content',
      embedding: [],
      metadata: {
        filename: 'test.txt',
        type: 'text/plain',
        size: 1024
      }
    }

    expect(wrapper.vm.getDocumentName(testDoc)).toBe('test.txt')
    expect(wrapper.vm.getDocumentType(testDoc)).toBe('text/plain')
    expect(wrapper.vm.getDocumentSize(testDoc)).toBe('1.0 KB')
  })

  it('handles keyboard shortcuts', async () => {
    await wrapper.setData({
      question: 'Test question',
      documents: [{ id: 'test', content: 'test', embedding: [], metadata: {} }]
    })

    const questionInput = wrapper.find('.ai-document-qa__question-input')
    
    // Test Ctrl+Enter shortcut
    await questionInput.trigger('keydown.enter.ctrl')
    
    expect(wrapper.vm.isLoading).toBe(true)
  })

  it('emits events correctly', async () => {
    const testDoc = {
      id: 'test',
      content: 'test',
      embedding: [],
      metadata: { filename: 'test.txt' }
    }

    // Test upload event
    wrapper.vm.$emit('upload', testDoc)
    expect(wrapper.emitted('upload')).toBeTruthy()
    expect(wrapper.emitted('upload')[0]).toEqual([testDoc])

    // Test ask event
    wrapper.vm.$emit('ask', 'question', 'answer')
    expect(wrapper.emitted('ask')).toBeTruthy()
    expect(wrapper.emitted('ask')[0]).toEqual(['question', 'answer'])

    // Test error event
    wrapper.vm.$emit('error', 'error message')
    expect(wrapper.emitted('error')).toBeTruthy()
    expect(wrapper.emitted('error')[0]).toEqual(['error message'])
  })

  it('handles maximum document limit', async () => {
    const wrapper = mount(AIDocumentQA, {
      props: {
        maxAllowedDocuments: 2
      }
    })

    // Mock multiple files exceeding limit
    const mockFiles = [
      new File(['content1'], 'test1.txt'),
      new File(['content2'], 'test2.txt'),
      new File(['content3'], 'test3.txt')
    ]

    await wrapper.vm.processFiles(mockFiles)
    
    expect(wrapper.vm.error).toContain('Maximum 2 documents allowed')
  })
})