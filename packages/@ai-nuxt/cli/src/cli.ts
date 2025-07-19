#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import figlet from 'figlet'
import gradient from 'gradient-string'
import boxen from 'boxen'
import updateNotifier from 'update-notifier'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import commands
import { initCommand } from './commands/init.js'
import { chatCommand } from './commands/chat.js'
import { agentCommand } from './commands/agent.js'
import { providerCommand } from './commands/provider.js'
import { testCommand } from './commands/test.js'
import { deployCommand } from './commands/deploy.js'
import { configCommand } from './commands/config.js'
import { doctorCommand } from './commands/doctor.js'

// Get package info
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packagePath = join(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))

// Check for updates
const notifier = updateNotifier({
  pkg: packageJson,
  updateCheckInterval: 1000 * 60 * 60 * 24 // 24 hours
})

if (notifier.update) {
  console.log(boxen(
    `Update available ${chalk.dim(notifier.update.current)} → ${chalk.green(notifier.update.latest)}\n` +
    `Run ${chalk.cyan('npm i -g @ai-nuxt/cli')} to update`,
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    }
  ))
}

// Create CLI program
const program = new Command()

program
  .name('ai-nuxt')
  .description('AI Nuxt CLI - Command-line AI workflow tool for Nuxt.js developers')
  .version(packageJson.version)
  .option('-v, --verbose', 'enable verbose logging')
  .option('--no-color', 'disable colored output')
  .hook('preAction', (thisCommand) => {
    // Set global options
    const opts = thisCommand.opts()
    if (opts.noColor) {
      process.env.NO_COLOR = '1'
    }
    if (opts.verbose) {
      process.env.AI_NUXT_VERBOSE = '1'
    }
  })

// Welcome message for interactive mode
function showWelcome() {
  const title = figlet.textSync('AI Nuxt', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted'
  })
  
  console.log(gradient.rainbow(title))
  console.log()
  console.log(chalk.cyan('🚀 Welcome to AI Nuxt CLI'))
  console.log(chalk.gray('The command-line AI workflow tool for Nuxt.js developers'))
  console.log()
}

// Interactive mode (default when no command is provided)
program
  .action(async () => {
    showWelcome()
    
    // Start interactive chat mode
    const { startInteractiveMode } = await import('./interactive/index.js')
    await startInteractiveMode()
  })

// Add commands
program.addCommand(initCommand)
program.addCommand(chatCommand)
program.addCommand(agentCommand)
program.addCommand(providerCommand)
program.addCommand(testCommand)
program.addCommand(deployCommand)
program.addCommand(configCommand)
program.addCommand(doctorCommand)

// Global error handler
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error.message)
  if (process.env.AI_NUXT_VERBOSE) {
    console.error(error.stack)
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason)
  if (process.env.AI_NUXT_VERBOSE) {
    console.error(reason)
  }
  process.exit(1)
})

// Parse command line arguments
program.parse()

// If no arguments provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp()
}