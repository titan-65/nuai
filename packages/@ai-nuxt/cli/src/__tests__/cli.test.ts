import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { runCLI } from '../commands'
import { getConfig, updateConfig, resetConfig } from '../config'
import { createAgent, listAgents, deleteAgent } from '../agents'
import { createPrompt, listPrompts, deletePrompt } from '../prompt-templates'

// Mock external dependencies
vi.mock('fs-extra')
vi.mock('execa')
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis()
  }))
}))

describe('AI Nuxt CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetConfig()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Configuration Management', () => {
    it('should get default configuration', () => {
      const config = getConfig()
      expect(config.defaultProvider).toBe('openai')
    })

    it('should update configuration', () => {
      updateConfig({ defaultProvider: 'anthropic' })
      const config = getConfig()
      expect(config.defaultProvider).toBe('anthropic')
    })

    it('should reset configuration', () => {
      updateConfig({ defaultProvider: 'anthropic' })
      resetConfig()
      const config = getConfig()
      expect(config.defaultProvider).toBe('openai')
    })
  })

  describe('Agent Management', () => {
    beforeEach(() => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined)
      vi.mocked(fs.pathExists).mockResolvedValue(false)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.readdir).mockResolvedValue([])
    })

    it('should create a new agent', async () => {
      await createAgent({
        name: 'TestAgent',
        type: 'assistant',
        description: 'A test agent',
        capabilities: ['canUseTool', 'canCommunicate']
      })

      expect(fs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('agents')
      )
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('TestAgent.ts'),
        expect.stringContaining('TestAgent')
      )
    })

    it('should list agents', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true)
      vi.mocked(fs.readdir).mockResolvedValue(['TestAgent.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(`
        export const TestAgent = defineAgent({
          name: 'TestAgent',
          description: 'A test agent',
          capabilities: ['canUseTool']
        })
      `)

      const agents = await listAgents()
      expect(agents).toHaveLength(1)
      expect(agents[0].name).toBe('TestAgent')
    })

    it('should delete an agent', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true)
      vi.mocked(fs.remove).mockResolvedValue(undefined)

      await deleteAgent('TestAgent')
      expect(fs.remove).toHaveBeenCalledWith(
        expect.stringContaining('TestAgent.ts')
      )
    })

    it('should throw error when deleting non-existent agent', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false)

      await expect(deleteAgent('NonExistentAgent')).rejects.toThrow(
        'Agent NonExistentAgent not found'
      )
    })
  })

  describe('Prompt Template Management', () => {
    beforeEach(() => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined)
      vi.mocked(fs.pathExists).mockResolvedValue(false)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.readdir).mockResolvedValue([])
    })

    it('should create a new prompt template', async () => {
      await createPrompt({
        name: 'testPrompt',
        type: 'chat',
        description: 'A test prompt',
        content: 'You are a helpful assistant'
      })

      expect(fs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining('prompts')
      )
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('testPrompt.ts'),
        expect.stringContaining('testPrompt')
      )
    })

    it('should list prompt templates', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true)
      vi.mocked(fs.readdir).mockResolvedValue(['testPrompt.ts'])
      vi.mocked(fs.readFile).mockResolvedValue(`
        export const testPrompt = {
          name: 'testPrompt',
          description: 'A test prompt',
          type: 'chat'
        }
      `)

      const prompts = await listPrompts()
      expect(prompts).toHaveLength(1)
      expect(prompts[0].name).toBe('testPrompt')
    })

    it('should delete a prompt template', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(true)
      vi.mocked(fs.remove).mockResolvedValue(undefined)

      await deletePrompt('testPrompt')
      expect(fs.remove).toHaveBeenCalledWith(
        expect.stringContaining('testPrompt.ts')
      )
    })
  })

  describe('Validation', () => {
    it('should validate project names', () => {
      const { validateProjectName } = require('../utils/validation')
      
      expect(validateProjectName('my-app').valid).toBe(true)
      expect(validateProjectName('MyApp').valid).toBe(false)
      expect(validateProjectName('my_app').valid).toBe(false)
      expect(validateProjectName('').valid).toBe(false)
    })

    it('should validate component names', () => {
      const { validateComponentName } = require('../utils/validation')
      
      expect(validateComponentName('MyComponent').valid).toBe(true)
      expect(validateComponentName('myComponent').valid).toBe(false)
      expect(validateComponentName('my-component').valid).toBe(false)
      expect(validateComponentName('').valid).toBe(false)
    })

    it('should validate API keys', () => {
      const { validateApiKey } = require('../utils/validation')
      
      expect(validateApiKey('sk-1234567890', 'openai').valid).toBe(true)
      expect(validateApiKey('sk-ant-1234567890', 'anthropic').valid).toBe(true)
      expect(validateApiKey('invalid-key', 'openai').valid).toBe(false)
      expect(validateApiKey('', 'openai').valid).toBe(false)
    })
  })

  describe('File Operations', () => {
    it('should check file existence', async () => {
      const { fileExists } = require('../utils/file-utils')
      
      vi.mocked(fs.access).mockResolvedValue(undefined)
      expect(await fileExists('test.txt')).toBe(true)
      
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'))
      expect(await fileExists('nonexistent.txt')).toBe(false)
    })

    it('should read JSON files safely', async () => {
      const { readJsonFile } = require('../utils/file-utils')
      
      vi.mocked(fs.readFile).mockResolvedValue('{"test": true}')
      const result = await readJsonFile('test.json')
      expect(result).toEqual({ test: true })
      
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))
      const nullResult = await readJsonFile('nonexistent.json')
      expect(nullResult).toBeNull()
    })
  })

  describe('Formatting Utilities', () => {
    it('should format durations correctly', () => {
      const { formatDuration } = require('../utils/formatting')
      
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(1500)).toBe('1s')
      expect(formatDuration(65000)).toBe('1m 5s')
      expect(formatDuration(3665000)).toBe('1h 1m')
    })

    it('should format bytes correctly', () => {
      const { formatBytes } = require('../utils/formatting')
      
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1048576)).toBe('1 MB')
      expect(formatBytes(1073741824)).toBe('1 GB')
    })

    it('should convert case correctly', () => {
      const { camelToKebab, kebabToCamel, camelToPascal } = require('../utils/formatting')
      
      expect(camelToKebab('myVariableName')).toBe('my-variable-name')
      expect(kebabToCamel('my-variable-name')).toBe('myVariableName')
      expect(camelToPascal('myVariableName')).toBe('MyVariableName')
    })
  })

  describe('Template Generation', () => {
    it('should generate project templates', () => {
      const { getProjectTemplate } = require('../templates/project-templates')
      
      const basicTemplate = getProjectTemplate('basic')
      expect(basicTemplate['package.json']).toContain('@ai-nuxt/module')
      expect(basicTemplate['nuxt.config.ts']).toContain('aiNuxt')
      
      const chatTemplate = getProjectTemplate('chat')
      expect(chatTemplate['pages/index.vue']).toContain('AIChat')
    })

    it('should generate component templates', () => {
      const { getComponentTemplate } = require('../templates/component-templates')
      
      const chatComponent = getComponentTemplate('chat', 'MyChat')
      expect(chatComponent).toContain('ai-chat-container')
      expect(chatComponent).toContain('useAI')
      
      const completionComponent = getComponentTemplate('completion', 'MyCompletion')
      expect(completionComponent).toContain('ai-completion-container')
      expect(completionComponent).toContain('completion')
    })

    it('should generate agent templates', () => {
      const { getAgentTemplate } = require('../templates/agent-templates')
      
      const assistantAgent = getAgentTemplate('assistant', 'MyAssistant')
      expect(assistantAgent).toContain('defineAgent')
      expect(assistantAgent).toContain('MyAssistant')
      expect(assistantAgent).toContain('canUseTool')
      
      const coderAgent = getAgentTemplate('coder', 'MyCoder')
      expect(coderAgent).toContain('coding assistant')
      expect(coderAgent).toContain('generateCode')
    })

    it('should generate prompt templates', () => {
      const { getPromptTemplate } = require('../templates/prompt-templates')
      
      const chatPrompt = getPromptTemplate('chat', 'myChatPrompt')
      expect(chatPrompt).toContain('myChatPrompt')
      expect(chatPrompt).toContain('systemPrompt')
      expect(chatPrompt).toContain('generateMessages')
      
      const completionPrompt = getPromptTemplate('completion', 'myCompletionPrompt')
      expect(completionPrompt).toContain('myCompletionPrompt')
      expect(completionPrompt).toContain('baseInstructions')
    })
  })

  describe('Error Handling', () => {
    it('should handle CLI errors gracefully', async () => {
      const { CLIError, ValidationError, FileSystemError } = require('../types')
      
      const cliError = new CLIError('Test error', 'TEST_ERROR')
      expect(cliError.name).toBe('CLIError')
      expect(cliError.code).toBe('TEST_ERROR')
      
      const validationError = new ValidationError('Invalid input', 'name')
      expect(validationError.name).toBe('ValidationError')
      expect(validationError.field).toBe('name')
      
      const fsError = new FileSystemError('File not found', '/path/to/file')
      expect(fsError.name).toBe('FileSystemError')
      expect(fsError.path).toBe('/path/to/file')
    })
  })
})