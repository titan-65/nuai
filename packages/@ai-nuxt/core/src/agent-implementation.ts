import { EventEmitter } from 'events'
import type { AIProvider } from './providers/base'
import type { 
  AIAgent, 
  AgentConfig, 
  AgentTool, 
  AgentExecutionContext, 
  AgentExecutionResult, 
  AgentExecutionStep,
  AgentExecutionError,
  AgentStatus,
  AgentRegistry,
  AgentRegistryStats,
  AgentFactory,
  AgentTemplate,
  AgentEventEmitter,
  AgentEvents
} from './agents'

/**
 * Default agent implementation
 */
export class DefaultAIAgent implements AIAgent {
  public config: AgentConfig
  public context?: AgentExecutionContext
  public provider: AIProvider
  public tools: Map<string, AgentTool>
  private eventEmitter: EventEmitter
  private status: AgentStatus

  constructor(config: AgentConfig, provider: AIProvider) {
    this.config = config
    this.provider = provider
    this.tools = new Map()
    this.eventEmitter = new EventEmitter()
    this.status = {
      id: config.id,
      state: 'idle',
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0
      }
    }
  }

  async execute(input: string, contextOverrides?: Partial<AgentExecutionContext>): Promise<AgentExecutionResult> {
    const startTime = Date.now()
    
    // Create execution context
    const context: AgentExecutionContext = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: this.config.id,
      state: 'running',
      variables: contextOverrides?.variables || {},
      history: [],
      startTime,
      ...contextOverrides
    }

    this.context = context
    this.status.state = 'running'
    this.status.executionId = context.id

    // Emit execution start event
    this.eventEmitter.emit('execution:start', { agent: this, context })

    try {
      // Execute the agent logic
      const output = await this.executeInternal(input, context)
      
      // Mark as completed
      context.state = 'completed'
      context.endTime = Date.now()
      
      const result: AgentExecutionResult = {
        context,
        output,
        success: true,
        metadata: {
          executionTime: context.endTime - context.startTime,
          stepCount: context.history.length,
          toolsUsed: context.history.filter(step => step.type === 'tool_call').length
        }
      }

      // Update status
      this.status.state = 'idle'
      this.status.executionId = undefined
      this.status.lastResult = result
      this.status.metrics.totalExecutions++
      this.status.metrics.successfulExecutions++
      this.updateAverageExecutionTime(result.metadata.executionTime)

      // Emit completion event
      this.eventEmitter.emit('execution:complete', { agent: this, result })

      return result

    } catch (error: any) {
      const agentError: AgentExecutionError = {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message || 'Unknown execution error',
        details: error,
        stack: error.stack,
        recoverable: error.recoverable || false
      }

      context.state = 'error'
      context.error = agentError
      context.endTime = Date.now()

      const result: AgentExecutionResult = {
        context,
        output: null,
        success: false,
        error: agentError,
        metadata: {
          executionTime: context.endTime - context.startTime,
          stepCount: context.history.length,
          toolsUsed: context.history.filter(step => step.type === 'tool_call').length
        }
      }

      // Update status
      this.status.state = 'error'
      this.status.executionId = undefined
      this.status.lastResult = result
      this.status.metrics.totalExecutions++
      this.status.metrics.failedExecutions++
      this.updateAverageExecutionTime(result.metadata.executionTime)

      // Emit error event
      this.eventEmitter.emit('execution:error', { agent: this, error: agentError })

      return result
    }
  }

  private async executeInternal(input: string, context: AgentExecutionContext): Promise<any> {
    // Add reasoning step
    const reasoningStep = this.createExecutionStep('reasoning', { input })
    context.history.push(reasoningStep)
    this.eventEmitter.emit('execution:step', { agent: this, step: reasoningStep })

    // Prepare messages for the AI provider
    const messages = [
      {
        role: 'system',
        content: this.buildSystemPrompt()
      },
      {
        role: 'user',
        content: input
      }
    ]

    // Check if agent needs to use tools
    const availableTools = Array.from(this.tools.values())
    let response

    if (availableTools.length > 0 && this.config.capabilities.canUseTool) {
      // Use function calling if provider supports it
      response = await this.provider.chat({
        messages,
        model: this.config.provider.model,
        temperature: this.config.provider.temperature,
        maxTokens: this.config.provider.maxTokens,
        tools: availableTools.map(tool => ({
          type: 'function',
          function: {
            name: tool.id,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      })

      // Handle tool calls if present
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          await this.executeTool(toolCall.function.name, toolCall.function.arguments, context)
        }
      }
    } else {
      // Simple chat completion
      response = await this.provider.chat({
        messages,
        model: this.config.provider.model,
        temperature: this.config.provider.temperature,
        maxTokens: this.config.provider.maxTokens
      })
    }

    // Complete reasoning step
    reasoningStep.output = response.text
    reasoningStep.duration = Date.now() - reasoningStep.timestamp

    return response.text
  }

  private async executeTool(toolId: string, args: any, context: AgentExecutionContext): Promise<any> {
    const tool = this.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`)
    }

    const toolStep = this.createExecutionStep('tool_call', { toolId, args })
    context.history.push(toolStep)

    this.eventEmitter.emit('tool:call', { agent: this, tool, input: args })

    try {
      const result = await tool.execute(args, context)
      
      toolStep.output = result
      toolStep.duration = Date.now() - toolStep.timestamp

      this.eventEmitter.emit('tool:result', { agent: this, tool, output: result })
      
      return result
    } catch (error: any) {
      const toolError: AgentExecutionError = {
        code: 'TOOL_EXECUTION_ERROR',
        message: `Tool ${toolId} execution failed: ${error.message}`,
        details: error,
        recoverable: true
      }

      toolStep.error = toolError
      toolStep.duration = Date.now() - toolStep.timestamp

      this.eventEmitter.emit('tool:error', { agent: this, tool, error: toolError })
      
      throw toolError
    }
  }

  private buildSystemPrompt(): string {
    let prompt = this.config.systemPrompt

    if (this.config.role) {
      prompt += `\n\nYou are acting as: ${this.config.role}`
    }

    if (this.tools.size > 0 && this.config.capabilities.canUseTool) {
      prompt += `\n\nYou have access to the following tools:\n`
      for (const tool of this.tools.values()) {
        prompt += `- ${tool.name}: ${tool.description}\n`
      }
    }

    return prompt
  }

  private createExecutionStep(type: AgentExecutionStep['type'], input: any): AgentExecutionStep {
    return {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      input
    }
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const total = this.status.metrics.totalExecutions
    const current = this.status.metrics.averageExecutionTime
    this.status.metrics.averageExecutionTime = ((current * (total - 1)) + executionTime) / total
    this.status.metrics.lastExecutionTime = Date.now()
  }

  addTool(tool: AgentTool): void {
    this.tools.set(tool.id, tool)
  }

  removeTool(toolId: string): void {
    this.tools.delete(toolId)
  }

  updateConfig(config: Partial<AgentConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...config, updatedAt: Date.now() }
    this.eventEmitter.emit('config:update', { agent: this, oldConfig, newConfig: this.config })
  }

  getStatus(): AgentStatus {
    return { ...this.status }
  }

  async stop(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      this.context.state = 'completed'
      this.status.state = 'idle'
    }
  }

  async pause(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      this.context.state = 'paused'
      this.status.state = 'paused'
      this.eventEmitter.emit('execution:pause', { agent: this, context: this.context })
    }
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state === 'paused') {
      this.context.state = 'running'
      this.status.state = 'running'
      this.eventEmitter.emit('execution:resume', { agent: this, context: this.context })
    }
  }

  // Event emitter methods
  on<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void {
    this.eventEmitter.on(event, listener)
  }

  off<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void {
    this.eventEmitter.off(event, listener)
  }

  emit<K extends keyof AgentEvents>(event: K, data: AgentEvents[K]): void {
    this.eventEmitter.emit(event, data)
  }
}

/**
 * Default agent registry implementation
 */
export class DefaultAgentRegistry implements AgentRegistry {
  private agents: Map<string, AIAgent> = new Map()
  private eventEmitter: EventEmitter = new EventEmitter()

  async register(config: AgentConfig): Promise<AIAgent> {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent with ID ${config.id} already exists`)
    }

    // This would need to be injected or resolved from a provider factory
    const provider = await this.resolveProvider(config.provider)
    const agent = new DefaultAIAgent(config, provider)
    
    this.agents.set(config.id, agent)
    
    return agent
  }

  async unregister(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (agent) {
      await agent.stop()
      this.agents.delete(agentId)
    }
  }

  get(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId)
  }

  list(): AIAgent[] {
    return Array.from(this.agents.values())
  }

  find(criteria: Partial<AgentConfig>): AIAgent[] {
    return this.list().filter(agent => {
      return Object.entries(criteria).every(([key, value]) => {
        const agentValue = (agent.config as any)[key]
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(agentValue) === JSON.stringify(value)
        }
        return agentValue === value
      })
    })
  }

  async update(agentId: string, config: Partial<AgentConfig>): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`)
    }
    
    agent.updateConfig(config)
  }

  getStatus(agentId: string): AgentStatus | undefined {
    const agent = this.agents.get(agentId)
    return agent?.getStatus()
  }

  getStats(): AgentRegistryStats {
    const agents = this.list()
    const runningAgents = agents.filter(agent => agent.getStatus().state === 'running')
    const activeAgents = agents.filter(agent => agent.config.active)
    
    const totalExecutions = agents.reduce((sum, agent) => 
      sum + agent.getStatus().metrics.totalExecutions, 0)
    
    const averageExecutionTime = agents.reduce((sum, agent) => 
      sum + agent.getStatus().metrics.averageExecutionTime, 0) / agents.length || 0

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      runningAgents: runningAgents.length,
      totalExecutions,
      averageExecutionTime
    }
  }

  private async resolveProvider(providerConfig: AgentConfig['provider']): Promise<AIProvider> {
    // This is a placeholder - in a real implementation, this would resolve
    // the provider from a provider factory or registry
    throw new Error('Provider resolution not implemented - needs provider factory integration')
  }
}

/**
 * Default agent factory implementation
 */
export class DefaultAgentFactory implements AgentFactory {
  private templates: Map<string, AgentTemplate> = new Map()
  private providerFactory: any // Would be injected

  constructor(providerFactory?: any) {
    this.providerFactory = providerFactory
    this.initializeDefaultTemplates()
  }

  async create(config: AgentConfig): Promise<AIAgent> {
    const validation = await this.validateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`)
    }

    const provider = await this.resolveProvider(config.provider)
    return new DefaultAIAgent(config, provider)
  }

  async createFromTemplate(templateId: string, overrides?: Partial<AgentConfig>): Promise<AIAgent> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    const config: AgentConfig = {
      ...template.config,
      ...overrides,
      id: overrides?.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    return this.create(config)
  }

  async validateConfig(config: AgentConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!config.id) errors.push('Agent ID is required')
    if (!config.name) errors.push('Agent name is required')
    if (!config.role) errors.push('Agent role is required')
    if (!config.systemPrompt) errors.push('System prompt is required')
    if (!config.provider?.name) errors.push('Provider name is required')
    if (!config.provider?.model) errors.push('Provider model is required')

    // Validate capabilities
    if (config.capabilities.maxExecutionTime && config.capabilities.maxExecutionTime <= 0) {
      errors.push('Max execution time must be positive')
    }

    if (config.capabilities.maxConcurrentTools && config.capabilities.maxConcurrentTools <= 0) {
      errors.push('Max concurrent tools must be positive')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private initializeDefaultTemplates(): void {
    // Assistant template
    this.templates.set('assistant', {
      id: 'assistant',
      name: 'General Assistant',
      description: 'A helpful general-purpose AI assistant',
      config: {
        name: 'Assistant',
        description: 'A helpful AI assistant that can answer questions and help with tasks',
        role: 'helpful assistant',
        systemPrompt: 'You are a helpful AI assistant. Provide accurate, helpful, and concise responses.',
        capabilities: {
          canUseTool: true,
          canCommunicate: true,
          canMakeDecisions: true,
          canLearn: false,
          maxExecutionTime: 30000
        },
        tools: [],
        provider: {
          name: 'openai',
          model: 'gpt-4',
          temperature: 0.7
        },
        active: true
      },
      requiredTools: [],
      tags: ['general', 'assistant'],
      version: '1.0.0'
    })

    // Research agent template
    this.templates.set('researcher', {
      id: 'researcher',
      name: 'Research Agent',
      description: 'An agent specialized in research and information gathering',
      config: {
        name: 'Researcher',
        description: 'An AI agent that specializes in research and information gathering',
        role: 'research specialist',
        systemPrompt: 'You are a research specialist. Gather information thoroughly, cite sources, and provide comprehensive analysis.',
        capabilities: {
          canUseTool: true,
          canCommunicate: true,
          canMakeDecisions: true,
          canLearn: false,
          maxExecutionTime: 60000
        },
        tools: ['web_search', 'document_reader'],
        provider: {
          name: 'openai',
          model: 'gpt-4',
          temperature: 0.3
        },
        active: true
      },
      requiredTools: ['web_search'],
      tags: ['research', 'information'],
      version: '1.0.0'
    })
  }

  private async resolveProvider(providerConfig: AgentConfig['provider']): Promise<AIProvider> {
    if (!this.providerFactory) {
      throw new Error('Provider factory not configured')
    }
    
    return this.providerFactory.create(providerConfig.name, providerConfig)
  }
}

// Export singleton instances
export const agentRegistry = new DefaultAgentRegistry()
export const agentFactory = new DefaultAgentFactory()