import { BaseTool } from './tools'
import type { AgentExecutionContext } from './agents'
import type { ToolParameterSchema } from './tools'

/**
 * Calculator tool for basic mathematical operations
 */
export class CalculatorTool extends BaseTool {
  constructor() {
    super({
      id: 'calculator',
      name: 'Calculator',
      description: 'Perform basic mathematical calculations',
      category: 'math',
      tags: ['math', 'calculation', 'arithmetic'],
      inputSchema: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")',
          required: true,
          pattern: '^[0-9+\\-*/().\\s]+$'
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'number' },
          expression: { type: 'string' }
        }
      }
    })
  }

  protected async executeInternal(input: { expression: string }, context: AgentExecutionContext): Promise<any> {
    try {
      // Simple expression evaluator (in production, use a proper math parser)
      const result = Function(`"use strict"; return (${input.expression})`)()
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid mathematical expression or result')
      }

      return {
        result,
        expression: input.expression
      }
    } catch (error: any) {
      throw new Error(`Calculation failed: ${error.message}`)
    }
  }
}

/**
 * Text processing tool for common string operations
 */
export class TextProcessorTool extends BaseTool {
  constructor() {
    super({
      id: 'text_processor',
      name: 'Text Processor',
      description: 'Process text with various operations like uppercase, lowercase, word count, etc.',
      category: 'text',
      tags: ['text', 'string', 'processing'],
      inputSchema: {
        text: {
          type: 'string',
          description: 'Text to process',
          required: true,
          maxLength: 10000
        },
        operation: {
          type: 'string',
          description: 'Operation to perform',
          required: true,
          enum: ['uppercase', 'lowercase', 'word_count', 'char_count', 'reverse', 'trim', 'title_case']
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
          operation: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    })
  }

  protected async executeInternal(input: { text: string, operation: string }, context: AgentExecutionContext): Promise<any> {
    const { text, operation } = input
    let result: string | number
    let metadata: any = {}

    switch (operation) {
      case 'uppercase':
        result = text.toUpperCase()
        break
      case 'lowercase':
        result = text.toLowerCase()
        break
      case 'word_count':
        result = text.trim().split(/\\s+/).filter(word => word.length > 0).length
        metadata.words = text.trim().split(/\\s+/).filter(word => word.length > 0)
        break
      case 'char_count':
        result = text.length
        metadata.withoutSpaces = text.replace(/\\s/g, '').length
        break
      case 'reverse':
        result = text.split('').reverse().join('')
        break
      case 'trim':
        result = text.trim()
        metadata.originalLength = text.length
        metadata.trimmedLength = result.length
        break
      case 'title_case':
        result = text.replace(/\\w\\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        )
        break
      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

    return {
      result,
      operation,
      metadata
    }
  }
}

/**
 * JSON processor tool for JSON operations
 */
export class JsonProcessorTool extends BaseTool {
  constructor() {
    super({
      id: 'json_processor',
      name: 'JSON Processor',
      description: 'Parse, validate, and manipulate JSON data',
      category: 'data',
      tags: ['json', 'data', 'parsing'],
      inputSchema: {
        data: {
          type: 'string',
          description: 'JSON string to process or JavaScript object',
          required: true
        },
        operation: {
          type: 'string',
          description: 'Operation to perform',
          required: true,
          enum: ['parse', 'stringify', 'validate', 'pretty_print', 'minify', 'extract_keys', 'extract_values']
        },
        path: {
          type: 'string',
          description: 'JSON path for extraction operations (e.g., "user.name")',
          required: false
        }
      }
    })
  }

  protected async executeInternal(input: { data: string, operation: string, path?: string }, context: AgentExecutionContext): Promise<any> {
    const { data, operation, path } = input

    try {
      let jsonData: any
      
      // Try to parse the data if it's a string
      if (typeof data === 'string') {
        try {
          jsonData = JSON.parse(data)
        } catch {
          if (operation === 'validate') {
            return { valid: false, error: 'Invalid JSON format' }
          }
          throw new Error('Invalid JSON format')
        }
      } else {
        jsonData = data
      }

      switch (operation) {
        case 'parse':
          return { result: jsonData, type: typeof jsonData }
        
        case 'stringify':
          return { result: JSON.stringify(jsonData) }
        
        case 'validate':
          return { valid: true, type: typeof jsonData }
        
        case 'pretty_print':
          return { result: JSON.stringify(jsonData, null, 2) }
        
        case 'minify':
          return { result: JSON.stringify(jsonData) }
        
        case 'extract_keys':
          if (typeof jsonData === 'object' && jsonData !== null) {
            return { result: Object.keys(jsonData) }
          }
          throw new Error('Data must be an object to extract keys')
        
        case 'extract_values':
          if (typeof jsonData === 'object' && jsonData !== null) {
            return { result: Object.values(jsonData) }
          }
          throw new Error('Data must be an object to extract values')
        
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }
    } catch (error: any) {
      throw new Error(`JSON processing failed: ${error.message}`)
    }
  }
}

/**
 * HTTP request tool for making web requests
 */
export class HttpRequestTool extends BaseTool {
  constructor() {
    super({
      id: 'http_request',
      name: 'HTTP Request',
      description: 'Make HTTP requests to web APIs',
      category: 'network',
      tags: ['http', 'api', 'web', 'request'],
      requiresPermission: true,
      inputSchema: {
        url: {
          type: 'string',
          description: 'URL to make the request to',
          required: true,
          pattern: '^https?://.+'
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          required: false,
          default: 'GET',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
        },
        headers: {
          type: 'object',
          description: 'HTTP headers',
          required: false
        },
        body: {
          type: 'string',
          description: 'Request body (for POST, PUT, PATCH)',
          required: false
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
          required: false,
          default: 10000,
          minimum: 1000,
          maximum: 60000
        }
      }
    })
  }

  protected async executeInternal(input: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }, context: AgentExecutionContext): Promise<any> {
    const { url, method = 'GET', headers = {}, body, timeout = 10000 } = input

    try {
      // In a real implementation, you'd use fetch or a proper HTTP client
      // This is a simplified version for demonstration
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'AI-Nuxt-Agent/1.0',
          ...headers
        },
        body: body && ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      let responseData: any = responseText

      // Try to parse as JSON
      try {
        responseData = JSON.parse(responseText)
      } catch {
        // Keep as text if not valid JSON
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        url: response.url
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw new Error(`HTTP request failed: ${error.message}`)
    }
  }
}

/**
 * Date/Time tool for date operations
 */
export class DateTimeTool extends BaseTool {
  constructor() {
    super({
      id: 'datetime',
      name: 'Date Time',
      description: 'Work with dates and times',
      category: 'utility',
      tags: ['date', 'time', 'datetime', 'utility'],
      inputSchema: {
        operation: {
          type: 'string',
          description: 'Date operation to perform',
          required: true,
          enum: ['now', 'format', 'parse', 'add', 'subtract', 'diff', 'timezone_convert']
        },
        date: {
          type: 'string',
          description: 'Date string (ISO format preferred)',
          required: false
        },
        format: {
          type: 'string',
          description: 'Date format string',
          required: false
        },
        amount: {
          type: 'number',
          description: 'Amount to add/subtract',
          required: false
        },
        unit: {
          type: 'string',
          description: 'Time unit',
          required: false,
          enum: ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']
        },
        timezone: {
          type: 'string',
          description: 'Target timezone',
          required: false
        }
      }
    })
  }

  protected async executeInternal(input: {
    operation: string
    date?: string
    format?: string
    amount?: number
    unit?: string
    timezone?: string
  }, context: AgentExecutionContext): Promise<any> {
    const { operation, date, format, amount, unit, timezone } = input

    try {
      switch (operation) {
        case 'now':
          return {
            timestamp: Date.now(),
            iso: new Date().toISOString(),
            local: new Date().toString()
          }

        case 'format':
          if (!date) throw new Error('Date is required for format operation')
          const dateObj = new Date(date)
          if (isNaN(dateObj.getTime())) throw new Error('Invalid date format')
          
          return {
            iso: dateObj.toISOString(),
            local: dateObj.toString(),
            date: dateObj.toDateString(),
            time: dateObj.toTimeString(),
            timestamp: dateObj.getTime()
          }

        case 'parse':
          if (!date) throw new Error('Date is required for parse operation')
          const parsed = new Date(date)
          if (isNaN(parsed.getTime())) throw new Error('Invalid date format')
          
          return {
            timestamp: parsed.getTime(),
            iso: parsed.toISOString(),
            year: parsed.getFullYear(),
            month: parsed.getMonth() + 1,
            day: parsed.getDate(),
            hour: parsed.getHours(),
            minute: parsed.getMinutes(),
            second: parsed.getSeconds()
          }

        case 'add':
        case 'subtract':
          if (!date || amount === undefined || !unit) {
            throw new Error('Date, amount, and unit are required for add/subtract operations')
          }
          
          const baseDate = new Date(date)
          if (isNaN(baseDate.getTime())) throw new Error('Invalid date format')
          
          const multiplier = operation === 'add' ? 1 : -1
          const milliseconds = this.getMilliseconds(amount * multiplier, unit)
          
          const resultDate = new Date(baseDate.getTime() + milliseconds)
          
          return {
            result: resultDate.toISOString(),
            original: baseDate.toISOString(),
            operation: `${operation} ${amount} ${unit}`
          }

        case 'diff':
          // This would require two dates - simplified for demo
          throw new Error('Diff operation not implemented in this demo')

        case 'timezone_convert':
          // This would require timezone conversion logic
          throw new Error('Timezone conversion not implemented in this demo')

        default:
          throw new Error(`Unknown operation: ${operation}`)
      }
    } catch (error: any) {
      throw new Error(`DateTime operation failed: ${error.message}`)
    }
  }

  private getMilliseconds(amount: number, unit: string): number {
    const multipliers: Record<string, number> = {
      milliseconds: 1,
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000, // Approximate
      years: 365 * 24 * 60 * 60 * 1000 // Approximate
    }

    const multiplier = multipliers[unit]
    if (!multiplier) {
      throw new Error(`Unknown time unit: ${unit}`)
    }

    return amount * multiplier
  }
}

/**
 * Random generator tool
 */
export class RandomGeneratorTool extends BaseTool {
  constructor() {
    super({
      id: 'random_generator',
      name: 'Random Generator',
      description: 'Generate random numbers, strings, and other data',
      category: 'utility',
      tags: ['random', 'generator', 'utility'],
      inputSchema: {
        type: {
          type: 'string',
          description: 'Type of random data to generate',
          required: true,
          enum: ['number', 'string', 'uuid', 'boolean', 'choice', 'password']
        },
        min: {
          type: 'number',
          description: 'Minimum value (for numbers)',
          required: false
        },
        max: {
          type: 'number',
          description: 'Maximum value (for numbers)',
          required: false
        },
        length: {
          type: 'number',
          description: 'Length (for strings/passwords)',
          required: false,
          default: 10,
          minimum: 1,
          maximum: 100
        },
        choices: {
          type: 'array',
          description: 'Array of choices to pick from',
          required: false
        },
        charset: {
          type: 'string',
          description: 'Character set for string generation',
          required: false,
          enum: ['alphanumeric', 'alphabetic', 'numeric', 'lowercase', 'uppercase', 'symbols']
        }
      }
    })
  }

  protected async executeInternal(input: {
    type: string
    min?: number
    max?: number
    length?: number
    choices?: any[]
    charset?: string
  }, context: AgentExecutionContext): Promise<any> {
    const { type, min = 0, max = 100, length = 10, choices, charset = 'alphanumeric' } = input

    switch (type) {
      case 'number':
        const randomNum = Math.random() * (max - min) + min
        return {
          result: Math.floor(randomNum),
          min,
          max
        }

      case 'string':
        const chars = this.getCharset(charset)
        let result = ''
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return {
          result,
          length,
          charset
        }

      case 'uuid':
        // Simple UUID v4 generator
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
        return { result: uuid }

      case 'boolean':
        return { result: Math.random() < 0.5 }

      case 'choice':
        if (!choices || choices.length === 0) {
          throw new Error('Choices array is required and must not be empty')
        }
        const randomIndex = Math.floor(Math.random() * choices.length)
        return {
          result: choices[randomIndex],
          index: randomIndex,
          totalChoices: choices.length
        }

      case 'password':
        const passwordChars = this.getCharset('alphanumeric') + '!@#$%^&*()_+-=[]{}|;:,.<>?'
        let password = ''
        for (let i = 0; i < length; i++) {
          password += passwordChars.charAt(Math.floor(Math.random() * passwordChars.length))
        }
        return {
          result: password,
          length,
          strength: this.calculatePasswordStrength(password)
        }

      default:
        throw new Error(`Unknown random type: ${type}`)
    }
  }

  private getCharset(charset: string): string {
    const charsets: Record<string, string> = {
      numeric: '0123456789',
      alphabetic: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    }

    return charsets[charset] || charsets.alphanumeric
  }

  private calculatePasswordStrength(password: string): string {
    let score = 0
    
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score < 3) return 'weak'
    if (score < 5) return 'medium'
    return 'strong'
  }
}

// Export all built-in tools
export const builtInTools = [
  new CalculatorTool(),
  new TextProcessorTool(),
  new JsonProcessorTool(),
  new HttpRequestTool(),
  new DateTimeTool(),
  new RandomGeneratorTool()
]