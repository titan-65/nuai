import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DefaultAIAgent, DefaultAgentRegistry, DefaultAgentFactory } from '../agent-implementation'
import type { AgentConfig, AgentTool, AIProvider } from '../agents'

// Mock AI Provider
const mockProvider: AIProvider = {
  name: 'mock',
  chat: vi.fn().mockResolvedValue({
    text: 'Mock response',
    model: 'mock-model',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
  }),
  completion: vi.fn().mockResolvedValue({
    text: 'Mock completion',
    model: 'mock-model'
  }),
  embedding: vi.fn().mockResolvedValue({
    embedding: [0.1, 0.2, 0.3],
    model: 'mock-embedding'
  }),
  stream: vi.fn()
}

// Mock agent configuration
const mockAgentConfig: AgentConfig = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent',
  role: 'test assistant',
  systemPrompt: 'You are a test assistant.',
  capabilities: {
    canUseTool: true,
    canCommunicate: true,
    canMakeDecisions: true,
    canLearn: false,
    maxExecutionTime: 30000
  },
  tools: [],
  provider: {
    name: 'mock',
    model: 'mock-model',
    temperature: 0.7
  },
  active: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
}

// Mock tool
const mockTool: AgentTool = {
  id: 'test-tool',
  name: 'Test Tool',
  description: 'A test tool',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    }
  },
  execute: vi.fn().mockResolvedValue('Tool result')
}

describe('DefaultAIAgent', () => {
  let agent: DefaultAIAgent

  beforeEach(() => {
    agent = new DefaultAIAgent(mockAgentConfig, mockProvider)
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.config).toEqual(mockAgentConfig)
      expect(agent.provider).toBe(mockProvider)
      expect(agent.tools.size).toBe(0)
    })

    it('should have initial idle status', () => {
      const status = agent.getStatus()
      expect(status.state).toBe('idle')
      expect(status.metrics.totalExecutions).toBe(0)
      expect(status.metrics.successfulExecutions).toBe(0)
      expect(status.metrics.failedExecutions).toBe(0)
    })
  })

  describe('tool management', () => {
    it('should add tools correctly', () => {
      agent.addTool(mockTool)
      expect(agent.tools.has('test-tool')).toBe(true)
      expect(agent.tools.get('test-tool')).toBe(mockTool)
    })

    it('should remove tools correctly', () => {
      agent.addTool(mockTool)
      agent.removeTool('test-tool')
      expect(agent.tools.has('test-tool')).toBe(false)
    })
  })

  describe('configuration updates', () => {
    it('should update configuration correctly', () => {
      const updates = { name: 'Updated Agent', temperature: 0.5 }
      const originalUpdatedAt = agent.config.updatedAt
      
      agent.updateConfig(updates)
      
      expect(agent.config.name).toBe('Updated Agent')
      expect(agent.config.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })

    it('should emit config update event', () => {
      const eventSpy = vi.fn()
      agent.on('config:update', eventSpy)
      
      const updates = { name: 'Updated Agent' }
      agent.updateConfig(updates)
      
      expect(eventSpy).toHaveBeenCalledWith({
        agent,
        oldConfig: expect.objectContaining({ name: 'Test Agent' }),
        newConfig: expect.objectContaining({ name: 'Updated Agent' })
      })
    })
  })

  describe('execution', () => {
    it('should execute successfully without tools', async () => {
      const result = await agent.execute('Test input')
      
      expect(result.success).toBe(true)
      expect(result.output).toBe('Mock response')
      expect(result.context.state).toBe('completed')
      expect(result.metadata.stepCount).toBeGreaterThan(0)
      
      expect(mockProvider.chat).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: expect.stringContaining('You are a test assistant') },
          { role: 'user', content: 'Test input' }
        ],
        model: 'mock-model',
        temperature: 0.7,
        maxTokens: undefined
      })
    })

    it('should execute with tools when available', async () => {
      agent.addTool(mockTool)
      
      // Mock provider to return tool calls
      mockProvider.chat = vi.fn().mockResolvedValue({
        text: 'Mock response with tools',
        toolCalls: [{
          function: {
            name: 'test-tool',
            arguments: { input: 'test' }
          }
        }]
      })

      const result = await agent.execute('Test input with tools')
      
      expect(result.success).toBe(true)
      expect(mockTool.execute).toHaveBeenCalledWith(
        { input: 'test' },
        expect.objectContaining({ agentId: 'test-agent' })
      )
    })

    it('should handle execution errors', async () => {
      mockProvider.chat = vi.fn().mockRejectedValue(new Error('Provider error'))
      
      const result = await agent.execute('Test input')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('Provider error')
      expect(result.context.state).toBe('error')
    })

    it('should update metrics after execution', async () => {
      await agent.execute('Test input')
      
      const status = agent.getStatus()
      expect(status.metrics.totalExecutions).toBe(1)
      expect(status.metrics.successfulExecutions).toBe(1)
      expect(status.metrics.averageExecutionTime).toBeGreaterThan(0)
    })

    it('should emit execution events', async () => {
      const startSpy = vi.fn()
      const stepSpy = vi.fn()
      const completeSpy = vi.fn()
      
      agent.on('execution:start', startSpy)
      agent.on('execution:step', stepSpy)
      agent.on('execution:complete', completeSpy)
      
      await agent.execute('Test input')
      
      expect(startSpy).toHaveBeenCalled()
      expect(stepSpy).toHaveBeenCalled()
      expect(completeSpy).toHaveBeenCalled()
    })
  })

  describe('execution control', () => {
    it('should stop execution', async () => {
      // Start execution in background
      const executionPromise = agent.execute('Long running task')
      
      // Stop immediately
      await agent.stop()
      
      const result = await executionPromise
      expect(agent.getStatus().state).toBe('idle')
    })

    it('should pause and resume execution', async () => {
      const pauseSpy = vi.fn()
      const resumeSpy = vi.fn()
      
      agent.on('execution:pause', pauseSpy)
      agent.on('execution:resume', resumeSpy)
      
      // These methods would need more complex implementation for real pause/resume
      await agent.pause()
      expect(agent.getStatus().state).toBe('paused')
      
      await agent.resume()
      expect(agent.getStatus().state).toBe('running')
      
      expect(pauseSpy).toHaveBeenCalled()
      expect(resumeSpy).toHaveBeenCalled()
    })
  })
})

describe('DefaultAgentRegistry', () => {
  let registry: DefaultAgentRegistry

  beforeEach(() => {
    registry = new DefaultAgentRegistry()
  })

  describe('agent registration', () => {
    it('should register agents', async () => {
      // Mock the provider resolution
      registry['resolveProvider'] = vi.fn().mockResolvedValue(mockProvider)
      
      const agent = await registry.register(mockAgentConfig)
      
      expect(agent).toBeInstanceOf(DefaultAIAgent)
      expect(registry.get('test-agent')).toBe(agent)
    })

    it('should prevent duplicate registration', async () => {
      registry['resolveProvider'] = vi.fn().mockResolvedValue(mockProvider)
      
      await registry.register(mockAgentConfig)
      
      await expect(registry.register(mockAgentConfig))
        .rejects.toThrow('Agent with ID test-agent already exists')
    })

    it('should unregister agents', async () => {
      registry['resolveProvider'] = vi.fn().mockResolvedValue(mockProvider)
      
      const agent = await registry.register(mockAgentConfig)
      const stopSpy = vi.spyOn(agent, 'stop')
      
      await registry.unregister('test-agent')
      
      expect(registry.get('test-agent')).toBeUndefined()
      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('agent queries', () => {
    beforeEach(async () => {
      registry['resolveProvider'] = vi.fn().mockResolvedValue(mockProvider)
      await registry.register(mockAgentConfig)
      await registry.register({
        ...mockAgentConfig,
        id: 'test-agent-2',
        name: 'Test Agent 2',
        role: 'different role'
      })
    })

    it('should list all agents', () => {
      const agents = registry.list()
      expect(agents).toHaveLength(2)
    })

    it('should find agents by criteria', () => {
      const agents = registry.find({ role: 'test assistant' })
      expect(agents).toHaveLength(1)
      expect(agents[0].config.id).toBe('test-agent')
    })

    it('should get agent status', () => {
      const status = registry.getStatus('test-agent')
      expect(status).toBeDefined()
      expect(status?.id).toBe('test-agent')
    })

    it('should provide registry statistics', () => {
      const stats = registry.getStats()
      expect(stats.totalAgents).toBe(2)
      expect(stats.activeAgents).toBe(2)
      expect(stats.runningAgents).toBe(0)
    })
  })

  describe('agent updates', () => {
    beforeEach(async () => {
      registry['resolveProvider'] = vi.fn().mockResolvedValue(mockProvider)
      await registry.register(mockAgentConfig)
    })

    it('should update agent configuration', async () => {
      await registry.update('test-agent', { name: 'Updated Agent' })
      
      const agent = registry.get('test-agent')
      expect(agent?.config.name).toBe('Updated Agent')
    })

    it('should throw error for non-existent agent', async () => {
      await expect(registry.update('non-existent', { name: 'Updated' }))
        .rejects.toThrow('Agent with ID non-existent not found')
    })
  })
})

describe('DefaultAgentFactory', () => {
  let factory: DefaultAgentFactory
  let mockProviderFactory: any

  beforeEach(() => {
    mockProviderFactory = {
      create: vi.fn().mockResolvedValue(mockProvider)
    }
    factory = new DefaultAgentFactory(mockProviderFactory)
  })

  describe('agent creation', () => {
    it('should create agent from valid configuration', async () => {
      const agent = await factory.create(mockAgentConfig)
      
      expect(agent).toBeInstanceOf(DefaultAIAgent)
      expect(agent.config).toEqual(mockAgentConfig)
    })

    it('should reject invalid configuration', async () => {
      const invalidConfig = { ...mockAgentConfig, id: '' }
      
      await expect(factory.create(invalidConfig))
        .rejects.toThrow('Invalid agent configuration')
    })
  })

  describe('template-based creation', () => {
    it('should create agent from template', async () => {
      const agent = await factory.createFromTemplate('assistant', {
        id: 'custom-assistant'
      })
      
      expect(agent).toBeInstanceOf(DefaultAIAgent)
      expect(agent.config.id).toBe('custom-assistant')
      expect(agent.config.role).toBe('helpful assistant')
    })

    it('should throw error for non-existent template', async () => {
      await expect(factory.createFromTemplate('non-existent'))
        .rejects.toThrow('Template non-existent not found')
    })
  })

  describe('configuration validation', () => {
    it('should validate correct configuration', async () => {
      const result = await factory.validateConfig(mockAgentConfig)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', async () => {
      const invalidConfig = { ...mockAgentConfig, name: '', systemPrompt: '' }
      const result = await factory.validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Agent name is required')
      expect(result.errors).toContain('System prompt is required')
    })

    it('should validate capability constraints', async () => {
      const invalidConfig = {
        ...mockAgentConfig,
        capabilities: {
          ...mockAgentConfig.capabilities,
          maxExecutionTime: -1000
        }
      }
      
      const result = await factory.validateConfig(invalidConfig)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Max execution time must be positive')
    })
  })
})

describe('Agent Tool Execution', () => {
  let agent: DefaultAIAgent

  beforeEach(() => {
    agent = new DefaultAIAgent(mockAgentConfig, mockProvider)
  })

  it('should execute tools with proper context', async () => {
    const toolSpy = vi.fn().mockResolvedValue('Tool result')
    const tool: AgentTool = {
      ...mockTool,
      execute: toolSpy
    }
    
    agent.addTool(tool)
    
    // Mock provider to return tool calls
    mockProvider.chat = vi.fn().mockResolvedValue({
      text: 'Response with tool',
      toolCalls: [{
        function: {
          name: 'test-tool',
          arguments: { input: 'test data' }
        }
      }]
    })

    await agent.execute('Use the tool')
    
    expect(toolSpy).toHaveBeenCalledWith(
      { input: 'test data' },
      expect.objectContaining({
        agentId: 'test-agent',
        state: 'running'
      })
    )
  })

  it('should handle tool execution errors', async () => {
    const errorTool: AgentTool = {
      ...mockTool,
      execute: vi.fn().mockRejectedValue(new Error('Tool failed'))
    }
    
    agent.addTool(errorTool)
    
    mockProvider.chat = vi.fn().mockResolvedValue({
      text: 'Response with failing tool',
      toolCalls: [{
        function: {
          name: 'test-tool',
          arguments: { input: 'test' }
        }
      }]
    })

    const result = await agent.execute('Use failing tool')
    
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('TOOL_EXECUTION_ERROR')
  })

  it('should emit tool events', async () => {
    const toolCallSpy = vi.fn()
    const toolResultSpy = vi.fn()
    const toolErrorSpy = vi.fn()
    
    agent.on('tool:call', toolCallSpy)
    agent.on('tool:result', toolResultSpy)
    agent.on('tool:error', toolErrorSpy)
    
    agent.addTool(mockTool)
    
    mockProvider.chat = vi.fn().mockResolvedValue({
      text: 'Response with tool',
      toolCalls: [{
        function: {
          name: 'test-tool',
          arguments: { input: 'test' }
        }
      }]
    })

    await agent.execute('Use tool')
    
    expect(toolCallSpy).toHaveBeenCalled()
    expect(toolResultSpy).toHaveBeenCalled()
    expect(toolErrorSpy).not.toHaveBeenCalled()
  })
})