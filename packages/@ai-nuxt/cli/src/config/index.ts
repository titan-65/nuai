import Conf from 'conf'
import { z } from 'zod'

/**
 * Configuration schema
 */
const ConfigSchema = z.object({
  lastUsedTemplate: z.string().optional(),
  lastUsedPackageManager: z.enum(['npm', 'yarn', 'pnpm']).optional(),
  lastUsedProvider: z.enum(['openai', 'anthropic', 'ollama', 'multiple']).optional(),
  defaultProvider: z.enum(['openai', 'anthropic', 'ollama']).default('openai'),
  apiKeys: z.object({
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    ollama: z.string().optional()
  }).optional(),
  preferences: z.object({
    autoUpdate: z.boolean().default(true),
    telemetry: z.boolean().default(true),
    verbose: z.boolean().default(false)
  }).optional()
})

export type Config = z.infer<typeof ConfigSchema>

/**
 * Configuration store
 */
const config = new Conf<Config>({
  projectName: 'ai-nuxt-cli',
  schema: {
    lastUsedTemplate: {
      type: 'string'
    },
    lastUsedPackageManager: {
      type: 'string',
      enum: ['npm', 'yarn', 'pnpm']
    },
    lastUsedProvider: {
      type: 'string',
      enum: ['openai', 'anthropic', 'ollama', 'multiple']
    },
    defaultProvider: {
      type: 'string',
      enum: ['openai', 'anthropic', 'ollama'],
      default: 'openai'
    },
    apiKeys: {
      type: 'object',
      properties: {
        openai: { type: 'string' },
        anthropic: { type: 'string' },
        ollama: { type: 'string' }
      }
    },
    preferences: {
      type: 'object',
      properties: {
        autoUpdate: { type: 'boolean', default: true },
        telemetry: { type: 'boolean', default: true },
        verbose: { type: 'boolean', default: false }
      }
    }
  }
})

/**
 * Get configuration
 */
export function getConfig(): Config {
  return config.store
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<Config>): void {
  const current = getConfig()
  const updated = { ...current, ...updates }
  
  // Validate configuration
  const validated = ConfigSchema.parse(updated)
  
  // Update store
  config.store = validated
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  config.clear()
}

/**
 * Get configuration file path
 */
export function getConfigPath(): string {
  return config.path
}

/**
 * Check if configuration exists
 */
export function hasConfig(): boolean {
  return config.size > 0
}