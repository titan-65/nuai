#!/usr/bin/env node

/**
 * AI Nuxt CLI
 * Command-line interface for AI Nuxt framework
 */

export * from './commands'
export * from './utils'
export * from './types'
export * from './config'
export * from './templates'
export * from './agents'
export * from './prompt-templates'

// Main CLI entry point
import { runCLI } from './commands'

// If this file is run directly, execute the CLI
if (require.main === module) {
  runCLI().catch((error) => {
    console.error('CLI Error:', error.message || error)
    process.exit(1)
  })
}