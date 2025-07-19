import { EventEmitter } from 'events'
import type { AIAgent, AgentExecutionResult, AgentExecutionContext } from './agents'

/**
 * Agent communication message
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string
  /** Sender agent ID */
  from: string
  /** Recipient agent ID (or 'broadcast' for all agents) */
  to: string
  /** Message type */
  type: 'request' | 'response' | 'notification' | 'broadcast'
  /** Message content */
  content: any
  /** Message metadata */
  metadata?: {
    /** Timestamp when message was created */
    timestamp: number
    /** Priority level */
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    /** Whether response is expected */
    expectsResponse?: boolean
    /** Correlation ID for request-response pairs */
    correlationId?: string
    /** Message expiration time */
    expiresAt?: number
  }
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step ID */
  id: string
  /** Step name */
  name: string
  /** Agent ID to execute this step */
  agentId: string
  /** Input for the step */
  input: any
  /** Dependencies (step IDs that must complete first) */
  dependencies?: string[]
  /** Condition to execute this step */
  condition?: (context: WorkflowExecutionContext) => boolean
  /** Retry configuration */
  retry?: {
    maxAttempts: number
    delay: number
    backoff?: 'linear' | 'exponential'
  }
  /** Timeout in milliseconds */
  timeout?: number
  /** Whether this step can be skipped if it fails */
  optional?: boolean
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow ID */
  id: string
  /** Workflow name */
  name: string
  /** Workflow description */
  description: string
  /** Workflow steps */
  steps: WorkflowStep[]
  /** Execution mode */
  mode: 'sequential' | 'parallel' | 'mixed'
  /** Global workflow timeout */
  timeout?: number
  /** Error handling strategy */
  errorHandling: 'fail_fast' | 'continue' | 'retry'
  /** Maximum concurrent steps (for parallel/mixed mode) */
  maxConcurrency?: number
}

/**
 * Workflow execution context
 */
export interface WorkflowExecutionContext {
  /** Execution ID */
  id: string
  /** Workflow definition */
  workflow: WorkflowDefinition
  /** Current state */
  state: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  /** Step results */
  stepResults: Map<string, AgentExecutionResult>
  /** Shared variables between steps */
  variables: Record<string, any>
  /** Execution start time */
  startTime: number
  /** Execution end time */
  endTime?: number
  /** Current executing steps */
  runningSteps: Set<string>
  /** Completed steps */
  completedSteps: Set<string>
  /** Failed steps */
  failedSteps: Set<string>
  /** Error information */
  error?: WorkflowExecutionError
}

/**
 * Workflow execution error
 */
export interface WorkflowExecutionError {
  /** Error code */
  code: string
  /** Error message */
  message: string
  /** Failed step ID */
  stepId?: string
  /** Original error */
  originalError?: any
  /** Whether the error is recoverable */
  recoverable: boolean
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Execution context */
  context: WorkflowExecutionContext
  /** Whether execution was successful */
  success: boolean
  /** Final output */
  output?: any
  /** Error information */
  error?: WorkflowExecutionError
  /** Execution metadata */
  metadata: {
    /** Total execution time */
    executionTime: number
    /** Number of steps executed */
    stepsExecuted: number
    /** Number of steps failed */
    stepsFailed: number
    /** Number of retries performed */
    retriesPerformed: number
  }
}

/**
 * Agent orchestrator for managing multi-agent workflows
 */
export interface AgentOrchestrator {
  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: AIAgent): void
  
  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void
  
  /**
   * Execute a workflow
   */
  executeWorkflow(workflow: WorkflowDefinition, input?: any): Promise<WorkflowExecutionResult>
  
  /**
   * Cancel a running workflow
   */
  cancelWorkflow(executionId: string): Promise<void>
  
  /**
   * Get workflow execution status
   */
  getExecutionStatus(executionId: string): WorkflowExecutionContext | undefined
  
  /**
   * Send message between agents
   */
  sendMessage(message: AgentMessage): Promise<void>
  
  /**
   * Broadcast message to all agents
   */
  broadcastMessage(from: string, content: any, type?: string): Promise<void>
  
  /**
   * Get orchestrator statistics
   */
  getStats(): OrchestratorStats
}

/**
 * Orchestrator statistics
 */
export interface OrchestratorStats {
  /** Number of registered agents */
  registeredAgents: number
  /** Number of active workflows */
  activeWorkflows: number
  /** Total workflows executed */
  totalWorkflows: number
  /** Successful workflows */
  successfulWorkflows: number
  /** Failed workflows */
  failedWorkflows: number
  /** Average workflow execution time */
  averageExecutionTime: number
  /** Messages sent */
  messagesSent: number
}

/**
 * Events emitted by the orchestrator
 */
export interface OrchestratorEvents {
  'workflow:start': { context: WorkflowExecutionContext }
  'workflow:complete': { result: WorkflowExecutionResult }
  'workflow:error': { context: WorkflowExecutionContext, error: WorkflowExecutionError }
  'workflow:cancel': { context: WorkflowExecutionContext }
  'step:start': { context: WorkflowExecutionContext, step: WorkflowStep }
  'step:complete': { context: WorkflowExecutionContext, step: WorkflowStep, result: AgentExecutionResult }
  'step:error': { context: WorkflowExecutionContext, step: WorkflowStep, error: any }
  'step:retry': { context: WorkflowExecutionContext, step: WorkflowStep, attempt: number }
  'message:sent': { message: AgentMessage }
  'message:received': { message: AgentMessage, agent: AIAgent }
  'agent:register': { agent: AIAgent }
  'agent:unregister': { agentId: string }
}

/**
 * Default agent orchestrator implementation
 */
export class DefaultAgentOrchestrator implements AgentOrchestrator {
  private agents: Map<string, AIAgent> = new Map()
  private executions: Map<string, WorkflowExecutionContext> = new Map()
  private messageQueue: AgentMessage[] = []
  private eventEmitter: EventEmitter = new EventEmitter()
  private stats: OrchestratorStats = {
    registeredAgents: 0,
    activeWorkflows: 0,
    totalWorkflows: 0,
    successfulWorkflows: 0,
    failedWorkflows: 0,
    averageExecutionTime: 0,
    messagesSent: 0
  }

  registerAgent(agent: AIAgent): void {
    if (this.agents.has(agent.config.id)) {
      throw new Error(`Agent ${agent.config.id} is already registered`)
    }
    
    this.agents.set(agent.config.id, agent)
    this.stats.registeredAgents++
    
    // Set up message handling for the agent
    this.setupAgentMessageHandling(agent)
    
    this.eventEmitter.emit('agent:register', { agent })
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      this.agents.delete(agentId)
      this.stats.registeredAgents--
      this.eventEmitter.emit('agent:unregister', { agentId })
    }
  }

  async executeWorkflow(workflow: WorkflowDefinition, input?: any): Promise<WorkflowExecutionResult> {
    const context = this.createExecutionContext(workflow, input)
    this.executions.set(context.id, context)
    this.stats.activeWorkflows++
    this.stats.totalWorkflows++

    this.eventEmitter.emit('workflow:start', { context })

    try {
      const result = await this.executeWorkflowInternal(context)
      
      this.stats.activeWorkflows--
      if (result.success) {
        this.stats.successfulWorkflows++
      } else {
        this.stats.failedWorkflows++
      }
      
      this.updateAverageExecutionTime(result.metadata.executionTime)
      this.eventEmitter.emit('workflow:complete', { result })
      
      return result
    } catch (error: any) {
      this.stats.activeWorkflows--
      this.stats.failedWorkflows++
      
      const workflowError: WorkflowExecutionError = {
        code: 'WORKFLOW_EXECUTION_ERROR',
        message: error.message,
        originalError: error,
        recoverable: false
      }
      
      context.state = 'failed'
      context.error = workflowError
      context.endTime = Date.now()
      
      const result: WorkflowExecutionResult = {
        context,
        success: false,
        error: workflowError,
        metadata: {
          executionTime: context.endTime - context.startTime,
          stepsExecuted: context.completedSteps.size,
          stepsFailed: context.failedSteps.size,
          retriesPerformed: 0
        }
      }
      
      this.eventEmitter.emit('workflow:error', { context, error: workflowError })
      return result
    } finally {
      this.executions.delete(context.id)
    }
  }

  async cancelWorkflow(executionId: string): Promise<void> {
    const context = this.executions.get(executionId)
    if (!context) {
      throw new Error(`Workflow execution ${executionId} not found`)
    }
    
    context.state = 'cancelled'
    
    // Cancel running steps
    for (const stepId of context.runningSteps) {
      const step = context.workflow.steps.find(s => s.id === stepId)
      if (step) {
        const agent = this.agents.get(step.agentId)
        if (agent) {
          await agent.stop()
        }
      }
    }
    
    this.eventEmitter.emit('workflow:cancel', { context })
  }

  getExecutionStatus(executionId: string): WorkflowExecutionContext | undefined {
    return this.executions.get(executionId)
  }

  async sendMessage(message: AgentMessage): Promise<void> {
    const recipient = this.agents.get(message.to)
    if (!recipient && message.to !== 'broadcast') {
      throw new Error(`Agent ${message.to} not found`)
    }
    
    this.messageQueue.push(message)
    this.stats.messagesSent++
    
    this.eventEmitter.emit('message:sent', { message })
    
    if (message.to === 'broadcast') {
      // Broadcast to all agents
      for (const agent of this.agents.values()) {
        this.eventEmitter.emit('message:received', { message, agent })
      }
    } else if (recipient) {
      this.eventEmitter.emit('message:received', { message, agent: recipient })
    }
  }

  async broadcastMessage(from: string, content: any, type: string = 'broadcast'): Promise<void> {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to: 'broadcast',
      type: 'broadcast',
      content,
      metadata: {
        timestamp: Date.now()
      }
    }
    
    await this.sendMessage(message)
  }

  getStats(): OrchestratorStats {
    return { ...this.stats }
  }

  private createExecutionContext(workflow: WorkflowDefinition, input?: any): WorkflowExecutionContext {
    return {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflow,
      state: 'pending',
      stepResults: new Map(),
      variables: { input },
      startTime: Date.now(),
      runningSteps: new Set(),
      completedSteps: new Set(),
      failedSteps: new Set()
    }
  }

  private async executeWorkflowInternal(context: WorkflowExecutionContext): Promise<WorkflowExecutionResult> {
    context.state = 'running'
    
    try {
      switch (context.workflow.mode) {
        case 'sequential':
          await this.executeSequential(context)
          break
        case 'parallel':
          await this.executeParallel(context)
          break
        case 'mixed':
          await this.executeMixed(context)
          break
        default:
          throw new Error(`Unknown execution mode: ${context.workflow.mode}`)
      }
      
      context.state = 'completed'
      context.endTime = Date.now()
      
      return {
        context,
        success: true,
        output: this.aggregateResults(context),
        metadata: {
          executionTime: context.endTime - context.startTime,
          stepsExecuted: context.completedSteps.size,
          stepsFailed: context.failedSteps.size,
          retriesPerformed: 0 // TODO: Track retries
        }
      }
    } catch (error: any) {
      context.state = 'failed'
      context.endTime = Date.now()
      
      const workflowError: WorkflowExecutionError = {
        code: 'WORKFLOW_EXECUTION_ERROR',
        message: error.message,
        originalError: error,
        recoverable: false
      }
      
      context.error = workflowError
      
      return {
        context,
        success: false,
        error: workflowError,
        metadata: {
          executionTime: context.endTime - context.startTime,
          stepsExecuted: context.completedSteps.size,
          stepsFailed: context.failedSteps.size,
          retriesPerformed: 0
        }
      }
    }
  }

  private async executeSequential(context: WorkflowExecutionContext): Promise<void> {
    for (const step of context.workflow.steps) {
      if (context.state === 'cancelled') break
      
      if (!this.shouldExecuteStep(step, context)) continue
      
      await this.executeStep(step, context)
      
      if (context.failedSteps.has(step.id) && context.workflow.errorHandling === 'fail_fast') {
        throw new Error(`Step ${step.id} failed and error handling is set to fail_fast`)
      }
    }
  }

  private async executeParallel(context: WorkflowExecutionContext): Promise<void> {
    const maxConcurrency = context.workflow.maxConcurrency || context.workflow.steps.length
    const semaphore = new Semaphore(maxConcurrency)
    
    const promises = context.workflow.steps.map(async (step) => {
      if (!this.shouldExecuteStep(step, context)) return
      
      await semaphore.acquire()
      try {
        await this.executeStep(step, context)
      } finally {
        semaphore.release()
      }
    })
    
    await Promise.all(promises)
  }

  private async executeMixed(context: WorkflowExecutionContext): Promise<void> {
    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(context.workflow.steps)
    const readySteps = new Set<string>()
    const maxConcurrency = context.workflow.maxConcurrency || 5
    const semaphore = new Semaphore(maxConcurrency)
    
    // Find initial ready steps (no dependencies)
    for (const step of context.workflow.steps) {
      if (!step.dependencies || step.dependencies.length === 0) {
        readySteps.add(step.id)
      }
    }
    
    while (readySteps.size > 0 || context.runningSteps.size > 0) {
      if (context.state === 'cancelled') break
      
      // Execute ready steps
      const currentReadySteps = Array.from(readySteps)
      readySteps.clear()
      
      const promises = currentReadySteps.map(async (stepId) => {
        const step = context.workflow.steps.find(s => s.id === stepId)!
        
        if (!this.shouldExecuteStep(step, context)) return
        
        await semaphore.acquire()
        try {
          await this.executeStep(step, context)
          
          // Check for newly ready steps
          for (const nextStep of context.workflow.steps) {
            if (context.completedSteps.has(nextStep.id) || context.runningSteps.has(nextStep.id)) continue
            
            if (nextStep.dependencies && nextStep.dependencies.every(dep => context.completedSteps.has(dep))) {
              readySteps.add(nextStep.id)
            }
          }
        } finally {
          semaphore.release()
        }
      })
      
      await Promise.all(promises)
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    const agent = this.agents.get(step.agentId)
    if (!agent) {
      throw new Error(`Agent ${step.agentId} not found`)
    }
    
    context.runningSteps.add(step.id)
    this.eventEmitter.emit('step:start', { context, step })
    
    try {
      // Prepare step input
      const stepInput = this.prepareStepInput(step, context)
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => agent.execute(stepInput, { variables: context.variables }),
        step.timeout || 30000
      )
      
      context.stepResults.set(step.id, result)
      context.completedSteps.add(step.id)
      context.runningSteps.delete(step.id)
      
      // Update context variables with step result
      context.variables[`step_${step.id}`] = result.output
      
      this.eventEmitter.emit('step:complete', { context, step, result })
    } catch (error: any) {
      context.failedSteps.add(step.id)
      context.runningSteps.delete(step.id)
      
      this.eventEmitter.emit('step:error', { context, step, error })
      
      if (!step.optional) {
        throw error
      }
    }
  }

  private shouldExecuteStep(step: WorkflowStep, context: WorkflowExecutionContext): boolean {
    // Check dependencies
    if (step.dependencies) {
      for (const dep of step.dependencies) {
        if (!context.completedSteps.has(dep)) {
          return false
        }
      }
    }
    
    // Check condition
    if (step.condition && !step.condition(context)) {
      return false
    }
    
    return true
  }

  private prepareStepInput(step: WorkflowStep, context: WorkflowExecutionContext): string {
    let input = step.input
    
    // Replace variables in input
    if (typeof input === 'string') {
      input = input.replace(/\${(\w+)}/g, (match, varName) => {
        return context.variables[varName] || match
      })
    }
    
    return input
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`))
      }, timeout)
      
      fn().then(
        (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
  }

  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>()
    
    for (const step of steps) {
      graph.set(step.id, step.dependencies || [])
    }
    
    return graph
  }

  private aggregateResults(context: WorkflowExecutionContext): any {
    const results: Record<string, any> = {}
    
    for (const [stepId, result] of context.stepResults) {
      results[stepId] = result.output
    }
    
    return {
      stepResults: results,
      variables: context.variables,
      summary: {
        totalSteps: context.workflow.steps.length,
        completedSteps: context.completedSteps.size,
        failedSteps: context.failedSteps.size,
        executionTime: context.endTime ? context.endTime - context.startTime : 0
      }
    }
  }

  private setupAgentMessageHandling(agent: AIAgent): void {
    // This would set up message handling for the agent
    // In a real implementation, agents would have message handlers
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const total = this.stats.totalWorkflows
    const current = this.stats.averageExecutionTime
    this.stats.averageExecutionTime = ((current * (total - 1)) + executionTime) / total
  }

  // Event emitter methods
  on<K extends keyof OrchestratorEvents>(event: K, listener: (data: OrchestratorEvents[K]) => void): void {
    this.eventEmitter.on(event, listener)
  }

  off<K extends keyof OrchestratorEvents>(event: K, listener: (data: OrchestratorEvents[K]) => void): void {
    this.eventEmitter.off(event, listener)
  }

  emit<K extends keyof OrchestratorEvents>(event: K, data: OrchestratorEvents[K]): void {
    this.eventEmitter.emit(event, data)
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve()
      } else {
        this.waitQueue.push(resolve)
      }
    })
  }

  release(): void {
    this.permits++
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!
      this.permits--
      next()
    }
  }
}

// Export singleton instance
export const agentOrchestrator = new DefaultAgentOrchestrator()