import type { AgentTool, AgentExecutionContext } from './agents'

/**
 * Tool parameter validation schema
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
  default?: any
  enum?: any[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  properties?: Record<string, ToolParameterSchema>
  items?: ToolParameterSchema
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  valid: boolean
  errors: string[]
  sanitizedInput?: any
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean
  data?: any
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    executionTime: number
    resourcesUsed?: string[]
    cost?: number
  }
}

/**
 * Tool registry for managing available tools
 */
export interface ToolRegistry {
  /**
   * Register a new tool
   */
  register(tool: AgentTool): void
  
  /**
   * Unregister a tool
   */
  unregister(toolId: string): void
  
  /**
   * Get a tool by ID
   */
  get(toolId: string): AgentTool | undefined
  
  /**
   * List all available tools
   */
  list(): AgentTool[]
  
  /**
   * Find tools by tags or criteria
   */
  find(criteria: { tags?: string[], category?: string, name?: string }): AgentTool[]
  
  /**
   * Validate tool input
   */
  validateInput(toolId: string, input: any): ToolValidationResult
  
  /**
   * Execute a tool
   */
  execute(toolId: string, input: any, context: AgentExecutionContext): Promise<ToolExecutionResult>
}

/**
 * Base tool implementation with validation
 */
export abstract class BaseTool implements AgentTool {
  public readonly id: string
  public readonly name: string
  public readonly description: string
  public readonly inputSchema: Record<string, any>
  public readonly outputSchema?: Record<string, any>
  public readonly requiresPermission?: boolean
  public readonly tags?: string[]
  public readonly category?: string
  public readonly version?: string

  constructor(config: {
    id: string
    name: string
    description: string
    inputSchema: Record<string, ToolParameterSchema>
    outputSchema?: Record<string, any>
    requiresPermission?: boolean
    tags?: string[]
    category?: string
    version?: string
  }) {
    this.id = config.id
    this.name = config.name
    this.description = config.description
    this.inputSchema = config.inputSchema
    this.outputSchema = config.outputSchema
    this.requiresPermission = config.requiresPermission
    this.tags = config.tags
    this.category = config.category
    this.version = config.version
  }

  /**
   * Validate input parameters
   */
  validateInput(input: any): ToolValidationResult {
    return validateToolInput(input, this.inputSchema)
  }

  /**
   * Execute the tool with validation
   */
  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`)
    }

    const startTime = Date.now()
    
    try {
      const result = await this.executeInternal(validation.sanitizedInput || input, context)
      
      return {
        success: true,
        data: result,
        metadata: {
          executionTime: Date.now() - startTime
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.code || 'TOOL_EXECUTION_ERROR',
          message: error.message,
          details: error
        },
        metadata: {
          executionTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Internal execution method to be implemented by subclasses
   */
  protected abstract executeInternal(input: any, context: AgentExecutionContext): Promise<any>
}

/**
 * Tool input validation function
 */
export function validateToolInput(input: any, schema: Record<string, ToolParameterSchema>): ToolValidationResult {
  const errors: string[] = []
  const sanitizedInput: any = {}

  for (const [key, paramSchema] of Object.entries(schema)) {
    const value = input[key]
    
    // Check required parameters
    if (paramSchema.required && (value === undefined || value === null)) {
      errors.push(`Parameter '${key}' is required`)
      continue
    }
    
    // Use default value if not provided
    if (value === undefined && paramSchema.default !== undefined) {
      sanitizedInput[key] = paramSchema.default
      continue
    }
    
    // Skip validation if value is not provided and not required
    if (value === undefined) {
      continue
    }
    
    // Type validation
    const typeValidation = validateParameterType(value, paramSchema, key)
    if (!typeValidation.valid) {
      errors.push(...typeValidation.errors)
      continue
    }
    
    sanitizedInput[key] = typeValidation.sanitizedValue
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedInput: errors.length === 0 ? sanitizedInput : undefined
  }
}

/**
 * Validate individual parameter type
 */
function validateParameterType(value: any, schema: ToolParameterSchema, paramName: string): {
  valid: boolean
  errors: string[]
  sanitizedValue?: any
} {
  const errors: string[] = []
  let sanitizedValue = value

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`Parameter '${paramName}' must be a string`)
        break
      }
      
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`Parameter '${paramName}' must be at least ${schema.minLength} characters`)
      }
      
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`Parameter '${paramName}' must be at most ${schema.maxLength} characters`)
      }
      
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`Parameter '${paramName}' does not match required pattern`)
      }
      
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`Parameter '${paramName}' must be one of: ${schema.enum.join(', ')}`)
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`Parameter '${paramName}' must be a number`)
        break
      }
      
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Parameter '${paramName}' must be at least ${schema.minimum}`)
      }
      
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Parameter '${paramName}' must be at most ${schema.maximum}`)
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`Parameter '${paramName}' must be a boolean`)
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`Parameter '${paramName}' must be an array`)
        break
      }
      
      if (schema.items) {
        const validatedItems = []
        for (let i = 0; i < value.length; i++) {
          const itemValidation = validateParameterType(value[i], schema.items, `${paramName}[${i}]`)
          if (!itemValidation.valid) {
            errors.push(...itemValidation.errors)
          } else {
            validatedItems.push(itemValidation.sanitizedValue)
          }
        }
        if (errors.length === 0) {
          sanitizedValue = validatedItems
        }
      }
      break

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`Parameter '${paramName}' must be an object`)
        break
      }
      
      if (schema.properties) {
        const nestedValidation = validateToolInput(value, schema.properties)
        if (!nestedValidation.valid) {
          errors.push(...nestedValidation.errors.map(err => `${paramName}.${err}`))
        } else {
          sanitizedValue = nestedValidation.sanitizedInput
        }
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedValue: errors.length === 0 ? sanitizedValue : undefined
  }
}

/**
 * Default tool registry implementation
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, AgentTool> = new Map()

  register(tool: AgentTool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID '${tool.id}' already exists`)
    }
    this.tools.set(tool.id, tool)
  }

  unregister(toolId: string): void {
    this.tools.delete(toolId)
  }

  get(toolId: string): AgentTool | undefined {
    return this.tools.get(toolId)
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values())
  }

  find(criteria: { tags?: string[], category?: string, name?: string }): AgentTool[] {
    return this.list().filter(tool => {
      if (criteria.tags && criteria.tags.length > 0) {
        if (!tool.tags || !criteria.tags.some(tag => tool.tags!.includes(tag))) {
          return false
        }
      }
      
      if (criteria.category && (tool as any).category !== criteria.category) {
        return false
      }
      
      if (criteria.name && !tool.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false
      }
      
      return true
    })
  }

  validateInput(toolId: string, input: any): ToolValidationResult {
    const tool = this.tools.get(toolId)
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool '${toolId}' not found`]
      }
    }

    return validateToolInput(input, tool.inputSchema)
  }

  async execute(toolId: string, input: any, context: AgentExecutionContext): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId)
    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${toolId}' not found`
        }
      }
    }

    try {
      const result = await tool.execute(input, context)
      return {
        success: true,
        data: result
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.code || 'TOOL_EXECUTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
}

// Export singleton instance
export const toolRegistry = new DefaultToolRegistry()