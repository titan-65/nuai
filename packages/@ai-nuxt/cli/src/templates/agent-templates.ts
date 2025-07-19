import { AgentTemplate } from './index'

/**
 * Get agent template
 */
export function getAgentTemplate(type: AgentTemplate, name: string): string {
  switch (type) {
    case 'assistant':
      return getAssistantAgentTemplate(name)
    case 'researcher':
      return getResearcherAgentTemplate(name)
    case 'coder':
      return getCoderAgentTemplate(name)
    case 'custom':
      return getCustomAgentTemplate(name)
    default:
      return getAssistantAgentTemplate(name)
  }
}

/**
 * Assistant agent template
 */
function getAssistantAgentTemplate(name: string): string {
  return `import { defineAgent } from '@ai-nuxt/core'

/**
 * ${name} - A helpful AI assistant
 */
export const ${name} = defineAgent({
  name: '${name}',
  description: 'A helpful AI assistant that can answer questions and help with various tasks',
  
  capabilities: [
    'canUseTool',
    'canCommunicate',
    'canMakeDecisions'
  ],
  
  systemPrompt: \`You are a helpful AI assistant. You are knowledgeable, friendly, and always try to provide accurate and useful information. 

Your capabilities include:
- Answering questions on a wide range of topics
- Helping with problem-solving and decision-making
- Providing explanations and tutorials
- Assisting with creative tasks

Always be polite, professional, and helpful in your responses.\`,

  tools: [
    {
      name: 'search',
      description: 'Search for information on the internet',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          }
        },
        required: ['query']
      },
      execute: async (params: { query: string }) => {
        // Implement search functionality
        return \`Search results for: \${params.query}\`
      }
    },
    
    {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate'
          }
        },
        required: ['expression']
      },
      execute: async (params: { expression: string }) => {
        try {
          // Simple calculator (in production, use a proper math parser)
          const result = eval(params.expression)
          return \`Result: \${result}\`
        } catch (error) {
          return 'Error: Invalid mathematical expression'
        }
      }
    }
  ],

  async execute(input: string, context?: any) {
    try {
      // Process the input and generate a response
      const response = await this.chat(input, {
        systemPrompt: this.systemPrompt,
        tools: this.tools,
        context
      })
      
      return response
    } catch (error) {
      console.error('Agent execution error:', error)
      return 'I apologize, but I encountered an error while processing your request. Please try again.'
    }
  },

  async onStart() {
    console.log(\`\${this.name} agent started\`)
  },

  async onStop() {
    console.log(\`\${this.name} agent stopped\`)
  },

  async onError(error: Error) {
    console.error(\`\${this.name} agent error:\`, error)
  }
})`
}

/**
 * Researcher agent template
 */
function getResearcherAgentTemplate(name: string): string {
  return `import { defineAgent } from '@ai-nuxt/core'

/**
 * ${name} - An AI research assistant
 */
export const ${name} = defineAgent({
  name: '${name}',
  description: 'An AI research assistant specialized in information gathering, analysis, and synthesis',
  
  capabilities: [
    'canUseTool',
    'canCommunicate',
    'canMakeDecisions',
    'canLearn'
  ],
  
  systemPrompt: \`You are a research assistant AI. Your primary role is to help users gather, analyze, and synthesize information on various topics.

Your research capabilities include:
- Conducting thorough information searches
- Analyzing and summarizing findings
- Identifying credible sources
- Synthesizing information from multiple sources
- Providing citations and references
- Creating research reports and summaries

Always provide well-researched, accurate, and properly cited information. Be thorough but concise in your responses.\`,

  tools: [
    {
      name: 'webSearch',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Preferred sources to search'
          }
        },
        required: ['query']
      },
      execute: async (params: { query: string; sources?: string[] }) => {
        // Implement web search functionality
        return \`Web search results for: \${params.query}\`
      }
    },
    
    {
      name: 'academicSearch',
      description: 'Search academic databases and papers',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Academic search query'
          },
          field: {
            type: 'string',
            description: 'Academic field or discipline'
          }
        },
        required: ['query']
      },
      execute: async (params: { query: string; field?: string }) => {
        // Implement academic search functionality
        return \`Academic search results for: \${params.query}\`
      }
    },
    
    {
      name: 'summarize',
      description: 'Summarize long text or multiple sources',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to summarize'
          },
          length: {
            type: 'string',
            enum: ['brief', 'medium', 'detailed'],
            description: 'Summary length'
          }
        },
        required: ['text']
      },
      execute: async (params: { text: string; length?: string }) => {
        // Implement summarization functionality
        return \`Summary (\${params.length || 'medium'}): ...\`
      }
    },
    
    {
      name: 'factCheck',
      description: 'Verify facts and claims',
      parameters: {
        type: 'object',
        properties: {
          claim: {
            type: 'string',
            description: 'Claim or fact to verify'
          }
        },
        required: ['claim']
      },
      execute: async (params: { claim: string }) => {
        // Implement fact-checking functionality
        return \`Fact check result for: \${params.claim}\`
      }
    }
  ],

  async execute(input: string, context?: any) {
    try {
      // Analyze the research request
      const researchPlan = await this.planResearch(input)
      
      // Execute research steps
      const findings = await this.conductResearch(researchPlan)
      
      // Synthesize and present results
      const response = await this.synthesizeFindings(findings, input)
      
      return response
    } catch (error) {
      console.error('Research agent error:', error)
      return 'I encountered an error while conducting research. Please try rephrasing your request.'
    }
  },

  async planResearch(query: string) {
    // Create a research plan based on the query
    return {
      query,
      steps: [
        'Initial web search',
        'Academic source search',
        'Fact verification',
        'Synthesis and summary'
      ]
    }
  },

  async conductResearch(plan: any) {
    // Execute research steps
    const findings = []
    
    for (const step of plan.steps) {
      // Execute each research step
      findings.push(\`Results from: \${step}\`)
    }
    
    return findings
  },

  async synthesizeFindings(findings: string[], originalQuery: string) {
    // Synthesize research findings into a coherent response
    return \`Based on my research on "\${originalQuery}", here are the key findings: \${findings.join(', ')}\`
  }
})`
}

/**
 * Coder agent template
 */
function getCoderAgentTemplate(name: string): string {
  return `import { defineAgent } from '@ai-nuxt/core'

/**
 * ${name} - An AI coding assistant
 */
export const ${name} = defineAgent({
  name: '${name}',
  description: 'An AI coding assistant specialized in code generation, analysis, and debugging',
  
  capabilities: [
    'canUseTool',
    'canCommunicate',
    'canMakeDecisions',
    'canLearn'
  ],
  
  systemPrompt: \`You are a coding assistant AI. You specialize in helping developers with:

- Code generation and completion
- Code review and analysis
- Debugging and troubleshooting
- Architecture and design patterns
- Best practices and optimization
- Documentation and comments

You are proficient in multiple programming languages including JavaScript, TypeScript, Python, Java, C++, and more. Always provide clean, well-documented, and efficient code solutions.\`,

  tools: [
    {
      name: 'generateCode',
      description: 'Generate code based on requirements',
      parameters: {
        type: 'object',
        properties: {
          requirements: {
            type: 'string',
            description: 'Code requirements or specification'
          },
          language: {
            type: 'string',
            description: 'Programming language'
          },
          framework: {
            type: 'string',
            description: 'Framework or library to use'
          }
        },
        required: ['requirements', 'language']
      },
      execute: async (params: { requirements: string; language: string; framework?: string }) => {
        // Implement code generation
        return \`Generated \${params.language} code for: \${params.requirements}\`
      }
    },
    
    {
      name: 'analyzeCode',
      description: 'Analyze code for issues, improvements, and best practices',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to analyze'
          },
          language: {
            type: 'string',
            description: 'Programming language'
          }
        },
        required: ['code', 'language']
      },
      execute: async (params: { code: string; language: string }) => {
        // Implement code analysis
        return \`Code analysis for \${params.language} code\`
      }
    },
    
    {
      name: 'debugCode',
      description: 'Help debug code issues',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code with issues'
          },
          error: {
            type: 'string',
            description: 'Error message or description'
          },
          language: {
            type: 'string',
            description: 'Programming language'
          }
        },
        required: ['code', 'error', 'language']
      },
      execute: async (params: { code: string; error: string; language: string }) => {
        // Implement debugging assistance
        return \`Debugging suggestions for \${params.language} error: \${params.error}\`
      }
    },
    
    {
      name: 'optimizeCode',
      description: 'Optimize code for performance and readability',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to optimize'
          },
          language: {
            type: 'string',
            description: 'Programming language'
          },
          focus: {
            type: 'string',
            enum: ['performance', 'readability', 'memory', 'size'],
            description: 'Optimization focus'
          }
        },
        required: ['code', 'language']
      },
      execute: async (params: { code: string; language: string; focus?: string }) => {
        // Implement code optimization
        return \`Optimized \${params.language} code (focus: \${params.focus || 'general'})\`
      }
    },
    
    {
      name: 'generateTests',
      description: 'Generate unit tests for code',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Code to test'
          },
          language: {
            type: 'string',
            description: 'Programming language'
          },
          framework: {
            type: 'string',
            description: 'Testing framework'
          }
        },
        required: ['code', 'language']
      },
      execute: async (params: { code: string; language: string; framework?: string }) => {
        // Implement test generation
        return \`Generated tests for \${params.language} code using \${params.framework || 'default framework'}\`
      }
    }
  ],

  async execute(input: string, context?: any) {
    try {
      // Analyze the coding request
      const requestType = await this.analyzeRequest(input)
      
      // Execute appropriate coding task
      let response
      
      switch (requestType) {
        case 'generate':
          response = await this.handleCodeGeneration(input, context)
          break
        case 'debug':
          response = await this.handleDebugging(input, context)
          break
        case 'review':
          response = await this.handleCodeReview(input, context)
          break
        case 'optimize':
          response = await this.handleOptimization(input, context)
          break
        default:
          response = await this.handleGeneralCoding(input, context)
      }
      
      return response
    } catch (error) {
      console.error('Coding agent error:', error)
      return 'I encountered an error while processing your coding request. Please provide more details or try again.'
    }
  },

  async analyzeRequest(input: string): Promise<string> {
    // Analyze the type of coding request
    if (input.toLowerCase().includes('generate') || input.toLowerCase().includes('create')) {
      return 'generate'
    } else if (input.toLowerCase().includes('debug') || input.toLowerCase().includes('error')) {
      return 'debug'
    } else if (input.toLowerCase().includes('review') || input.toLowerCase().includes('analyze')) {
      return 'review'
    } else if (input.toLowerCase().includes('optimize') || input.toLowerCase().includes('improve')) {
      return 'optimize'
    }
    return 'general'
  },

  async handleCodeGeneration(input: string, context?: any): Promise<string> {
    // Handle code generation requests
    return \`I'll help you generate code for: \${input}\`
  },

  async handleDebugging(input: string, context?: any): Promise<string> {
    // Handle debugging requests
    return \`I'll help you debug: \${input}\`
  },

  async handleCodeReview(input: string, context?: any): Promise<string> {
    // Handle code review requests
    return \`I'll review your code: \${input}\`
  },

  async handleOptimization(input: string, context?: any): Promise<string> {
    // Handle optimization requests
    return \`I'll help optimize: \${input}\`
  },

  async handleGeneralCoding(input: string, context?: any): Promise<string> {
    // Handle general coding questions
    return \`I'll help with your coding question: \${input}\`
  }
})`
}

/**
 * Custom agent template
 */
function getCustomAgentTemplate(name: string): string {
  return `import { defineAgent } from '@ai-nuxt/core'

/**
 * ${name} - A custom AI agent
 */
export const ${name} = defineAgent({
  name: '${name}',
  description: 'A custom AI agent tailored for specific tasks',
  
  capabilities: [
    'canUseTool',
    'canCommunicate'
    // Add more capabilities as needed:
    // 'canMakeDecisions',
    // 'canLearn'
  ],
  
  systemPrompt: \`You are a custom AI agent. Define your role and capabilities here.

Your specific tasks include:
- [Define your agent's primary tasks]
- [Add more specific capabilities]
- [Describe the agent's expertise]

Always be helpful and focused on your specific domain of expertise.\`,

  tools: [
    // Define custom tools for your agent
    {
      name: 'customTool',
      description: 'A custom tool for this agent',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Input for the custom tool'
          }
        },
        required: ['input']
      },
      execute: async (params: { input: string }) => {
        // Implement your custom tool logic
        return \`Custom tool result for: \${params.input}\`
      }
    }
    
    // Add more tools as needed
  ],

  async execute(input: string, context?: any) {
    try {
      // Implement your custom agent logic here
      
      // Example: Process input and generate response
      const response = await this.processInput(input, context)
      
      return response
    } catch (error) {
      console.error('Custom agent error:', error)
      return 'I encountered an error while processing your request. Please try again.'
    }
  },

  async processInput(input: string, context?: any): Promise<string> {
    // Implement your custom input processing logic
    
    // Example: Use AI chat with system prompt
    const response = await this.chat(input, {
      systemPrompt: this.systemPrompt,
      tools: this.tools,
      context
    })
    
    return response
  },

  // Optional lifecycle methods
  async onStart() {
    console.log(\`\${this.name} agent started\`)
    // Add initialization logic
  },

  async onStop() {
    console.log(\`\${this.name} agent stopped\`)
    // Add cleanup logic
  },

  async onError(error: Error) {
    console.error(\`\${this.name} agent error:\`, error)
    // Add error handling logic
  }
})`
}