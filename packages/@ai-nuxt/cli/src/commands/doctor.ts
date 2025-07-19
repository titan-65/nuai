import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'path'
import { showSuccess, showError } from '../utils/banner'

/**
 * Check system for issues
 */
export function doctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Check system for issues')
    .action(async () => {
      console.log('\n🩺 Running system checks...\n')

      const issues: string[] = []

      // Check Node.js version
      await checkNodeVersion(issues)

      // Check for required dependencies
      await checkDependencies(issues)

      // Check for AI Nuxt module
      await checkAINuxtModule(issues)

      // Check environment variables
      await checkEnvironmentVariables(issues)

      // Check project structure
      await checkProjectStructure(issues)

      // Show results
      if (issues.length === 0) {
        showSuccess('All checks passed! Your system is ready for AI Nuxt development.')
      } else {
        console.log(`\n${chalk.red('Issues found:')}\n`)
        issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue}`)
        })
        console.log(`\nPlease fix these issues and run ${chalk.cyan('ai-nuxt doctor')} again.\n`)
      }
    })
}

/**
 * Check Node.js version
 */
async function checkNodeVersion(issues: string[]) {
  const spinner = ora('Checking Node.js version...').start()

  try {
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

    if (majorVersion < 16) {
      issues.push(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 16 or higher.`)
      spinner.fail(`Node.js version ${nodeVersion} (unsupported)`)
    } else {
      spinner.succeed(`Node.js version ${nodeVersion}`)
    }
  } catch (error) {
    issues.push('Failed to check Node.js version')
    spinner.fail('Failed to check Node.js version')
  }
}

/**
 * Check for required dependencies
 */
async function checkDependencies(issues: string[]) {
  const spinner = ora('Checking dependencies...').start()

  const requiredDeps = ['nuxt', '@ai-nuxt/module']
  const optionalDeps = ['@ai-nuxt/core', '@ai-nuxt/devtools']

  try {
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      issues.push('package.json not found. Please run this command in a Node.js project.')
      spinner.fail('package.json not found')
      return
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies }

    // Check required dependencies
    for (const dep of requiredDeps) {
      if (!allDeps[dep]) {
        issues.push(`Required dependency ${dep} is missing. Install it with: npm install ${dep}`)
      }
    }

    // Check optional dependencies
    const installedOptional = optionalDeps.filter(dep => allDeps[dep])

    spinner.succeed(`Dependencies checked (${Object.keys(allDeps).length} installed)`)
  } catch (error) {
    issues.push('Failed to check dependencies')
    spinner.fail('Failed to check dependencies')
  }
}

/**
 * Check for AI Nuxt module
 */
async function checkAINuxtModule(issues: string[]) {
  const spinner = ora('Checking AI Nuxt module...').start()

  try {
    // Check if nuxt.config.ts exists
    const configFiles = ['nuxt.config.ts', 'nuxt.config.js']
    let configFile = null

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        configFile = file
        break
      }
    }

    if (!configFile) {
      issues.push('Nuxt config file not found. This might not be a Nuxt project.')
      spinner.fail('Nuxt config not found')
      return
    }

    // Check if AI Nuxt module is configured
    const configContent = fs.readFileSync(configFile, 'utf-8')
    if (!configContent.includes('@ai-nuxt/module')) {
      issues.push('AI Nuxt module is not configured in nuxt.config. Add it to the modules array.')
      spinner.warn('AI Nuxt module not configured')
    } else {
      spinner.succeed('AI Nuxt module configured')
    }
  } catch (error) {
    issues.push('Failed to check AI Nuxt module configuration')
    spinner.fail('Failed to check AI Nuxt module')
  }
}

/**
 * Check environment variables
 */
async function checkEnvironmentVariables(issues: string[]) {
  const spinner = ora('Checking environment variables...').start()

  try {
    const envFile = '.env'
    const envExampleFile = '.env.example'

    // Check if .env file exists
    if (!fs.existsSync(envFile)) {
      if (fs.existsSync(envExampleFile)) {
        issues.push('Environment file .env not found. Copy .env.example to .env and configure your API keys.')
      } else {
        issues.push('Environment file .env not found. Create one with your AI provider API keys.')
      }
      spinner.warn('Environment file not found')
      return
    }

    // Check for common API keys
    const envContent = fs.readFileSync(envFile, 'utf-8')
    const hasOpenAI = envContent.includes('OPENAI_API_KEY=') && !envContent.includes('OPENAI_API_KEY=\n')
    const hasAnthropic = envContent.includes('ANTHROPIC_API_KEY=') && !envContent.includes('ANTHROPIC_API_KEY=\n')
    const hasOllama = envContent.includes('OLLAMA_HOST=')

    if (!hasOpenAI && !hasAnthropic && !hasOllama) {
      issues.push('No AI provider API keys found in .env file. Configure at least one provider.')
      spinner.warn('No API keys configured')
    } else {
      const providers = []
      if (hasOpenAI) providers.push('OpenAI')
      if (hasAnthropic) providers.push('Anthropic')
      if (hasOllama) providers.push('Ollama')
      spinner.succeed(`Environment configured (${providers.join(', ')})`)
    }
  } catch (error) {
    issues.push('Failed to check environment variables')
    spinner.fail('Failed to check environment')
  }
}

/**
 * Check project structure
 */
async function checkProjectStructure(issues: string[]) {
  const spinner = ora('Checking project structure...').start()

  try {
    const expectedDirs = ['components', 'pages', 'server']
    const optionalDirs = ['agents', 'prompts', 'middleware']

    const existingDirs = expectedDirs.filter(dir => fs.existsSync(dir))
    const existingOptional = optionalDirs.filter(dir => fs.existsSync(dir))

    if (existingDirs.length === 0) {
      issues.push('This does not appear to be a Nuxt project. Expected directories not found.')
      spinner.fail('Invalid project structure')
    } else {
      spinner.succeed(`Project structure valid (${existingDirs.length + existingOptional.length} directories)`)
    }
  } catch (error) {
    issues.push('Failed to check project structure')
    spinner.fail('Failed to check project structure')
  }
}