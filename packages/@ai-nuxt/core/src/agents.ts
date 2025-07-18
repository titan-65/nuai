import type { AIProvider } from './providers/base'

/**
 * Represents the execution context for an agent
 */
export interface AgentExecutionContext {
  /** Unique identifier for this execution context */
  id: string
  /** Agent that owns this context */
  agentId: string
  /** Current state of the execution */
  state: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  /** Variables and data available in this context */
  variables: Record<string, any>
  /** Execution history and logs */
  history: AgentExecutionStep[]
  /** Start time of the execution */
  startTime: number
  /** End time of the execution (if completed) */
  endTime?: number
  /** Error information if execution failed */
  error?: AgentExecutionError
}

/**
 * Represents a single step in agent execution
 */
export interface AgentExecutionStep {
  /** Unique identifier for this step */
  id: string
  /** Type of step (tool_call, reasoning, communication, etc.) */
  type: 'tool_call' | 'reasoning' | 'communication' | 'decision' | 'error'
  /** Timestamp when step started */
  timestamp: number
  /** Duration of the step in milliseconds */
  duration?: number
  /** Input data for this step */
  input: any
  /** Output data from this step */
  output?: any
  /** Error information if step failed */
  error?: AgentExecutionError
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Represents an error during agent execution
 */
export interface AgentExecutionError {
  /** Error code */
  code: string
  /** Human-readable error message */
  message: string
  /** Detailed error information */
  details?: any
  /** Stack trace if available */
  stack?: string
  /** Whether the error is recoverable */
  recoverable: boolean
}

/**
 * Represents a tool that an agent can use
 */
export interface AgentTool {
  /** Unique identifier for the tool */
  id: string
  /** Human-readable name */
  name: string
  /** Description of what the tool does */
  description: string
  /** Input schema for the tool */
  inputSchema: Record<string, any>
  /** Output schema for the tool */
  outputSchema?: Record<string, any>
  /** Function to execute the tool */
  execute: (input: any, context: AgentExecutionContext) => Promise<any>
  /** Whether the tool requires special permissions */
  requiresPermission?: boolean
  /** Tags for categorizing the tool */
  tags?: string[]
}

/**
 * Represents the capabilities of an agent
 */
export interface AgentCapabilities {
  /** Whether the agent can use tools */
  canUseTool: boolean
  /** Whether the agent can communicate with other agents */
  canCommunicate: boolean
  /** Whether the agent can make decisions */
  canMakeDecisions: boolean
  /** Whether the agent can learn from interactions */
  canLearn: boolean
  /** Maximum number of tools the agent can use simultaneously */
  maxConcurrentTools?: number
  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number
  /** Memory limit for the agent */
  memoryLimit?: number
}

/**
 * Configuration for an AI agent
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the agent's purpose */
  description: string
  /** Role or persona of the agent */
  role: string
  /** System prompt or instructions */
  systemPrompt: string
  /** Agent capabilities */
  capabilities: AgentCapabilities
  /** Available tools for the agent */
  tools: string[]
  /** AI provider configuration */
  provider: {
    name: string
    model: string
    temperature?: number
    maxTokens?: number
    [key: string]: any
  }
  /** Agent-specific settings */
  settings?: Record<string, any>
  /** Whether the agent is active */
  active: boolean
  /** Creation timestamp */
  createdAt: number
  /** Last update timestamp */
  updatedAt: number
}

/**
 * Represents an AI agent instance
 */
export interface AIAgent {
  /** Agent configuration */
  config: AgentConfig
  /** Current execution context */
  context?: AgentExecutionContext
  /** AI provider instance */
  provider: AIProvider
  /** Available tools */
  tools: Map<string, AgentTool>
  
  /**
   * Execute the agent with given input
   */
  execute(input: string, context?: Partial<AgentExecutionContext>): Promise<AgentExecutionResult>
  
  /**
   * Add a tool to the agent
   */
  addTool(tool: AgentTool): void
  
  /**
   * Remove a tool from the agent
   */
  removeTool(toolId: string): void
  
  /**
   * Update agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void
  
  /**
   * Get agent status
   */
  getStatus(): AgentStatus
  
  /**
   * Stop agent execution
   */
  stop(): Promise<void>
  
  /**
   * Pause agent execution
   */
  pause(): Promise<void>
  
  /**
   * Resume agent execution
   */
  resume(): Promise<void>
}

/**
 * Result of agent execution
 */
export interface AgentExecutionResult {
  /** Execution context */
  context: AgentExecutionContext
  /** Final output */
  output: any
  /** Whether execution was successful */
  success: boolean
  /** Error information if execution failed */
  error?: AgentExecutionError
  /** Execution metadata */
  metadata: {
    /** Total execution time */
    executionTime: number
    /** Number of steps executed */
    stepCount: number
    /** Number of tools used */
    toolsUsed: number
    /** Token usage if applicable */
    tokenUsage?: {
      prompt: number
      completion: number
      total: number
    }
    /** Cost information if available */
    cost?: number
  }
}

/**
 * Current status of an agent
 */
export interface AgentStatus {
  /** Agent ID */
  id: string
  /** Current state */
  state: 'idle' | 'running' | 'paused' | 'error'
  /** Current execution context ID if running */
  executionId?: string
  /** Last execution result */
  lastResult?: AgentExecutionResult
  /** Performance metrics */
  metrics: {
    /** Total executions */
    totalExecutions: number
    /** Successful executions */
    successfulExecutions: number
    /** Failed executions */
    failedExecutions: number
    /** Average execution time */
    averageExecutionTime: number
    /** Last execution time */
    lastExecutionTime?: number
  }
}

/**
 * Agent registry for managing multiple agents
 */
export interface AgentRegistry {
  /**
   * Register a new agent
   */
  register(config: AgentConfig): Promise<AIAgent>
  
  /**
   * Unregister an agent
   */
  unregister(agentId: string): Promise<void>
  
  /**
   * Get an agent by ID
   */
  get(agentId: string): AIAgent | undefined
  
  /**
   * List all registered agents
   */
  list(): AIAgent[]
  
  /**
   * Find agents by criteria
   */
  find(criteria: Partial<AgentConfig>): AIAgent[]
  
  /**
   * Update agent configuration
   */
  update(agentId: string, config: Partial<AgentConfig>): Promise<void>
  
  /**
   * Get agent status
   */
  getStatus(agentId: string): AgentStatus | undefined
  
  /**
   * Get registry statistics
   */
  getStats(): AgentRegistryStats
}

/**
 * Statistics about the agent registry
 */
export interface AgentRegistryStats {
  /** Total number of registered agents */
  totalAgents: number
  /** Number of active agents */
  activeAgents: number
  /** Number of running agents */
  runningAgents: number
  /** Total executions across all agents */
  totalExecutions: number
  /** Average execution time across all agents */
  averageExecutionTime: number
}

/**
 * Events emitted by agents
 */
export interface AgentEvents {
  'execution:start': { agent: AIAgent; context: AgentExecutionContext }
  'execution:step': { agent: AIAgent; step: AgentExecutionStep }
  'execution:complete': { agent: AIAgent; result: AgentExecutionResult }
  'execution:error': { agent: AIAgent; error: AgentExecutionError }
  'execution:pause': { agent: AIAgent; context: AgentExecutionContext }
  'execution:resume': { agent: AIAgent; context: AgentExecutionContext }
  'tool:call': { agent: AIAgent; tool: AgentTool; input: any }
  'tool:result': { agent: AIAgent; tool: AgentTool; output: any }
  'tool:error': { agent: AIAgent; tool: AgentTool; error: AgentExecutionError }
  'config:update': { agent: AIAgent; oldConfig: AgentConfig; newConfig: AgentConfig }
  'status:change': { agent: AIAgent; oldStatus: AgentStatus; newStatus: AgentStatus }
}

/**
 * Event emitter interface for agents
 */
export interface AgentEventEmitter {
  on<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void
  off<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): void
  emit<K extends keyof AgentEvents>(event: K, data: AgentEvents[K]): void
}

/**
 * Factory for creating agents
 */
export interface AgentFactory {
  /**
   * Create a new agent instance
   */
  create(config: AgentConfig): Promise<AIAgent>
  
  /**
   * Create an agent from a template
   */
  createFromTemplate(templateId: string, overrides?: Partial<AgentConfig>): Promise<AIAgent>
  
  /**
   * Validate agent configuration
   */
  validateConfig(config: AgentConfig): Promise<{ valid: boolean; errors: string[] }>
}

/**
 * Agent template for common agent types
 */
export interface AgentTemplate {
  /** Template ID */
  id: string
  /** Template name */
  name: string
  /** Template description */
  description: string
  /** Default configuration */
  config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>
  /** Required tools */
  requiredTools: string[]
  /** Template tags */
  tags: string[]
  /** Template version */
  version: string
}