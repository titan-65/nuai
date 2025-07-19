import { PromptTemplate } from './index'

/**
 * Get prompt template
 */
export function getPromptTemplate(type: PromptTemplate, name: string): string {
  switch (type) {
    case 'chat':
      return getChatPromptTemplate(name)
    case 'completion':
      return getCompletionPromptTemplate(name)
    case 'system':
      return getSystemPromptTemplate(name)
    default:
      return getChatPromptTemplate(name)
  }
}

/**
 * Chat prompt template
 */
function getChatPromptTemplate(name: string): string {
  return `/**
 * ${name} - Chat prompt template
 */

export interface ${name}Variables {
  userMessage: string
  context?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export const ${name} = {
  name: '${name}',
  description: 'A chat prompt template for conversational AI',
  type: 'chat' as const,
  
  /**
   * System prompt for the chat
   */
  systemPrompt: \`You are a helpful AI assistant. You are knowledgeable, friendly, and always try to provide accurate and useful information.

Guidelines:
- Be conversational and engaging
- Provide clear and concise answers
- Ask clarifying questions when needed
- Be helpful and supportive
- Maintain context throughout the conversation

If you don't know something, admit it and offer to help find the information.\`,

  /**
   * Generate the chat prompt
   */
  generate(variables: ${name}Variables): string {
    let prompt = this.systemPrompt
    
    // Add context if provided
    if (variables.context) {
      prompt += \`\\n\\nContext: \${variables.context}\`
    }
    
    // Add conversation history
    if (variables.history && variables.history.length > 0) {
      prompt += '\\n\\nConversation History:'
      variables.history.forEach(message => {
        prompt += \`\\n\${message.role === 'user' ? 'User' : 'Assistant'}: \${message.content}\`
      })
    }
    
    // Add current user message
    prompt += \`\\n\\nUser: \${variables.userMessage}\\nAssistant:\`
    
    return prompt
  },

  /**
   * Generate messages for chat completion
   */
  generateMessages(variables: ${name}Variables) {
    const messages = [
      { role: 'system' as const, content: this.systemPrompt }
    ]
    
    // Add context as system message if provided
    if (variables.context) {
      messages.push({
        role: 'system' as const,
        content: \`Context: \${variables.context}\`
      })
    }
    
    // Add conversation history
    if (variables.history && variables.history.length > 0) {
      messages.push(...variables.history)
    }
    
    // Add current user message
    messages.push({
      role: 'user' as const,
      content: variables.userMessage
    })
    
    return messages
  },

  /**
   * Validate variables
   */
  validate(variables: ${name}Variables): boolean {
    return typeof variables.userMessage === 'string' && variables.userMessage.trim().length > 0
  },

  /**
   * Get default variables
   */
  getDefaults(): Partial<${name}Variables> {
    return {
      userMessage: '',
      context: undefined,
      history: []
    }
  }
}

// Export for use in components
export default ${name}`
}

/**
 * Completion prompt template
 */
function getCompletionPromptTemplate(name: string): string {
  return `/**
 * ${name} - Text completion prompt template
 */

export interface ${name}Variables {
  input: string
  instructions?: string
  examples?: Array<{ input: string; output: string }>
  format?: string
}

export const ${name} = {
  name: '${name}',
  description: 'A text completion prompt template',
  type: 'completion' as const,
  
  /**
   * Base instructions for completion
   */
  baseInstructions: \`Complete the following text in a helpful and coherent manner. Maintain the style and tone of the input while providing a natural continuation.\`,

  /**
   * Generate the completion prompt
   */
  generate(variables: ${name}Variables): string {
    let prompt = ''
    
    // Add custom instructions or use base instructions
    if (variables.instructions) {
      prompt += variables.instructions
    } else {
      prompt += this.baseInstructions
    }
    
    // Add format specification if provided
    if (variables.format) {
      prompt += \`\\n\\nFormat: \${variables.format}\`
    }
    
    // Add examples if provided
    if (variables.examples && variables.examples.length > 0) {
      prompt += '\\n\\nExamples:'
      variables.examples.forEach((example, index) => {
        prompt += \`\\n\\nExample \${index + 1}:`
        prompt += \`\\nInput: \${example.input}\`
        prompt += \`\\nOutput: \${example.output}\`
      })
    }
    
    // Add the input to complete
    prompt += \`\\n\\nInput: \${variables.input}\\nOutput:\`
    
    return prompt
  },

  /**
   * Generate with specific completion style
   */
  generateWithStyle(variables: ${name}Variables, style: 'creative' | 'factual' | 'concise' | 'detailed'): string {
    const styleInstructions = {
      creative: 'Complete the text in a creative and imaginative way.',
      factual: 'Complete the text with factual and accurate information.',
      concise: 'Complete the text in a concise and to-the-point manner.',
      detailed: 'Complete the text with detailed and comprehensive information.'
    }
    
    return this.generate({
      ...variables,
      instructions: styleInstructions[style] + (variables.instructions ? \` \${variables.instructions}\` : '')
    })
  },

  /**
   * Validate variables
   */
  validate(variables: ${name}Variables): boolean {
    return typeof variables.input === 'string' && variables.input.trim().length > 0
  },

  /**
   * Get default variables
   */
  getDefaults(): Partial<${name}Variables> {
    return {
      input: '',
      instructions: undefined,
      examples: [],
      format: undefined
    }
  }
}

// Export for use in components
export default ${name}`
}

/**
 * System prompt template
 */
function getSystemPromptTemplate(name: string): string {
  return `/**
 * ${name} - System prompt template
 */

export interface ${name}Variables {
  role: string
  context?: string
  constraints?: string[]
  objectives?: string[]
  examples?: string[]
}

export const ${name} = {
  name: '${name}',
  description: 'A system prompt template for defining AI behavior',
  type: 'system' as const,
  
  /**
   * Generate the system prompt
   */
  generate(variables: ${name}Variables): string {
    let prompt = \`You are \${variables.role}.\`
    
    // Add context if provided
    if (variables.context) {
      prompt += \`\\n\\nContext: \${variables.context}\`
    }
    
    // Add objectives if provided
    if (variables.objectives && variables.objectives.length > 0) {
      prompt += '\\n\\nYour objectives:'
      variables.objectives.forEach((objective, index) => {
        prompt += \`\\n\${index + 1}. \${objective}\`
      })
    }
    
    // Add constraints if provided
    if (variables.constraints && variables.constraints.length > 0) {
      prompt += '\\n\\nConstraints and guidelines:'
      variables.constraints.forEach((constraint, index) => {
        prompt += \`\\n- \${constraint}\`
      })
    }
    
    // Add examples if provided
    if (variables.examples && variables.examples.length > 0) {
      prompt += '\\n\\nExamples of good responses:'
      variables.examples.forEach((example, index) => {
        prompt += \`\\n\\nExample \${index + 1}: \${example}\`
      })
    }
    
    prompt += '\\n\\nAlways maintain this role and follow these guidelines in your responses.'
    
    return prompt
  },

  /**
   * Generate for specific AI model
   */
  generateForModel(variables: ${name}Variables, model: 'gpt' | 'claude' | 'generic'): string {
    const modelSpecificAdditions = {
      gpt: '\\n\\nRemember to be helpful, harmless, and honest in all your responses.',
      claude: '\\n\\nI aim to be helpful, harmless, and honest. I will decline requests that could cause harm.',
      generic: '\\n\\nProvide helpful and accurate responses while following ethical guidelines.'
    }
    
    const basePrompt = this.generate(variables)
    return basePrompt + modelSpecificAdditions[model]
  },

  /**
   * Create role-specific system prompt
   */
  createRolePrompt(role: string, domain: string, traits: string[]): string {
    return this.generate({
      role: \`a \${role} specializing in \${domain}\`,
      objectives: [
        \`Provide expert advice and information about \${domain}\`,
        'Help users solve problems in your area of expertise',
        'Explain complex concepts in an understandable way'
      ],
      constraints: [
        'Only provide information within your area of expertise',
        'Admit when you don\'t know something',
        'Always prioritize accuracy over speed',
        ...traits.map(trait => \`Maintain a \${trait} tone\`)
      ]
    })
  },

  /**
   * Validate variables
   */
  validate(variables: ${name}Variables): boolean {
    return typeof variables.role === 'string' && variables.role.trim().length > 0
  },

  /**
   * Get default variables
   */
  getDefaults(): Partial<${name}Variables> {
    return {
      role: 'a helpful AI assistant',
      context: undefined,
      constraints: [
        'Be helpful and informative',
        'Provide accurate information',
        'Be respectful and professional'
      ],
      objectives: [
        'Assist users with their questions and tasks',
        'Provide clear and useful responses'
      ],
      examples: []
    }
  }
}

// Export for use in components
export default ${name}`
}