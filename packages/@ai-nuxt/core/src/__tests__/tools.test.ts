import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseTool, DefaultToolRegistry, validateToolInput, toolRegistry } from '../tools'
import { 
  CalculatorTool, 
  TextProcessorTool, 
  JsonProcessorTool, 
  DateTimeTool,
  RandomGeneratorTool,
  builtInTools 
} from '../built-in-tools'
import type { AgentExecutionContext, ToolParameterSchema } from '../agents'

// Mock execution context
const mockContext: AgentExecutionContext = {
  id: 'test-context',
  agentId: 'test-agent',
  state: 'running',
  variables: {},
  history: [],
  startTime: Date.now()
}

// Test tool implementation
class TestTool extends BaseTool {
  constructor() {
    super({
      id: 'test_tool',
      name: 'Test Tool',
      description: 'A tool for testing',
      inputSchema: {
        message: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 100
        },
        count: {
          type: 'number',
          required: false,
          default: 1,
          minimum: 1,
          maximum: 10
        }
      },
      tags: ['test', 'demo']
    })
  }

  protected async executeInternal(input: { message: string, count?: number }, context: AgentExecutionContext): Promise<any> {
    const { message, count = 1 } = input
    return {
      repeated: Array(count).fill(message).join(' '),
      originalMessage: message,
      count
    }
  }
}

describe('Tool Parameter Validation', () => {
  const schema: Record<string, ToolParameterSchema> = {
    name: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 50
    },
    age: {
      type: 'number',
      required: false,
      minimum: 0,
      maximum: 150
    },
    active: {
      type: 'boolean',
      required: false,
      default: true
    },
    tags: {
      type: 'array',
      required: false,
      items: {
        type: 'string',
        minLength: 1
      }
    },
    config: {
      type: 'object',
      required: false,
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark']
        }
      }
    }
  }

  it('should validate correct input', () => {
    const input = {
      name: 'John Doe',
      age: 30,
      active: true,
      tags: ['user', 'admin'],
      config: { theme: 'dark' }
    }

    const result = validateToolInput(input, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.sanitizedInput).toEqual(input)
  })

  it('should handle missing required fields', () => {
    const input = { age: 30 }
    const result = validateToolInput(input, schema)
    
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Parameter 'name' is required")
  })

  it('should apply default values', () => {
    const input = { name: 'John' }
    const result = validateToolInput(input, schema)
    
    expect(result.valid).toBe(true)
    expect(result.sanitizedInput?.active).toBe(true)
  })

  it('should validate string constraints', () => {
    const result1 = validateToolInput({ name: 'A' }, schema)
    expect(result1.valid).toBe(false)
    expect(result1.errors).toContain("Parameter 'name' must be at least 2 characters")

    const result2 = validateToolInput({ name: 'A'.repeat(51) }, schema)
    expect(result2.valid).toBe(false)
    expect(result2.errors).toContain("Parameter 'name' must be at most 50 characters")
  })

  it('should validate number constraints', () => {
    const result1 = validateToolInput({ name: 'John', age: -1 }, schema)
    expect(result1.valid).toBe(false)
    expect(result1.errors).toContain("Parameter 'age' must be at least 0")

    const result2 = validateToolInput({ name: 'John', age: 200 }, schema)
    expect(result2.valid).toBe(false)
    expect(result2.errors).toContain("Parameter 'age' must be at most 150")
  })

  it('should validate array items', () => {
    const input = { name: 'John', tags: ['valid', ''] }
    const result = validateToolInput(input, schema)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(err => err.includes('tags[1]'))).toBe(true)
  })

  it('should validate nested objects', () => {
    const input = { name: 'John', config: { theme: 'invalid' } }
    const result = validateToolInput(input, schema)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(err => err.includes('config'))).toBe(true)
  })

  it('should validate type mismatches', () => {
    const input = { name: 123, age: 'thirty' }
    const result = validateToolInput(input, schema)
    
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Parameter 'name' must be a string")
    expect(result.errors).toContain("Parameter 'age' must be a number")
  })
})

describe('BaseTool', () => {
  let testTool: TestTool

  beforeEach(() => {
    testTool = new TestTool()
  })

  it('should initialize correctly', () => {
    expect(testTool.id).toBe('test_tool')
    expect(testTool.name).toBe('Test Tool')
    expect(testTool.description).toBe('A tool for testing')
    expect(testTool.tags).toEqual(['test', 'demo'])
  })

  it('should execute with valid input', async () => {
    const input = { message: 'Hello', count: 3 }
    const result = await testTool.execute(input, mockContext)
    
    expect(result.success).toBe(true)
    expect(result.data.repeated).toBe('Hello Hello Hello')
    expect(result.data.count).toBe(3)
    expect(result.metadata?.executionTime).toBeGreaterThan(0)
  })

  it('should handle validation errors', async () => {
    const input = { message: '', count: 15 }
    const result = await testTool.execute(input, mockContext)
    
    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('Tool validation failed')
  })

  it('should handle execution errors', async () => {
    // Create a tool that throws an error
    class ErrorTool extends BaseTool {
      constructor() {
        super({
          id: 'error_tool',
          name: 'Error Tool',
          description: 'A tool that throws errors',
          inputSchema: {
            input: { type: 'string', required: true }
          }
        })
      }

      protected async executeInternal(): Promise<any> {
        throw new Error('Intentional error')
      }
    }

    const errorTool = new ErrorTool()
    const result = await errorTool.execute({ input: 'test' }, mockContext)
    
    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Intentional error')
  })

  it('should validate input separately', () => {
    const validInput = { message: 'Hello' }
    const invalidInput = { message: '' }
    
    expect(testTool.validateInput(validInput).valid).toBe(true)
    expect(testTool.validateInput(invalidInput).valid).toBe(false)
  })
})

describe('DefaultToolRegistry', () => {
  let registry: DefaultToolRegistry

  beforeEach(() => {
    registry = new DefaultToolRegistry()
  })

  it('should register and retrieve tools', () => {
    const tool = new TestTool()
    registry.register(tool)
    
    expect(registry.get('test_tool')).toBe(tool)
    expect(registry.list()).toContain(tool)
  })

  it('should prevent duplicate registration', () => {
    const tool = new TestTool()
    registry.register(tool)
    
    expect(() => registry.register(tool)).toThrow("Tool with ID 'test_tool' already exists")
  })

  it('should unregister tools', () => {
    const tool = new TestTool()
    registry.register(tool)
    registry.unregister('test_tool')
    
    expect(registry.get('test_tool')).toBeUndefined()
    expect(registry.list()).not.toContain(tool)
  })

  it('should find tools by criteria', () => {
    const tool1 = new TestTool()
    const tool2 = new CalculatorTool()
    
    registry.register(tool1)
    registry.register(tool2)
    
    const testTools = registry.find({ tags: ['test'] })
    const mathTools = registry.find({ tags: ['math'] })
    
    expect(testTools).toContain(tool1)
    expect(testTools).not.toContain(tool2)
    expect(mathTools).toContain(tool2)
    expect(mathTools).not.toContain(tool1)
  })

  it('should validate tool input', () => {
    const tool = new TestTool()
    registry.register(tool)
    
    const validResult = registry.validateInput('test_tool', { message: 'Hello' })
    const invalidResult = registry.validateInput('test_tool', { message: '' })
    const notFoundResult = registry.validateInput('nonexistent', {})
    
    expect(validResult.valid).toBe(true)
    expect(invalidResult.valid).toBe(false)
    expect(notFoundResult.valid).toBe(false)
    expect(notFoundResult.errors).toContain("Tool 'nonexistent' not found")
  })

  it('should execute tools', async () => {
    const tool = new TestTool()
    registry.register(tool)
    
    const result = await registry.execute('test_tool', { message: 'Hello' }, mockContext)
    
    expect(result.success).toBe(true)
    expect(result.data.originalMessage).toBe('Hello')
  })

  it('should handle tool execution errors', async () => {
    const result = await registry.execute('nonexistent', {}, mockContext)
    
    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('TOOL_NOT_FOUND')
  })
})

describe('Built-in Tools', () => {
  describe('CalculatorTool', () => {
    let calculator: CalculatorTool

    beforeEach(() => {
      calculator = new CalculatorTool()
    })

    it('should perform basic calculations', async () => {
      const result = await calculator.execute({ expression: '2 + 3 * 4' }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBe(14)
      expect(result.data.expression).toBe('2 + 3 * 4')
    })

    it('should handle invalid expressions', async () => {
      const result = await calculator.execute({ expression: 'invalid' }, mockContext)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Calculation failed')
    })

    it('should validate expression format', async () => {
      const result = await calculator.execute({ expression: 'alert("hack")' }, mockContext)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Tool validation failed')
    })
  })

  describe('TextProcessorTool', () => {
    let textProcessor: TextProcessorTool

    beforeEach(() => {
      textProcessor = new TextProcessorTool()
    })

    it('should convert text to uppercase', async () => {
      const result = await textProcessor.execute({
        text: 'hello world',
        operation: 'uppercase'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBe('HELLO WORLD')
    })

    it('should count words', async () => {
      const result = await textProcessor.execute({
        text: 'hello world test',
        operation: 'word_count'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBe(3)
      expect(result.data.metadata.words).toEqual(['hello', 'world', 'test'])
    })

    it('should handle unknown operations', async () => {
      const result = await textProcessor.execute({
        text: 'hello',
        operation: 'unknown'
      }, mockContext)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Unknown operation')
    })
  })

  describe('JsonProcessorTool', () => {
    let jsonProcessor: JsonProcessorTool

    beforeEach(() => {
      jsonProcessor = new JsonProcessorTool()
    })

    it('should parse valid JSON', async () => {
      const result = await jsonProcessor.execute({
        data: '{"name": "John", "age": 30}',
        operation: 'parse'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toEqual({ name: 'John', age: 30 })
    })

    it('should validate JSON', async () => {
      const validResult = await jsonProcessor.execute({
        data: '{"valid": true}',
        operation: 'validate'
      }, mockContext)
      
      const invalidResult = await jsonProcessor.execute({
        data: '{invalid json}',
        operation: 'validate'
      }, mockContext)
      
      expect(validResult.success).toBe(true)
      expect(validResult.data.valid).toBe(true)
      
      expect(invalidResult.success).toBe(true)
      expect(invalidResult.data.valid).toBe(false)
    })

    it('should pretty print JSON', async () => {
      const result = await jsonProcessor.execute({
        data: '{"name":"John","age":30}',
        operation: 'pretty_print'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toContain('\\n')
      expect(result.data.result).toContain('  ')
    })

    it('should extract keys and values', async () => {
      const keysResult = await jsonProcessor.execute({
        data: '{"name": "John", "age": 30}',
        operation: 'extract_keys'
      }, mockContext)
      
      const valuesResult = await jsonProcessor.execute({
        data: '{"name": "John", "age": 30}',
        operation: 'extract_values'
      }, mockContext)
      
      expect(keysResult.success).toBe(true)
      expect(keysResult.data.result).toEqual(['name', 'age'])
      
      expect(valuesResult.success).toBe(true)
      expect(valuesResult.data.result).toEqual(['John', 30])
    })
  })

  describe('DateTimeTool', () => {
    let dateTime: DateTimeTool

    beforeEach(() => {
      dateTime = new DateTimeTool()
    })

    it('should get current time', async () => {
      const result = await dateTime.execute({ operation: 'now' }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.timestamp).toBeTypeOf('number')
      expect(result.data.iso).toMatch(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/)
    })

    it('should format dates', async () => {
      const result = await dateTime.execute({
        operation: 'format',
        date: '2023-01-01T12:00:00Z'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.iso).toBe('2023-01-01T12:00:00.000Z')
    })

    it('should parse dates', async () => {
      const result = await dateTime.execute({
        operation: 'parse',
        date: '2023-01-01T12:00:00Z'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.year).toBe(2023)
      expect(result.data.month).toBe(1)
      expect(result.data.day).toBe(1)
    })

    it('should add time', async () => {
      const result = await dateTime.execute({
        operation: 'add',
        date: '2023-01-01T12:00:00Z',
        amount: 1,
        unit: 'days'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBe('2023-01-02T12:00:00.000Z')
    })

    it('should handle invalid dates', async () => {
      const result = await dateTime.execute({
        operation: 'format',
        date: 'invalid-date'
      }, mockContext)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Invalid date format')
    })
  })

  describe('RandomGeneratorTool', () => {
    let randomGen: RandomGeneratorTool

    beforeEach(() => {
      randomGen = new RandomGeneratorTool()
    })

    it('should generate random numbers', async () => {
      const result = await randomGen.execute({
        type: 'number',
        min: 1,
        max: 10
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBeGreaterThanOrEqual(1)
      expect(result.data.result).toBeLessThanOrEqual(10)
    })

    it('should generate random strings', async () => {
      const result = await randomGen.execute({
        type: 'string',
        length: 8,
        charset: 'alphabetic'
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toHaveLength(8)
      expect(result.data.result).toMatch(/^[a-zA-Z]+$/)
    })

    it('should generate UUIDs', async () => {
      const result = await randomGen.execute({ type: 'uuid' }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate random booleans', async () => {
      const result = await randomGen.execute({ type: 'boolean' }, mockContext)
      
      expect(result.success).toBe(true)
      expect(typeof result.data.result).toBe('boolean')
    })

    it('should make random choices', async () => {
      const choices = ['apple', 'banana', 'cherry']
      const result = await randomGen.execute({
        type: 'choice',
        choices
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(choices).toContain(result.data.result)
      expect(result.data.totalChoices).toBe(3)
    })

    it('should generate passwords', async () => {
      const result = await randomGen.execute({
        type: 'password',
        length: 12
      }, mockContext)
      
      expect(result.success).toBe(true)
      expect(result.data.result).toHaveLength(12)
      expect(['weak', 'medium', 'strong']).toContain(result.data.strength)
    })

    it('should handle empty choices', async () => {
      const result = await randomGen.execute({
        type: 'choice',
        choices: []
      }, mockContext)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Choices array is required')
    })
  })
})

describe('Built-in Tools Integration', () => {
  it('should export all built-in tools', () => {
    expect(builtInTools).toHaveLength(6)
    expect(builtInTools.map(tool => tool.id)).toEqual([
      'calculator',
      'text_processor',
      'json_processor',
      'http_request',
      'datetime',
      'random_generator'
    ])
  })

  it('should register all built-in tools in registry', () => {
    const registry = new DefaultToolRegistry()
    
    builtInTools.forEach(tool => {
      registry.register(tool)
    })
    
    expect(registry.list()).toHaveLength(6)
    expect(registry.get('calculator')).toBeInstanceOf(CalculatorTool)
    expect(registry.get('text_processor')).toBeInstanceOf(TextProcessorTool)
  })

  it('should find tools by category', () => {
    const registry = new DefaultToolRegistry()
    
    builtInTools.forEach(tool => {
      registry.register(tool)
    })
    
    const mathTools = registry.find({ tags: ['math'] })
    const textTools = registry.find({ tags: ['text'] })
    const utilityTools = registry.find({ tags: ['utility'] })
    
    expect(mathTools).toHaveLength(1)
    expect(textTools).toHaveLength(1)
    expect(utilityTools).toHaveLength(2) // datetime and random_generator
  })
})