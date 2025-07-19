/**
 * Integration layer for automatic compliance tracking in AI operations
 */

import { complianceManager, DATA_CATEGORIES, LEGAL_BASES, type DataSubject, type PersonalDataRecord } from './compliance'
import type { AIProvider } from './providers/base'
import type { SecurityManager } from './security'

export interface ComplianceIntegrationConfig {
  /** Enable automatic compliance tracking */
  enabled: boolean
  /** Default retention period for AI data in days */
  defaultRetentionPeriod: number
  /** Automatically register prompts as personal data */
  trackPrompts: boolean
  /** Automatically register responses as personal data */
  trackResponses: boolean
  /** Automatically register embeddings as personal data */
  trackEmbeddings: boolean
  /** Automatically register conversation history */
  trackConversations: boolean
  /** Default legal basis for AI operations */
  defaultLegalBasis: typeof LEGAL_BASES[keyof typeof LEGAL_BASES]
  /** Default purposes for AI data processing */
  defaultPurposes: string[]
  /** PII detection threshold (0-1) */
  piiDetectionThreshold: number
  /** Automatically anonymize data after retention period */
  autoAnonymize: boolean
}

export interface AIOperationContext {
  /** User/session identifier */
  subject: DataSubject
  /** Operation type */
  operationType: 'chat' | 'completion' | 'embedding' | 'agent' | 'tool'
  /** Provider used */
  provider: string
  /** Model used */
  model: string
  /** Session ID */
  sessionId?: string
  /** Request ID */
  requestId?: string
  /** IP address */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Additional metadata */
  metadata?: Record<string, any>
}

export interface ComplianceTrackingResult {
  /** Personal data record IDs created */
  recordIds: string[]
  /** PII detected in input */
  piiDetected: boolean
  /** Consent required */
  consentRequired: boolean
  /** Compliance warnings */
  warnings: string[]
}

/**
 * Compliance Integration Manager
 */
export class ComplianceIntegration {
  private config: ComplianceIntegrationConfig
  private securityManager?: SecurityManager

  constructor(config: Partial<ComplianceIntegrationConfig> = {}) {
    this.config = {
      enabled: true,
      defaultRetentionPeriod: 365, // 1 year
      trackPrompts: true,
      trackResponses: true,
      trackEmbeddings: false, // Embeddings are typically not personal data
      trackConversations: true,
      defaultLegalBasis: LEGAL_BASES.LEGITIMATE_INTERESTS,
      defaultPurposes: ['AI assistance', 'service improvement'],
      piiDetectionThreshold: 0.7,
      autoAnonymize: true,
      ...config
    }
  }

  /**
   * Set security manager for PII detection
   */
  setSecurityManager(securityManager: SecurityManager): void {
    this.securityManager = securityManager
  }

  /**
   * Track AI prompt/input
   */
  async trackPrompt(
    prompt: string,
    context: AIOperationContext,
    options?: {
      retentionPeriod?: number
      legalBasis?: typeof LEGAL_BASES[keyof typeof LEGAL_BASES]
      purposes?: string[]
    }
  ): Promise<ComplianceTrackingResult> {
    if (!this.config.enabled || !this.config.trackPrompts) {
      return { recordIds: [], piiDetected: false, consentRequired: false, warnings: [] }
    }

    const result: ComplianceTrackingResult = {
      recordIds: [],
      piiDetected: false,
      consentRequired: false,
      warnings: []
    }

    // Detect PII in prompt
    if (this.securityManager) {
      const piiResult = await this.securityManager.scrubPII(prompt)
      result.piiDetected = piiResult.piiDetected
      
      if (piiResult.piiDetected && piiResult.confidence > this.config.piiDetectionThreshold) {
        result.warnings.push('PII detected in prompt - consider explicit consent')
        result.consentRequired = true
      }
    }

    // Determine data categories
    const categories = [DATA_CATEGORIES.COMMUNICATION_DATA]
    if (result.piiDetected) {
      categories.push(DATA_CATEGORIES.PERSONAL_IDENTIFIERS)
    }

    // Register personal data
    try {
      const recordId = await complianceManager.registerPersonalData({
        subject: context.subject,
        dataType: 'prompt',
        content: this.shouldStoreContent(prompt) ? prompt : '[CONTENT_NOT_STORED]',
        categories,
        legalBasis: options?.legalBasis || this.config.defaultLegalBasis,
        purpose: options?.purposes || this.config.defaultPurposes,
        retentionPeriod: options?.retentionPeriod || this.config.defaultRetentionPeriod,
        source: `ai-provider-${context.provider}`,
        location: this.getProcessingLocation(),
        metadata: {
          operationType: context.operationType,
          provider: context.provider,
          model: context.model,
          sessionId: context.sessionId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          piiDetected: result.piiDetected,
          ...context.metadata
        }
      })

      result.recordIds.push(recordId)
    } catch (error) {
      result.warnings.push(`Failed to register prompt data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Track AI response/output
   */
  async trackResponse(
    response: string,
    context: AIOperationContext,
    options?: {
      retentionPeriod?: number
      legalBasis?: typeof LEGAL_BASES[keyof typeof LEGAL_BASES]
      purposes?: string[]
      relatedPromptRecordId?: string
    }
  ): Promise<ComplianceTrackingResult> {
    if (!this.config.enabled || !this.config.trackResponses) {
      return { recordIds: [], piiDetected: false, consentRequired: false, warnings: [] }
    }

    const result: ComplianceTrackingResult = {
      recordIds: [],
      piiDetected: false,
      consentRequired: false,
      warnings: []
    }

    // Detect PII in response
    if (this.securityManager) {
      const piiResult = await this.securityManager.scrubPII(response)
      result.piiDetected = piiResult.piiDetected
      
      if (piiResult.piiDetected && piiResult.confidence > this.config.piiDetectionThreshold) {
        result.warnings.push('PII detected in AI response')
      }
    }

    // Determine data categories
    const categories = [DATA_CATEGORIES.COMMUNICATION_DATA]
    if (result.piiDetected) {
      categories.push(DATA_CATEGORIES.PERSONAL_IDENTIFIERS)
    }

    // Register personal data
    try {
      const recordId = await complianceManager.registerPersonalData({
        subject: context.subject,
        dataType: 'response',
        content: this.shouldStoreContent(response) ? response : '[CONTENT_NOT_STORED]',
        categories,
        legalBasis: options?.legalBasis || this.config.defaultLegalBasis,
        purpose: options?.purposes || this.config.defaultPurposes,
        retentionPeriod: options?.retentionPeriod || this.config.defaultRetentionPeriod,
        source: `ai-provider-${context.provider}`,
        location: this.getProcessingLocation(),
        metadata: {
          operationType: context.operationType,
          provider: context.provider,
          model: context.model,
          sessionId: context.sessionId,
          requestId: context.requestId,
          relatedPromptRecordId: options?.relatedPromptRecordId,
          piiDetected: result.piiDetected,
          ...context.metadata
        }
      })

      result.recordIds.push(recordId)
    } catch (error) {
      result.warnings.push(`Failed to register response data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Track conversation/chat session
   */
  async trackConversation(
    messages: Array<{ role: string; content: string }>,
    context: AIOperationContext,
    options?: {
      retentionPeriod?: number
      legalBasis?: typeof LEGAL_BASES[keyof typeof LEGAL_BASES]
      purposes?: string[]
    }
  ): Promise<ComplianceTrackingResult> {
    if (!this.config.enabled || !this.config.trackConversations) {
      return { recordIds: [], piiDetected: false, consentRequired: false, warnings: [] }
    }

    const result: ComplianceTrackingResult = {
      recordIds: [],
      piiDetected: false,
      consentRequired: false,
      warnings: []
    }

    // Analyze entire conversation for PII
    const conversationText = messages.map(m => m.content).join(' ')
    if (this.securityManager) {
      const piiResult = await this.securityManager.scrubPII(conversationText)
      result.piiDetected = piiResult.piiDetected
      
      if (piiResult.piiDetected && piiResult.confidence > this.config.piiDetectionThreshold) {
        result.warnings.push('PII detected in conversation')
        result.consentRequired = true
      }
    }

    // Determine data categories
    const categories = [DATA_CATEGORIES.COMMUNICATION_DATA, DATA_CATEGORIES.BEHAVIORAL_DATA]
    if (result.piiDetected) {
      categories.push(DATA_CATEGORIES.PERSONAL_IDENTIFIERS)
    }

    // Register conversation as personal data
    try {
      const recordId = await complianceManager.registerPersonalData({
        subject: context.subject,
        dataType: 'conversation',
        content: this.shouldStoreContent(conversationText) ? messages : '[CONTENT_NOT_STORED]',
        categories,
        legalBasis: options?.legalBasis || this.config.defaultLegalBasis,
        purpose: options?.purposes || this.config.defaultPurposes,
        retentionPeriod: options?.retentionPeriod || this.config.defaultRetentionPeriod,
        source: `ai-chat-${context.provider}`,
        location: this.getProcessingLocation(),
        metadata: {
          operationType: context.operationType,
          provider: context.provider,
          model: context.model,
          sessionId: context.sessionId,
          messageCount: messages.length,
          piiDetected: result.piiDetected,
          ...context.metadata
        }
      })

      result.recordIds.push(recordId)
    } catch (error) {
      result.warnings.push(`Failed to register conversation data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Track embeddings (if enabled)
   */
  async trackEmbedding(
    text: string,
    embedding: number[],
    context: AIOperationContext,
    options?: {
      retentionPeriod?: number
      legalBasis?: typeof LEGAL_BASES[keyof typeof LEGAL_BASES]
      purposes?: string[]
    }
  ): Promise<ComplianceTrackingResult> {
    if (!this.config.enabled || !this.config.trackEmbeddings) {
      return { recordIds: [], piiDetected: false, consentRequired: false, warnings: [] }
    }

    const result: ComplianceTrackingResult = {
      recordIds: [],
      piiDetected: false,
      consentRequired: false,
      warnings: []
    }

    // Detect PII in source text
    if (this.securityManager) {
      const piiResult = await this.securityManager.scrubPII(text)
      result.piiDetected = piiResult.piiDetected
      
      if (piiResult.piiDetected && piiResult.confidence > this.config.piiDetectionThreshold) {
        result.warnings.push('PII detected in embedding source text')
        result.consentRequired = true
      }
    }

    // Determine data categories
    const categories = [DATA_CATEGORIES.BEHAVIORAL_DATA]
    if (result.piiDetected) {
      categories.push(DATA_CATEGORIES.PERSONAL_IDENTIFIERS)
    }

    // Register embedding data
    try {
      const recordId = await complianceManager.registerPersonalData({
        subject: context.subject,
        dataType: 'embedding',
        content: {
          sourceText: this.shouldStoreContent(text) ? text : '[CONTENT_NOT_STORED]',
          embedding: '[EMBEDDING_VECTOR]', // Don't store actual embedding for privacy
          dimensions: embedding.length
        },
        categories,
        legalBasis: options?.legalBasis || this.config.defaultLegalBasis,
        purpose: options?.purposes || [...this.config.defaultPurposes, 'semantic search'],
        retentionPeriod: options?.retentionPeriod || this.config.defaultRetentionPeriod,
        source: `ai-embedding-${context.provider}`,
        location: this.getProcessingLocation(),
        metadata: {
          operationType: context.operationType,
          provider: context.provider,
          model: context.model,
          embeddingDimensions: embedding.length,
          piiDetected: result.piiDetected,
          ...context.metadata
        }
      })

      result.recordIds.push(recordId)
    } catch (error) {
      result.warnings.push(`Failed to register embedding data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Handle data subject request (GDPR/CCPA)
   */
  async handleDataSubjectRequest(
    requestType: 'access' | 'delete' | 'portability' | 'rectification',
    subject: DataSubject,
    details?: string
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Compliance features are disabled')
    }

    const requestId = await complianceManager.handlePrivacyRequest({
      type: requestType === 'delete' ? 'erasure' : requestType,
      subject,
      details: details || `${requestType} request via AI system`,
      verified: false // Requires manual verification
    })

    return requestId
  }

  /**
   * Get compliance summary for a data subject
   */
  async getComplianceSummary(subject: DataSubject): Promise<{
    personalDataRecords: number
    dataTypes: string[]
    oldestRecord: Date | null
    newestRecord: Date | null
    totalRetentionPeriod: number
    consentStatus: 'unknown' | 'given' | 'withdrawn' | 'expired'
    privacyRequests: number
  }> {
    const records = await complianceManager.getPersonalData(subject)
    const dataTypes = [...new Set(records.map(r => r.dataType))]
    
    const timestamps = records.map(r => r.collectedAt)
    const oldestRecord = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null
    const newestRecord = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
    
    const totalRetentionPeriod = Math.max(...records.map(r => r.retentionPeriod), 0)

    // Check consent status (simplified)
    const consent = await complianceManager.checkConsent(subject, this.config.defaultPurposes)
    const consentStatus = consent ? 
      (consent.status === 'given' ? 'given' : consent.status) : 'unknown'

    // Count privacy requests
    const auditLogs = await complianceManager.getAuditLogs({
      type: 'privacy_request',
      subject
    })

    return {
      personalDataRecords: records.length,
      dataTypes,
      oldestRecord,
      newestRecord,
      totalRetentionPeriod,
      consentStatus,
      privacyRequests: auditLogs.length
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComplianceIntegrationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): ComplianceIntegrationConfig {
    return { ...this.config }
  }

  private shouldStoreContent(content: string): boolean {
    // Don't store content if it's too long or contains sensitive patterns
    if (content.length > 10000) return false
    
    // Simple heuristics for sensitive content
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/ // Phone
    ]
    
    return !sensitivePatterns.some(pattern => pattern.test(content))
  }

  private getProcessingLocation(): string {
    // In a real implementation, this would detect the actual processing location
    return 'EU' // Default to EU for GDPR compliance
  }
}

// Export default instance
export const complianceIntegration = new ComplianceIntegration()

/**
 * Decorator for automatic compliance tracking in AI operations
 */
export function withComplianceTracking(
  operationType: AIOperationContext['operationType']
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // Extract context from arguments (this would need to be customized per method)
      const context = extractContextFromArgs(args, operationType)
      
      if (context) {
        // Track input if it's a prompt/text
        if (args[0] && typeof args[0] === 'string') {
          await complianceIntegration.trackPrompt(args[0], context)
        }
      }

      // Call original method
      const result = await method.apply(this, args)

      if (context && result && typeof result === 'string') {
        // Track output if it's a response
        await complianceIntegration.trackResponse(result, context)
      }

      return result
    }

    return descriptor
  }
}

function extractContextFromArgs(args: any[], operationType: string): AIOperationContext | null {
  // This is a simplified implementation - in practice, you'd need to
  // extract context based on the specific method signature
  return {
    subject: { id: 'unknown' }, // Would need to be passed in or extracted
    operationType: operationType as any,
    provider: 'unknown',
    model: 'unknown'
  }
}