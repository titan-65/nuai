/**
 * Type definitions for AI Nuxt CLI
 */

/**
 * CLI configuration
 */
export interface CLIConfig {
  lastUsedTemplate?: string
  lastUsedPackageManager?: 'npm' | 'yarn' | 'pnpm'
  lastUsedProvider?: 'openai' | 'anthropic' | 'ollama' | 'multiple'
  defaultProvider: 'openai' | 'anthropic' | 'ollama'
  apiKeys?: {
    openai?: string
    anthropic?: string
    ollama?: string
  }
  preferences?: {
    autoUpdate: boolean
    telemetry: boolean
    verbose: boolean
  }
}

/**
 * Project template types
 */
export type ProjectTemplate = 'basic' | 'chat' | 'agent' | 'rag' | 'full'

/**
 * Component template types
 */
export type ComponentTemplate = 'chat' | 'completion' | 'embedding' | 'agent' | 'rag'

/**
 * Agent template types
 */
export type AgentTemplate = 'assistant' | 'researcher' | 'coder' | 'custom'

/**
 * Prompt template types
 */
export type PromptTemplate = 'chat' | 'completion' | 'system'

/**
 * Package manager types
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm'

/**
 * AI provider types
 */
export type AIProvider = 'openai' | 'anthropic' | 'ollama'

/**
 * Template metadata
 */
export interface TemplateMetadata {
  name: string
  description: string
  features: string[]
  dependencies: string[]
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  name: string
  type: AgentTemplate
  description: string
  capabilities: string[]
  filePath?: string
}

/**
 * Prompt definition
 */
export interface PromptDefinition {
  name: string
  type: PromptTemplate
  description: string
  content: string
  filePath?: string
}

/**
 * Command options
 */
export interface InitCommandOptions {
  template?: ProjectTemplate
  packageManager?: PackageManager
  skipInstall?: boolean
  skipGit?: boolean
}

export interface GenerateCommandOptions {
  type?: ComponentTemplate | AgentTemplate | PromptTemplate
}

export interface DevCommandOptions {
  open?: boolean
  port?: string
  host?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  error?: string
  data?: any
}

/**
 * File operation result
 */
export interface FileOperationResult {
  success: boolean
  error?: string
  path?: string
}

/**
 * CLI command context
 */
export interface CommandContext {
  cwd: string
  config: CLIConfig
  verbose: boolean
}

/**
 * System check result
 */
export interface SystemCheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  details?: string
}

/**
 * Project structure
 */
export interface ProjectStructure {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: ProjectStructure[]
}

/**
 * Template file
 */
export interface TemplateFile {
  path: string
  content: string
  encoding?: 'utf8' | 'binary'
}

/**
 * CLI error types
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'CLIError'
  }
}

export class ValidationError extends CLIError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class FileSystemError extends CLIError {
  constructor(message: string, public path?: string) {
    super(message, 'FILESYSTEM_ERROR')
    this.name = 'FileSystemError'
  }
}

export class NetworkError extends CLIError {
  constructor(message: string, public url?: string) {
    super(message, 'NETWORK_ERROR')
    this.name = 'NetworkError'
  }
}

/**
 * Event types
 */
export interface CLIEvent {
  type: string
  timestamp: Date
  data?: any
}

export interface ProjectCreatedEvent extends CLIEvent {
  type: 'project:created'
  data: {
    name: string
    template: ProjectTemplate
    path: string
  }
}

export interface ComponentGeneratedEvent extends CLIEvent {
  type: 'component:generated'
  data: {
    name: string
    type: ComponentTemplate
    path: string
  }
}

export interface AgentCreatedEvent extends CLIEvent {
  type: 'agent:created'
  data: {
    name: string
    type: AgentTemplate
    path: string
  }
}

export interface PromptCreatedEvent extends CLIEvent {
  type: 'prompt:created'
  data: {
    name: string
    type: PromptTemplate
    path: string
  }
}

/**
 * Plugin interface
 */
export interface CLIPlugin {
  name: string
  version: string
  commands?: Array<{
    name: string
    description: string
    handler: (args: any, context: CommandContext) => Promise<void>
  }>
  hooks?: {
    beforeInit?: (context: CommandContext) => Promise<void>
    afterInit?: (context: CommandContext) => Promise<void>
    beforeGenerate?: (context: CommandContext) => Promise<void>
    afterGenerate?: (context: CommandContext) => Promise<void>
  }
}

/**
 * Analytics data
 */
export interface AnalyticsData {
  command: string
  template?: string
  provider?: string
  success: boolean
  duration: number
  error?: string
  timestamp: Date
}