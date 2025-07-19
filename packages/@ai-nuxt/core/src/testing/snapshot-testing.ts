import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { createHash } from 'crypto'

/**
 * Snapshot testing utilities for AI responses and conversations
 */

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  /** Directory to store snapshots */
  snapshotDir?: string
  /** Whether to update snapshots */
  updateSnapshots?: boolean
  /** Custom serializer for data */
  serializer?: (data: any) => string
  /** Custom matcher for comparing snapshots */
  matcher?: (received: string, expected: string) => boolean
}

/**
 * AI conversation snapshot
 */
export interface ConversationSnapshot {
  /** Conversation ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Messages in the conversation */
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    metadata?: any
  }>
  /** Provider and model information */
  provider: {
    name: string
    model: string
    version?: string
  }
  /** Performance metrics */
  metrics?: {
    totalTokens: number
    totalCost: number
    averageResponseTime: number
  }
  /** Test metadata */
  testMetadata?: {
    testName: string
    testFile: string
    environment: string
  }
}

/**
 * AI response snapshot
 */
export interface ResponseSnapshot {
  /** Snapshot ID */
  id: string
  /** Input that generated the response */
  input: any
  /** AI response */
  response: {
    text: string
    model: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    finishReason?: string
  }
  /** Provider information */
  provider: string
  /** Timestamp */
  timestamp: number
  /** Test context */
  context?: {
    testName: string
    testFile: string
    description?: string
  }
}

/**
 * Snapshot manager for AI testing
 */
export class AISnapshotManager {
  private config: Required<SnapshotConfig>
  private snapshots: Map<string, any> = new Map()

  constructor(config: SnapshotConfig = {}) {
    this.config = {
      snapshotDir: config.snapshotDir || '__snapshots__',
      updateSnapshots: config.updateSnapshots || process.env.UPDATE_SNAPSHOTS === 'true',
      serializer: config.serializer || this.defaultSerializer,
      matcher: config.matcher || this.defaultMatcher
    }
  }

  /**
   * Create a snapshot of an AI conversation
   */
  snapshotConversation(
    testName: string,
    conversation: Omit<ConversationSnapshot, 'id' | 'timestamp' | 'testMetadata'>
  ): void {
    const snapshot: ConversationSnapshot = {
      id: this.generateId(testName),
      timestamp: Date.now(),
      testMetadata: {
        testName,
        testFile: this.getTestFile(),
        environment: process.env.NODE_ENV || 'test'
      },
      ...conversation
    }

    this.saveSnapshot(`conversation-${testName}`, snapshot)
  }

  /**
   * Create a snapshot of an AI response
   */
  snapshotResponse(
    testName: string,
    response: Omit<ResponseSnapshot, 'id' | 'timestamp' | 'context'>
  ): void {
    const snapshot: ResponseSnapshot = {
      id: this.generateId(testName),
      timestamp: Date.now(),
      context: {
        testName,
        testFile: this.getTestFile()
      },
      ...response
    }

    this.saveSnapshot(`response-${testName}`, snapshot)
  }

  /**
   * Compare current data with existing snapshot
   */
  matchSnapshot(testName: string, data: any): {
    matches: boolean
    diff?: string
    snapshot?: any
  } {
    const snapshotKey = this.normalizeTestName(testName)
    const serializedData = this.config.serializer(data)
    
    const snapshotPath = this.getSnapshotPath(snapshotKey)
    
    if (!existsSync(snapshotPath)) {
      if (this.config.updateSnapshots) {
        this.saveSnapshot(snapshotKey, data)
        return { matches: true, snapshot: data }
      } else {
        return {
          matches: false,
          diff: 'Snapshot does not exist. Run with UPDATE_SNAPSHOTS=true to create it.'
        }
      }
    }

    const existingSnapshot = this.loadSnapshot(snapshotKey)
    const existingSerialized = this.config.serializer(existingSnapshot)

    if (this.config.updateSnapshots) {
      this.saveSnapshot(snapshotKey, data)
      return { matches: true, snapshot: data }
    }

    const matches = this.config.matcher(serializedData, existingSerialized)
    
    return {
      matches,
      diff: matches ? undefined : this.generateDiff(existingSerialized, serializedData),
      snapshot: existingSnapshot
    }
  }

  /**
   * Snapshot AI model responses for regression testing
   */
  snapshotModelResponse(
    modelName: string,
    prompt: string,
    response: string,
    metadata?: any
  ): void {
    const testName = `model-${modelName}-${this.hashString(prompt)}`
    
    this.snapshotResponse(testName, {
      input: { prompt, model: modelName },
      response: {
        text: response,
        model: modelName,
        ...metadata
      },
      provider: modelName.split('-')[0] || 'unknown'
    })
  }

  /**
   * Snapshot conversation flow for integration testing
   */
  snapshotConversationFlow(
    flowName: string,
    messages: Array<{ role: string; content: string }>,
    provider: { name: string; model: string },
    metrics?: any
  ): void {
    this.snapshotConversation(flowName, {
      messages,
      provider,
      metrics
    })
  }

  /**
   * Load all snapshots for a test file
   */
  loadTestSnapshots(testFile?: string): Record<string, any> {
    const file = testFile || this.getTestFile()
    const snapshots: Record<string, any> = {}
    
    // This would need to be implemented based on file system structure
    // For now, return empty object
    return snapshots
  }

  /**
   * Clean up old snapshots
   */
  cleanupSnapshots(olderThanDays: number = 30): void {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
    
    // Implementation would scan snapshot directory and remove old files
    // This is a placeholder for the actual implementation
  }

  /**
   * Export snapshots for sharing or backup
   */
  exportSnapshots(format: 'json' | 'yaml' = 'json'): string {
    const allSnapshots = Array.from(this.snapshots.entries()).reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as Record<string, any>)

    if (format === 'json') {
      return JSON.stringify(allSnapshots, null, 2)
    }
    
    // YAML export would require a YAML library
    throw new Error('YAML export not implemented')
  }

  /**
   * Import snapshots from exported data
   */
  importSnapshots(data: string, format: 'json' | 'yaml' = 'json'): void {
    let snapshots: Record<string, any>
    
    if (format === 'json') {
      snapshots = JSON.parse(data)
    } else {
      throw new Error('YAML import not implemented')
    }

    Object.entries(snapshots).forEach(([key, value]) => {
      this.snapshots.set(key, value)
      this.saveSnapshot(key, value)
    })
  }

  private saveSnapshot(key: string, data: any): void {
    const snapshotPath = this.getSnapshotPath(key)
    const dir = dirname(snapshotPath)
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const serialized = this.config.serializer(data)
    writeFileSync(snapshotPath, serialized, 'utf8')
    this.snapshots.set(key, data)
  }

  private loadSnapshot(key: string): any {
    const snapshotPath = this.getSnapshotPath(key)
    
    if (!existsSync(snapshotPath)) {
      return null
    }

    const content = readFileSync(snapshotPath, 'utf8')
    return JSON.parse(content)
  }

  private getSnapshotPath(key: string): string {
    return join(process.cwd(), this.config.snapshotDir, `${key}.json`)
  }

  private normalizeTestName(testName: string): string {
    return testName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private generateId(testName: string): string {
    return `${this.normalizeTestName(testName)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getTestFile(): string {
    // In a real implementation, this would extract the test file from the call stack
    return 'unknown-test-file'
  }

  private hashString(str: string): string {
    return createHash('md5').update(str).digest('hex').substr(0, 8)
  }

  private defaultSerializer(data: any): string {
    return JSON.stringify(data, null, 2)
  }

  private defaultMatcher(received: string, expected: string): boolean {
    return received === expected
  }

  private generateDiff(expected: string, received: string): string {
    // Simple diff implementation
    const expectedLines = expected.split('\n')
    const receivedLines = received.split('\n')
    
    const diff: string[] = []
    const maxLines = Math.max(expectedLines.length, receivedLines.length)
    
    for (let i = 0; i < maxLines; i++) {
      const expectedLine = expectedLines[i] || ''
      const receivedLine = receivedLines[i] || ''
      
      if (expectedLine !== receivedLine) {
        diff.push(`Line ${i + 1}:`)
        diff.push(`- ${expectedLine}`)
        diff.push(`+ ${receivedLine}`)
      }
    }
    
    return diff.join('\n')
  }
}

/**
 * Global snapshot manager instance
 */
export const snapshotManager = new AISnapshotManager()

/**
 * Snapshot testing utilities
 */
export const snapshot = {
  /**
   * Create a conversation snapshot
   */
  conversation: (testName: string, data: any) => {
    snapshotManager.snapshotConversation(testName, data)
  },

  /**
   * Create a response snapshot
   */
  response: (testName: string, data: any) => {
    snapshotManager.snapshotResponse(testName, data)
  },

  /**
   * Match against existing snapshot
   */
  match: (testName: string, data: any) => {
    return snapshotManager.matchSnapshot(testName, data)
  },

  /**
   * Snapshot model response
   */
  modelResponse: (model: string, prompt: string, response: string, metadata?: any) => {
    snapshotManager.snapshotModelResponse(model, prompt, response, metadata)
  },

  /**
   * Snapshot conversation flow
   */
  conversationFlow: (flowName: string, messages: any[], provider: any, metrics?: any) => {
    snapshotManager.snapshotConversationFlow(flowName, messages, provider, metrics)
  }
}

/**
 * Expect-style snapshot matchers
 */
export const expectSnapshot = {
  /**
   * Expect data to match snapshot
   */
  toMatchSnapshot: (testName: string, data: any) => {
    const result = snapshotManager.matchSnapshot(testName, data)
    
    if (!result.matches) {
      throw new Error(`Snapshot mismatch for "${testName}":\n${result.diff}`)
    }
    
    return true
  },

  /**
   * Expect conversation to match snapshot
   */
  toMatchConversationSnapshot: (testName: string, conversation: any) => {
    snapshotManager.snapshotConversation(testName, conversation)
    return expectSnapshot.toMatchSnapshot(`conversation-${testName}`, conversation)
  },

  /**
   * Expect response to match snapshot
   */
  toMatchResponseSnapshot: (testName: string, response: any) => {
    snapshotManager.snapshotResponse(testName, response)
    return expectSnapshot.toMatchSnapshot(`response-${testName}`, response)
  }
}

/**
 * Fuzzy snapshot matching for AI responses
 */
export class FuzzySnapshotMatcher {
  private similarityThreshold: number

  constructor(similarityThreshold: number = 0.8) {
    this.similarityThreshold = similarityThreshold
  }

  /**
   * Calculate similarity between two strings
   */
  calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Check if two AI responses are similar enough
   */
  matchesFuzzy(received: string, expected: string): boolean {
    const similarity = this.calculateSimilarity(received, expected)
    return similarity >= this.similarityThreshold
  }

  /**
   * Create a fuzzy snapshot matcher
   */
  createMatcher(threshold?: number): (received: string, expected: string) => boolean {
    const actualThreshold = threshold ?? this.similarityThreshold
    return (received: string, expected: string) => {
      const similarity = this.calculateSimilarity(received, expected)
      return similarity >= actualThreshold
    }
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }
}

/**
 * Create a fuzzy snapshot manager for AI responses
 */
export function createFuzzySnapshotManager(similarityThreshold: number = 0.8): AISnapshotManager {
  const fuzzyMatcher = new FuzzySnapshotMatcher(similarityThreshold)
  
  return new AISnapshotManager({
    matcher: fuzzyMatcher.createMatcher()
  })
}

/**
 * Snapshot testing for specific AI scenarios
 */
export const aiSnapshots = {
  /**
   * Snapshot a chat conversation
   */
  chatConversation: (testName: string, messages: any[], provider: string, model: string) => {
    snapshot.conversation(testName, {
      messages,
      provider: { name: provider, model }
    })
  },

  /**
   * Snapshot a completion response
   */
  completion: (testName: string, prompt: string, completion: string, model: string) => {
    snapshot.response(testName, {
      input: { prompt },
      response: { text: completion, model },
      provider: model.split('-')[0]
    })
  },

  /**
   * Snapshot an embedding result
   */
  embedding: (testName: string, text: string, embedding: number[], model: string) => {
    snapshot.response(testName, {
      input: { text },
      response: { embedding, model },
      provider: model.split('-')[0]
    })
  },

  /**
   * Snapshot agent execution
   */
  agentExecution: (testName: string, input: string, output: any, agentId: string) => {
    snapshot.response(testName, {
      input: { task: input, agentId },
      response: { result: output },
      provider: 'agent'
    })
  },

  /**
   * Snapshot tool execution
   */
  toolExecution: (testName: string, toolId: string, input: any, output: any) => {
    snapshot.response(testName, {
      input: { toolId, parameters: input },
      response: { result: output },
      provider: 'tool'
    })
  }
}