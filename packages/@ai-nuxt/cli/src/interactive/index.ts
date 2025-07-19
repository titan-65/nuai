import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createAIProvider } from '@ai-nuxt/core'
import { ChatSession } from './chat-session.js'
import { ProjectAnalyzer } from './project-analyzer.js'
import { ConfigManager } from '../utils/config.js'
import { Logger } from '../utils/logger.js'

export interface InteractiveOptions {
  provider?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class InteractiveMode {
  private chatSession: ChatSession
  private projectAnalyzer: ProjectAnalyzer
  private configManager: ConfigManager
  private logger: Logger
  private isRunning = false

  constructor(options: InteractiveOptions = {}) {
    this.configManager = new ConfigManager()
    this.logger = new Logger()
    this.projectAnalyzer = new ProjectAnalyzer()
    this.chatSession = new ChatSession({
      provider: options.provider,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    })
  }

  async start(): Promise<void> {
    this.isRunning = true
    
    try {
      // Initialize session
      await this.initialize()
      
      // Main interaction loop
      await this.interactionLoop()
    } catch (error) {
      this.logger.error('Interactive mode failed:', error)
    } finally {
      this.isRunning = false
    }
  }

  private async initialize(): Promise<void> {
    const spinner = ora('Initializing AI Nuxt...').start()
    
    try {
      // Check if we're in a Nuxt project
      const isNuxtProject = this.projectAnalyzer.isNuxtProject()
      
      if (isNuxtProject) {
        spinner.text = 'Analyzing Nuxt project...'
        await this.projectAnalyzer.analyzeProject()
        
        const projectInfo = this.projectAnalyzer.getProjectInfo()
        spinner.succeed(`Found Nuxt project: ${chalk.cyan(projectInfo.name)}`)
        
        // Show project summary
        this.showProjectSummary(projectInfo)
      } else {
        spinner.info('Not in a Nuxt project directory')
        
        const { shouldInit } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldInit',
          message: 'Would you like to create a new AI Nuxt project?',
          default: true
        }])
        
        if (shouldInit) {
          const { createProject } = await import('../commands/init.js')
          await createProject({ name: 'my-ai-nuxt-app' })
          return
        }
      }
      
      // Initialize chat session
      spinner.start('Setting up AI provider...')
      await this.chatSession.initialize()
      spinner.succeed('AI provider ready')
      
      // Show welcome message
      this.showWelcomeMessage()
      
    } catch (error) {
      spinner.fail('Initialization failed')
      throw error
    }
  }

  private async interactionLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '💬 Chat with AI', value: 'chat' },
            { name: '🤖 Manage Agents', value: 'agents' },
            { name: '🔧 Configure Providers', value: 'providers' },
            { name: '📊 Project Analysis', value: 'analyze' },
            { name: '🧪 Test AI Features', value: 'test' },
            { name: '📚 Generate Documentation', value: 'docs' },
            { name: '🚀 Deploy Project', value: 'deploy' },
            { name: '⚙️  Settings', value: 'settings' },
            new inquirer.Separator(),
            { name: '❌ Exit', value: 'exit' }
          ]
        }])

        switch (action) {
          case 'chat':
            await this.startChatMode()
            break
          case 'agents':
            await this.manageAgents()
            break
          case 'providers':
            await this.configureProviders()
            break
          case 'analyze':
            await this.analyzeProject()
            break
          case 'test':
            await this.testAIFeatures()
            break
          case 'docs':
            await this.generateDocs()
            break
          case 'deploy':
            await this.deployProject()
            break
          case 'settings':
            await this.showSettings()
            break
          case 'exit':
            this.isRunning = false
            console.log(chalk.cyan('👋 Thanks for using AI Nuxt CLI!'))
            break
        }
      } catch (error) {
        if (error.name === 'ExitPromptError') {
          this.isRunning = false
          break
        }
        this.logger.error('Action failed:', error)
      }
    }
  }

  private async startChatMode(): Promise<void> {
    console.log(chalk.cyan('\n💬 Starting chat mode...'))
    console.log(chalk.gray('Type "exit" to return to main menu\n'))
    
    await this.chatSession.startChat()
  }

  private async manageAgents(): Promise<void> {
    const { AgentManager } = await import('./agent-manager.js')
    const agentManager = new AgentManager()
    await agentManager.showMenu()
  }

  private async configureProviders(): Promise<void> {
    const { ProviderManager } = await import('./provider-manager.js')
    const providerManager = new ProviderManager()
    await providerManager.showMenu()
  }

  private async analyzeProject(): Promise<void> {
    const spinner = ora('Analyzing project...').start()
    
    try {
      await this.projectAnalyzer.analyzeProject()
      const analysis = this.projectAnalyzer.getDetailedAnalysis()
      
      spinner.succeed('Project analysis complete')
      
      console.log(chalk.cyan('\n📊 Project Analysis:'))
      console.log(`Files: ${analysis.fileCount}`)
      console.log(`Components: ${analysis.componentCount}`)
      console.log(`Pages: ${analysis.pageCount}`)
      console.log(`AI Features: ${analysis.aiFeatures.length > 0 ? analysis.aiFeatures.join(', ') : 'None detected'}`)
      
      if (analysis.recommendations.length > 0) {
        console.log(chalk.yellow('\n💡 Recommendations:'))
        analysis.recommendations.forEach(rec => {
          console.log(`  • ${rec}`)
        })
      }
    } catch (error) {
      spinner.fail('Analysis failed')
      this.logger.error(error)
    }
  }

  private async testAIFeatures(): Promise<void> {
    const { TestRunner } = await import('./test-runner.js')
    const testRunner = new TestRunner()
    await testRunner.showMenu()
  }

  private async generateDocs(): Promise<void> {
    const { DocGenerator } = await import('./doc-generator.js')
    const docGenerator = new DocGenerator()
    await docGenerator.generate()
  }

  private async deployProject(): Promise<void> {
    const { DeployManager } = await import('./deploy-manager.js')
    const deployManager = new DeployManager()
    await deployManager.showMenu()
  }

  private async showSettings(): Promise<void> {
    const config = this.configManager.getConfig()
    
    console.log(chalk.cyan('\n⚙️  Current Settings:'))
    console.log(`Provider: ${config.defaultProvider || 'Not set'}`)
    console.log(`Model: ${config.defaultModel || 'Not set'}`)
    console.log(`Temperature: ${config.temperature || 0.7}`)
    console.log(`Max Tokens: ${config.maxTokens || 2048}`)
    
    const { shouldEdit } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldEdit',
      message: 'Would you like to edit settings?',
      default: false
    }])
    
    if (shouldEdit) {
      await this.editSettings()
    }
  }

  private async editSettings(): Promise<void> {
    const config = this.configManager.getConfig()
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Default AI provider:',
        choices: ['openai', 'anthropic', 'ollama'],
        default: config.defaultProvider
      },
      {
        type: 'input',
        name: 'model',
        message: 'Default model:',
        default: config.defaultModel
      },
      {
        type: 'number',
        name: 'temperature',
        message: 'Temperature (0-1):',
        default: config.temperature || 0.7,
        validate: (value) => value >= 0 && value <= 1 || 'Temperature must be between 0 and 1'
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Max tokens:',
        default: config.maxTokens || 2048,
        validate: (value) => value > 0 || 'Max tokens must be greater than 0'
      }
    ])
    
    this.configManager.updateConfig({
      defaultProvider: answers.provider,
      defaultModel: answers.model,
      temperature: answers.temperature,
      maxTokens: answers.maxTokens
    })
    
    console.log(chalk.green('✅ Settings updated'))
  }

  private showProjectSummary(projectInfo: any): void {
    console.log(chalk.cyan('\n📁 Project Summary:'))
    console.log(`Name: ${projectInfo.name}`)
    console.log(`Version: ${projectInfo.version}`)
    console.log(`Framework: Nuxt ${projectInfo.nuxtVersion}`)
    
    if (projectInfo.aiNuxtVersion) {
      console.log(`AI Nuxt: ${projectInfo.aiNuxtVersion}`)
    }
  }

  private showWelcomeMessage(): void {
    console.log(chalk.cyan('\n🎉 Ready to go!'))
    console.log(chalk.gray('You can now chat with AI, manage agents, configure providers, and more.'))
    console.log(chalk.gray('Use the menu below to get started.\n'))
  }

  stop(): void {
    this.isRunning = false
  }
}

export async function startInteractiveMode(options: InteractiveOptions = {}): Promise<void> {
  const interactive = new InteractiveMode(options)
  await interactive.start()
}