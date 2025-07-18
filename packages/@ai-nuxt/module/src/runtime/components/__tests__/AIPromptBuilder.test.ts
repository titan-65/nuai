import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import AIPromptBuilder from '../AIPromptBuilder.vue'
import type { PromptTemplate, PromptPart } from '../AIPromptBuilder.vue'

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

describe('AIPromptBuilder', () => {
  let wrapper: VueWrapper<any>

  const mockTemplate: PromptTemplate = {
    id: 'test-template',
    name: 'Test Template',
    category: 'testing',
    description: 'A template for testing',
    parts: [
      {
        id: '1',
        type: 'system',
        content: 'You are a test assistant.'
      },
      {
        id: '2',
        type: 'task',
        content: 'Help with testing.'
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  it('should render with default props', () => {
    wrapper = mount(AIPromptBuilder)

    expect(wrapper.find('.ai-prompt-builder').exists()).toBe(true)
    expect(wrapper.find('.ai-prompt-builder__title').text()).toBe('Prompt Builder')
    expect(wrapper.find('.ai-prompt-builder__empty').exists()).toBe(true)
  })

  it('should render with custom title', () => {
    wrapper = mount(AIPromptBuilder, {
      props: {
        title: 'Custom Prompt Builder'
      }
    })

    expect(wrapper.find('.ai-prompt-builder__title').text()).toBe('Custom Prompt Builder')
  })

  it('should display default templates', async () => {
    wrapper = mount(AIPromptBuilder)
    await nextTick()

    const templates = wrapper.findAll('.ai-prompt-builder__template')
    expect(templates.length).toBeGreaterThan(0)
    
    // Check for default templates
    const templateNames = templates.map(t => t.find('.ai-prompt-builder__template-name').text())
    expect(templateNames).toContain('Writing Assistant')
    expect(templateNames).toContain('Code Reviewer')
    expect(templateNames).toContain('Data Analyst')
  })

  it('should display custom templates', async () => {
    wrapper = mount(AIPromptBuilder, {
      props: {
        templates: [mockTemplate]
      }
    })
    await nextTick()

    const templates = wrapper.findAll('.ai-prompt-builder__template')
    const customTemplate = templates.find(t => 
      t.find('.ai-prompt-builder__template-name').text() === 'Test Template'
    )
    
    expect(customTemplate).toBeTruthy()
    expect(customTemplate?.find('.ai-prompt-builder__template-description').text()).toBe('A template for testing')
  })

  it('should select template when clicked', async () => {
    wrapper = mount(AIPromptBuilder, {
      props: {
        templates: [mockTemplate]
      }
    })
    await nextTick()

    const template = wrapper.find('.ai-prompt-builder__template')
    await template.trigger('click')

    expect(wrapper.emitted('template-select')).toBeTruthy()
    expect(wrapper.emitted('template-select')?.[0]).toEqual([mockTemplate])
    
    // Should load template parts
    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(2)
  })

  it('should display prompt elements for dragging', () => {
    wrapper = mount(AIPromptBuilder)

    const elements = wrapper.findAll('.ai-prompt-builder__element')
    expect(elements.length).toBeGreaterThan(0)
    
    const elementNames = elements.map(e => e.find('.ai-prompt-builder__element-name').text())
    expect(elementNames).toContain('System Message')
    expect(elementNames).toContain('Context')
    expect(elementNames).toContain('Task')
    expect(elementNames).toContain('Examples')
    expect(elementNames).toContain('Constraints')
    expect(elementNames).toContain('Output Format')
    expect(elementNames).toContain('Custom')
  })

  it('should handle drag and drop', async () => {
    wrapper = mount(AIPromptBuilder)

    const canvas = wrapper.find('.ai-prompt-builder__canvas')
    
    // Simulate drop event
    const dropEvent = new DragEvent('drop', {
      dataTransfer: new DataTransfer()
    })
    dropEvent.dataTransfer?.setData('text/plain', 'system')
    
    await canvas.element.dispatchEvent(dropEvent)
    await nextTick()

    // Should add a new part
    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(1)
    expect(parts[0].find('.ai-prompt-builder__part-title').text()).toBe('System Message')
  })

  it('should handle drag over states', async () => {
    wrapper = mount(AIPromptBuilder)

    const canvas = wrapper.find('.ai-prompt-builder__canvas')
    
    // Simulate drag enter
    await canvas.trigger('dragenter')
    expect(canvas.classes()).toContain('ai-prompt-builder__canvas--drag-over')
    
    // Simulate drag leave
    await canvas.trigger('dragleave')
    expect(canvas.classes()).not.toContain('ai-prompt-builder__canvas--drag-over')
  })

  it('should edit system message part', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a system part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const textarea = wrapper.find('.ai-prompt-builder__textarea')
    await textarea.setValue('You are a helpful assistant.')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('SYSTEM: You are a helpful assistant.')
  })

  it('should handle examples part', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add examples part
    const vm = wrapper.vm
    vm.addPart('examples')
    await nextTick()

    const inputs = wrapper.findAll('.ai-prompt-builder__input')
    expect(inputs.length).toBeGreaterThan(0)

    // Add example
    const addButton = wrapper.find('.ai-prompt-builder__add-example')
    await addButton.trigger('click')

    const newInputs = wrapper.findAll('.ai-prompt-builder__input')
    expect(newInputs.length).toBeGreaterThan(inputs.length)
  })

  it('should handle constraints part', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add constraints part
    const vm = wrapper.vm
    vm.addPart('constraints')
    await nextTick()

    const addButton = wrapper.find('.ai-prompt-builder__add-constraint')
    await addButton.trigger('click')

    const inputs = wrapper.findAll('.ai-prompt-builder__input')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('should handle output format part', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add output part
    const vm = wrapper.vm
    vm.addPart('output')
    await nextTick()

    const select = wrapper.find('.ai-prompt-builder__select')
    await select.setValue('json')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('OUTPUT FORMAT: JSON')
  })

  it('should move parts up and down', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add two parts
    const vm = wrapper.vm
    vm.addPart('system')
    vm.addPart('task')
    await nextTick()

    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(2)

    // Move second part up
    const moveUpButton = parts[1].find('[title="Move up"]')
    await moveUpButton.trigger('click')

    // Parts should be reordered
    const reorderedParts = wrapper.findAll('.ai-prompt-builder__part')
    expect(reorderedParts[0].find('.ai-prompt-builder__part-title').text()).toBe('Task')
    expect(reorderedParts[1].find('.ai-prompt-builder__part-title').text()).toBe('System Message')
  })

  it('should duplicate parts', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const duplicateButton = wrapper.find('[title="Duplicate"]')
    await duplicateButton.trigger('click')

    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(2)
  })

  it('should remove parts', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const removeButton = wrapper.find('[title="Remove"]')
    await removeButton.trigger('click')

    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(0)
  })

  it('should clear all parts', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add parts
    const vm = wrapper.vm
    vm.addPart('system')
    vm.addPart('task')
    await nextTick()

    const clearButton = wrapper.find('.ai-prompt-builder__action-button--secondary')
    await clearButton.trigger('click')

    const parts = wrapper.findAll('.ai-prompt-builder__part')
    expect(parts).toHaveLength(0)
  })

  it('should copy prompt to clipboard', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part with content
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const textarea = wrapper.find('.ai-prompt-builder__textarea')
    await textarea.setValue('Test content')

    const copyButton = wrapper.find('[title="Copy to clipboard"]')
    await copyButton.trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('SYSTEM: Test content')
    )
  })

  it('should export prompt', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const exportButton = wrapper.find('.ai-prompt-builder__action-button--primary')
    await exportButton.trigger('click')

    expect(wrapper.emitted('export')).toBeTruthy()
    const exportData = wrapper.emitted('export')?.[0]
    expect(exportData?.[0]).toContain('SYSTEM:')
    expect(exportData?.[1]).toHaveLength(1) // One part
  })

  it('should toggle preview mode', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const toggleButton = wrapper.find('[title="Show raw"]')
    await toggleButton.trigger('click')

    const rawPreview = wrapper.find('.ai-prompt-builder__preview-raw')
    expect(rawPreview.exists()).toBe(true)
  })

  it('should open save template modal', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part to enable save
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const saveButton = wrapper.findAll('.ai-prompt-builder__action-button--secondary')[1] // Second secondary button is save
    await saveButton.trigger('click')

    const modal = wrapper.find('.ai-prompt-builder__modal')
    expect(modal.exists()).toBe(true)
  })

  it('should save custom template', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    // Open save modal
    const saveButton = wrapper.findAll('.ai-prompt-builder__action-button--secondary')[1]
    await saveButton.trigger('click')

    // Fill in template details
    const nameInput = wrapper.find('.ai-prompt-builder__modal input')
    await nameInput.setValue('My Custom Template')

    const descriptionTextarea = wrapper.find('.ai-prompt-builder__modal textarea')
    await descriptionTextarea.setValue('A custom template for testing')

    // Save template
    const confirmButton = wrapper.find('.ai-prompt-builder__modal .ai-prompt-builder__action-button--primary')
    await confirmButton.trigger('click')

    expect(wrapper.emitted('template-save')).toBeTruthy()
    const savedTemplate = wrapper.emitted('template-save')?.[0]?.[0] as PromptTemplate
    expect(savedTemplate.name).toBe('My Custom Template')
    expect(savedTemplate.description).toBe('A custom template for testing')
  })

  it('should close save modal', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part and open modal
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const saveButton = wrapper.findAll('.ai-prompt-builder__action-button--secondary')[1]
    await saveButton.trigger('click')

    // Close modal
    const closeButton = wrapper.find('.ai-prompt-builder__modal-close')
    await closeButton.trigger('click')

    const modal = wrapper.find('.ai-prompt-builder__modal')
    expect(modal.exists()).toBe(false)
  })

  it('should be disabled when disabled prop is true', () => {
    wrapper = mount(AIPromptBuilder, {
      props: {
        disabled: true
      }
    })

    const actionButtons = wrapper.findAll('.ai-prompt-builder__action-button')
    actionButtons.forEach(button => {
      expect(button.attributes('disabled')).toBeDefined()
    })
  })

  it('should emit modelValue updates', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add a part and modify it
    const vm = wrapper.vm
    vm.addPart('system')
    await nextTick()

    const textarea = wrapper.find('.ai-prompt-builder__textarea')
    await textarea.setValue('Test system message')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('SYSTEM: Test system message')
  })

  it('should handle custom part with title', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add custom part
    const vm = wrapper.vm
    vm.addPart('custom')
    await nextTick()

    const titleInput = wrapper.find('.ai-prompt-builder__input')
    await titleInput.setValue('Custom Section')

    const textarea = wrapper.find('.ai-prompt-builder__textarea')
    await textarea.setValue('Custom content here')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('CUSTOM SECTION:\nCustom content here')
  })

  it('should expose methods', () => {
    wrapper = mount(AIPromptBuilder)

    const vm = wrapper.vm
    expect(typeof vm.clearPrompt).toBe('function')
    expect(typeof vm.addPart).toBe('function')
    expect(typeof vm.loadTemplate).toBe('function')
    expect(typeof vm.exportPrompt).toBe('function')
  })

  it('should handle empty examples and constraints', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add examples part
    const vm = wrapper.vm
    vm.addPart('examples')
    await nextTick()

    // Don't fill in examples, should not appear in prompt
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).not.toContain('EXAMPLES:')
  })

  it('should remove examples and constraints', async () => {
    wrapper = mount(AIPromptBuilder)

    // Add examples part
    const vm = wrapper.vm
    vm.addPart('examples')
    await nextTick()

    // Add an example first
    const addButton = wrapper.find('.ai-prompt-builder__add-example')
    await addButton.trigger('click')

    // Remove the first example
    const removeButton = wrapper.find('.ai-prompt-builder__remove-example')
    await removeButton.trigger('click')

    // Should still have one example (the original one)
    const examples = wrapper.findAll('.ai-prompt-builder__example')
    expect(examples).toHaveLength(1)
  })

  it('should format different part types correctly', async () => {
    wrapper = mount(AIPromptBuilder)

    const vm = wrapper.vm
    
    // Test system part
    vm.addPart('system')
    await nextTick()
    let textarea = wrapper.find('.ai-prompt-builder__textarea')
    await textarea.setValue('System message')
    
    let lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('SYSTEM: System message')

    // Test context part
    vm.addPart('context')
    await nextTick()
    const textareas = wrapper.findAll('.ai-prompt-builder__textarea')
    await textareas[1].setValue('Context information')
    
    lastEmit = wrapper.emitted('update:modelValue')?.slice(-1)[0]
    expect(lastEmit?.[0]).toContain('CONTEXT:\nContext information')
  })
})