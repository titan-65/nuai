import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { createAIProvider } from '@ai-nuxt/core'
import type { AIProvider, ChatMessage } from '@ai-nuxt/core'
import { ConfigManager } from '../utils/config.js'
import { Logger } from '../utils/logger.js'
import { formatResponse, formatTokenUsage } from '../utils/formatters.js'

export interface ChatSessionOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class ChatSession {
  private provider: AIProvider | null = null
  private messages: ChatMessage[] = []
  private configManager: ConfigManager
  private logger: Logger
  private options: ChatSessionOptions

  constructor(options: ChatSessionOptions = {}) {
    this.options = options
    this.configManager = new ConfigManager()
    this.logger = new Logger()
  }

  async initialize(): Promise<void> {
    const config = this.configManager.getConfig()
    
    // Determine provider and model
    const providerName = this.options.provider || config.defaultProvider || 'openai'
    const model = this.options.model || config.defaultModel || 'gpt-4'
    
    try {
      this.provider = await createAIProvider(providerName, {
        model,
        temperature: this.options.temperature || config.temperature || 0.7,
        maxTokens: this.options.maxTokens || config.maxTokens || 2048
      })
      
      // Add system message
      this.messages.push({
        role: 'system',
        content: this.getSystemPrompt()
      })
      
    } catch (error) {
      throw new Error(`Failed to initialize AI provider: ${error.message}`)
    }
  }

  async startChat(): Promise<void> {
    if (!this.provider) {
      throw new Error('Chat session not initialized')
    }

    let isActive = true
    
    while (isActive) {
      try {
        const { message } = await inquirer.prompt([{
          type: 'input',
          name: 'message',
          message: chalk.cyan('You:'),
          validate: (input) => input.trim().length > 0 || 'Please enter a message'
        }])

        if (message.toLowerCase().trim() === 'exit') {
          isActive = false
          break
        }

        // Handle special commands
        if (message.startsWith('/')) {
          await this.handleCommand(message)
          continue
        }

        // Add user message
        this.messages.push({
          role: 'user',
          content: message
        })

        // Get AI response
        await this.getAIResponse()

      } catch (error) {
        if (error.name === 'ExitPromptError') {
          isActive = false
          break
        }
        this.logger.error('Chat error:', error)
      }
    }
  }

  private async getAIResponse(): Promise<void> {
    const spinner = ora('AI is thinking...').start()
    
    try {
      const response = await this.provider!.chat({
        messages: this.messages,
        stream: false
      })

      spinner.stop()

      // Add AI response to messages
      this.messages.push({
        role: 'assistant',
        content: response.text
      })

      // Display response
      console.log(chalk.green('\nAI:'))
      console.log(formatResponse(response.text))
      
      // Show token usage if available
      if (response.usage) {
        console.log(chalk.gray(formatTokenUsage(response.usage)))
      }
      
      console.log() // Empty line for spacing

    } catch (error) {
      spinner.fail('Failed to get AI response')
      this.logger.error(error)
    }
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ')
    
    switch (cmd.toLowerCase()) {
      case 'help':
        this.showHelp()
        break
      case 'clear':
        this.clearChat()
        break
      case 'history':
        this.showHistory()
        break
      case 'save':
        await this.saveChat(args[0])
        break
      case 'load':
        await this.loadChat(args[0])
        break
      case 'model':
        await this.switchModel(args[0])
        break
      case 'temperature':
        await this.setTemperature(parseFloat(args[0]))
        break
      case 'tokens':
        this.showTokenUsage()
        break
      case 'export':
        await this.exportChat(args[0])
        break
      default:
        console.log(chalk.red(`Unknown command: ${cmd}`))
        this.showHelp()
    }
  }

  private showHelp(): void {
    console.log(chalk.cyan('\n📖 Available Commands:'))
    console.log('  /help        - Show this help message')
    console.log('  /clear       - Clear chat history')
    console.log('  /history     - Show conversation history')
    console.log('  /save <name> - Save current conversation')
    console.log('  /load <name> - Load saved conversation')
    console.log('  /model <name>- Switch AI model')
    console.log('  /temperature - Set temperature (0-1)')
    console.log('  /tokens      - Show token usage statistics')
    console.log('  /export <fmt>- Export chat (json, md, txt)')
    console.log('  exit         - Exit chat mode\n')
  }

  private clearChat(): void {
    this.messages = [{
      role: 'system',
      content: this.getSystemPrompt()
    }]
    console.log(chalk.green('✅ Chat history cleared'))
  }

  private showHistory(): void {
    console.log(chalk.cyan('\n📜 Conversation History:'))
    
    this.messages.slice(1).forEach((msg, index) => {
      const role = msg.role === 'user' ? chalk.blue('You') : chalk.green('AI')
      const content = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...'
        : msg.content
      
      console.log(`${index + 1}. ${role}: ${content}`)
    })
    console.log()
  }

  private async saveChat(name?: string): Promise<void> {
    if (!name) {
      const { chatName } = await inquirer.prompt([{
        type: 'input',
        name: 'chatName',
        message: 'Enter chat name:',
        validate: (input) => input.trim().length > 0 || 'Please enter a name'
      }])
      name = chatName
    }

    try {
      this.configManager.saveChat(name, this.messages)
      console.log(chalk.green(`✅ Chat saved as "${name}"`))
    } catch (error) {
      console.log(chalk.red(`❌ Failed to save chat: ${error.message}`))
    }
  }

  private async loadChat(name?: string): Promise<void> {
    if (!name) {
      const savedChats = this.configManager.getSavedChats()
      
      if (savedChats.length === 0) {
        console.log(chalk.yellow('No saved chats found'))
        return
      }

      const { chatName } = await inquirer.prompt([{
        type: 'list',
        name: 'chatName',
        message: 'Select chat to load:',
        choices: savedChats
      }])
      name = chatName
    }

    try {
      const messages = this.configManager.loadChat(name)
      this.messages = messages
      console.log(chalk.green(`✅ Chat "${name}" loaded`))
    } catch (error) {
      console.log(chalk.red(`❌ Failed to load chat: ${error.message}`))
    }
  }

  private async switchModel(model?: string): Promise<void> {
    if (!model) {
      const { newModel } = await inquirer.prompt([{
        type: 'input',
        name: 'newModel',
        message: 'Enter model name:',
        default: 'gpt-4'
      }])
      model = newModel
    }

    try {
      // Reinitialize provider with new model
      const config = this.configManager.getConfig()
      const providerName = this.options.provider || config.defaultProvider || 'openai'
      
      this.provider = await createAIProvider(providerName, {
        model,
        temperature: this.options.temperature || config.temperature || 0.7,
        maxTokens: this.options.maxTokens || config.maxTokens || 2048
      })
      
      console.log(chalk.green(`✅ Switched to model: ${model}`))
    } catch (error) {
      console.log(chalk.red(`❌ Failed to switch model: ${error.message}`))
    }
  }

  private async setTemperature(temperature: number): Promise<void> {
    if (isNaN(temperature) || temperature < 0 || temperature > 1) {
      console.log(chalk.red('❌ Temperature must be between 0 and 1'))
      return
    }

    this.options.temperature = temperature
    console.log(chalk.green(`✅ Temperature set to ${temperature}`))
  }

  private showTokenUsage(): void {
    const totalMessages = this.messages.length - 1 // Exclude system message
    const userMessages = this.messages.filter(m => m.role === 'user').length
    const aiMessages = this.messages.filter(m => m.role === 'assistant').length
    
    console.log(chalk.cyan('\n📊 Token Usage Statistics:'))
    console.log(`Total messages: ${totalMessages}`)
    console.log(`User messages: ${userMessages}`)
    console.log(`AI messages: ${aiMessages}`)
    console.log()
  }

  private async exportChat(format?: string): Promise<void> {
    if (!format) {
      const { exportFormat } = await inquirer.prompt([{
        type: 'list',
        name: 'exportFormat',
        message: 'Select export format:',
        choices: ['json', 'markdown', 'text']
      }])
      format = exportFormat
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `chat-export-${timestamp}.${format}`
      
      let content: string
      
      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(this.messages, null, 2)
          break
        case 'markdown':
        case 'md':
          content = this.formatAsMarkdown()
          break
        case 'text':
        case 'txt':
          content = this.formatAsText()
          break
        default:
          throw new Error(`Unsupported format: ${format}`)
      }

      const { writeFileSync } = await import('fs')
      writeFileSync(filename, content, 'utf8')
      
      console.log(chalk.green(`✅ Chat exported to ${filename}`))
    } catch (error) {
      console.log(chalk.red(`❌ Failed to export chat: ${error.message}`))
    }
  }

  private formatAsMarkdown(): string {
    const lines = ['# AI Nuxt Chat Export', '']
    
    this.messages.slice(1).forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'AI Assistant'
      lines.push(`## ${role}`, '', msg.content, '')
    })
    
    return lines.join('\n')
  }

  private formatAsText(): string {
    const lines = ['AI Nuxt Chat Export', '='.repeat(20), '']
    
    this.messages.slice(1).forEach((msg, index) => {
      const role = msg.role === 'user' ? 'You' : 'AI'
      lines.push(`[${index + 1}] ${role}: ${msg.content}`, '')
    })
    
    return lines.join('\n')
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant specialized in helping developers with Nuxt.js and AI integration. 
You have access to the AI Nuxt framework and can help with:
- Building AI-powered Nuxt applications
- Configuring AI providers (OpenAI, Anthropic, Ollama)
- Creating and managing AI agents
- Implementing RAG (Retrieval-Augmented Generation)
- Vector stores and semantic search
- AI component development
- Testing and debugging AI features

Be helpful, concise, and provide practical code examples when appropriate.
If you're unsure about something, ask for clarification rather than guessing.`
  }
}