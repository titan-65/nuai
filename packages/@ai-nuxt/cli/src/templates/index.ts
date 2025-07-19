/**
 * Template system for AI Nuxt CLI
 */

export * from './project-templates'
export * from './component-templates'
export * from './agent-templates'
export * from './prompt-templates'

/**
 * Template types
 */
export type ProjectTemplate = 'basic' | 'chat' | 'agent' | 'rag' | 'full'
export type ComponentTemplate = 'chat' | 'completion' | 'embedding' | 'agent' | 'rag'
export type AgentTemplate = 'assistant' | 'researcher' | 'coder' | 'custom'
export type PromptTemplate = 'chat' | 'completion' | 'system'

/**
 * Template metadata
 */
export interface TemplateMetadata {
  name: string
  description: string
  features: string[]
  dependencies: string[]
}