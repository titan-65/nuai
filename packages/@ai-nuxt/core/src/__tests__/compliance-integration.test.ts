/**
 * Tests for compliance integration with AI operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ComplianceIntegration, type AIOperationContext } from '../compliance-integration'
import { DefaultComplianceManager } from '../compliance'
import { DefaultSecurityManager } from '../security'

// Mock the compliance manager
vi.mock('../compliance', () => ({
  complianceManager: {
    registerPersonalData: vi.fn().mockResolvedValue('record-123'),
    getPersonalData: vi.fn().mockResolvedValue([]),
    handlePrivacyRequest: vi.fn().mockResolvedValue('request-456'),
    checkConsent: vi.fn().mockResolvedValue(null),
    getAuditLogs: vi.fn().mockResolvedValue([])
  },
  DefaultComplianceManager: vi.fn(),
  DATA_CATEGORIES: {
    COMMUNICATION_DATA: { id: 'communication', name: 'Communication Data', sensitivity: 'high', specialCategory: false },
    PERSONAL_IDENTIFIERS: { id: 'personal_id', name: 'Personal Identifiers', sensitivity: 'medium', specialCategory: false },
    BEHAVIORAL_DATA: { id: 'behavioral', name: 'Behavioral Data', sensitivity: 'medium', specialCategory: false }
  },
  LEGAL_BASES: {
    CONSENT: { type: 'consent', description: 'Consent given' },
    LEGITIMATE_INTERESTS: { type: 'legitimate_interests', description: 'Legitimate interests' }
  }
}))

describe('Compliance Integration', () => {
  let complianceIntegration: ComplianceIntegration
  let mockSecurityManager: DefaultSecurityManager
  let mockContext: AIOperationContext

  beforeEach(() => {
    vi.clearAllMocks()
    
    complianceIntegration = new ComplianceIntegration({
      enabled: true,
      trackPrompts: true,
      trackResponses: true,
      trackConversations: true,
      trackEmbeddings: true,
      piiDetectionThreshold: 0.7
    })

    mockSecurityManager = {
      scrubPII: vi.fn().mockResolvedValue({
        piiDetected: false,
        confidence: 0.5,
        scrubbedText: 'test text',
        detectedPII: []
      })
    } as any

    complianceIntegration.setSecurityManager(mockSecurityManager)

    mockContext = {
      subject: {
        id: 'user-123',
        email: 'test@example.com',
        userId: 'app-user-456'
      },
      operationType: 'chat',
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      sessionId: 'session-789',
      requestId: 'req-abc123'
    }
  })

  describe('Prompt Tracking', () => {
    it('should track prompts with personal data registration', async () => {
      const prompt = 'Hello, can you help me with my project?'
      
      const result = await complianceIntegration.trackPrompt(prompt, mockContext)

      expect(result.recordIds).toHaveLength(1)
      expect(result.recordIds[0]).toBe('record-123')
      expect(result.piiDetected).toBe(false)
      expect(result.consentRequired).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('should detect PII in prompts', async () => {
      const prompt = 'My email is john@example.com and my phone is 555-1234'
      
      // Mock PII detection
      mockSecurityManager.scrubPII = vi.fn().mockResolvedValue({
        piiDetected: true,
        confidence: 0.9,
        scrubbedText: 'My email is [EMAIL] and my phone is [PHONE]',
        detectedPII: ['email', 'phone']
      })

      const result = await complianceIntegration.trackPrompt(prompt, mockContext)

      expect(result.piiDetected).toBe(true)
      expect(result.consentRequired).toBe(true)
      expect(result.warnings).toContain('PII detected in prompt - consider explicit consent')
    })

    it('should skip tracking when disabled', async () => {
      complianceIntegration.updateConfig({ trackPrompts: false })
      
      const result = await complianceIntegration.trackPrompt('test prompt', mockContext)

      expect(result.recordIds).toHaveLength(0)
      expect(result.piiDetected).toBe(false)
    })

    it('should use custom retention period and legal basis', async () => {
      const { complianceManager } = await import('../compliance')
      
      await complianceIntegration.trackPrompt('test prompt', mockContext, {
        retentionPeriod: 90,
        purposes: ['custom purpose']
      })

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionPeriod: 90,
          purpose: ['custom purpose']
        })
      )
    })
  })

  describe('Response Tracking', () => {
    it('should track AI responses', async () => {
      const response = 'I can help you with your project. Here are some suggestions...'
      
      const result = await complianceIntegration.trackResponse(response, mockContext)

      expect(result.recordIds).toHaveLength(1)
      expect(result.piiDetected).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it('should detect PII in responses', async () => {
      const response = 'Your account number is 123456789'
      
      mockSecurityManager.scrubPII = vi.fn().mockResolvedValue({
        piiDetected: true,
        confidence: 0.8,
        scrubbedText: 'Your account number is [ACCOUNT_NUMBER]',
        detectedPII: ['account_number']
      })

      const result = await complianceIntegration.trackResponse(response, mockContext)

      expect(result.piiDetected).toBe(true)
      expect(result.warnings).toContain('PII detected in AI response')
    })

    it('should link responses to prompts', async () => {
      const { complianceManager } = await import('../compliance')
      
      await complianceIntegration.trackResponse('test response', mockContext, {
        relatedPromptRecordId: 'prompt-record-123'
      })

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            relatedPromptRecordId: 'prompt-record-123'
          })
        })
      )
    })
  })

  describe('Conversation Tracking', () => {
    it('should track entire conversations', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' }
      ]

      const result = await complianceIntegration.trackConversation(messages, mockContext)

      expect(result.recordIds).toHaveLength(1)
      expect(result.piiDetected).toBe(false)
    })

    it('should detect PII in conversations', async () => {
      const messages = [
        { role: 'user', content: 'My name is John Doe and I live at 123 Main St' },
        { role: 'assistant', content: 'Hello John, how can I help you?' }
      ]

      mockSecurityManager.scrubPII = vi.fn().mockResolvedValue({
        piiDetected: true,
        confidence: 0.9,
        scrubbedText: 'My name is [NAME] and I live at [ADDRESS] Hello [NAME], how can I help you?',
        detectedPII: ['name', 'address']
      })

      const result = await complianceIntegration.trackConversation(messages, mockContext)

      expect(result.piiDetected).toBe(true)
      expect(result.consentRequired).toBe(true)
      expect(result.warnings).toContain('PII detected in conversation')
    })

    it('should include message count in metadata', async () => {
      const { complianceManager } = await import('../compliance')
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ]

      await complianceIntegration.trackConversation(messages, mockContext)

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            messageCount: 2
          })
        })
      )
    })
  })

  describe('Embedding Tracking', () => {
    it('should track embeddings when enabled', async () => {
      const text = 'This is text to be embedded'
      const embedding = new Array(1536).fill(0).map(() => Math.random())

      const result = await complianceIntegration.trackEmbedding(text, embedding, mockContext)

      expect(result.recordIds).toHaveLength(1)
      expect(result.piiDetected).toBe(false)
    })

    it('should skip embedding tracking when disabled', async () => {
      complianceIntegration.updateConfig({ trackEmbeddings: false })
      
      const result = await complianceIntegration.trackEmbedding(
        'test text', 
        [0.1, 0.2, 0.3], 
        mockContext
      )

      expect(result.recordIds).toHaveLength(0)
    })

    it('should detect PII in embedding source text', async () => {
      const text = 'User email: user@example.com'
      const embedding = [0.1, 0.2, 0.3]

      mockSecurityManager.scrubPII = vi.fn().mockResolvedValue({
        piiDetected: true,
        confidence: 0.8,
        scrubbedText: 'User email: [EMAIL]',
        detectedPII: ['email']
      })

      const result = await complianceIntegration.trackEmbedding(text, embedding, mockContext)

      expect(result.piiDetected).toBe(true)
      expect(result.consentRequired).toBe(true)
      expect(result.warnings).toContain('PII detected in embedding source text')
    })

    it('should store embedding metadata without actual vector', async () => {
      const { complianceManager } = await import('../compliance')
      const embedding = new Array(1536).fill(0)

      await complianceIntegration.trackEmbedding('test text', embedding, mockContext)

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            embedding: '[EMBEDDING_VECTOR]',
            dimensions: 1536
          }),
          metadata: expect.objectContaining({
            embeddingDimensions: 1536
          })
        })
      )
    })
  })

  describe('Data Subject Requests', () => {
    it('should handle access requests', async () => {
      const { complianceManager } = await import('../compliance')
      
      const requestId = await complianceIntegration.handleDataSubjectRequest(
        'access',
        mockContext.subject,
        'I want to see my data'
      )

      expect(requestId).toBe('request-456')
      expect(complianceManager.handlePrivacyRequest).toHaveBeenCalledWith({
        type: 'access',
        subject: mockContext.subject,
        details: 'I want to see my data',
        verified: false
      })
    })

    it('should handle delete requests', async () => {
      const { complianceManager } = await import('../compliance')
      
      await complianceIntegration.handleDataSubjectRequest(
        'delete',
        mockContext.subject
      )

      expect(complianceManager.handlePrivacyRequest).toHaveBeenCalledWith({
        type: 'erasure',
        subject: mockContext.subject,
        details: 'delete request via AI system',
        verified: false
      })
    })

    it('should handle portability requests', async () => {
      const { complianceManager } = await import('../compliance')
      
      await complianceIntegration.handleDataSubjectRequest(
        'portability',
        mockContext.subject
      )

      expect(complianceManager.handlePrivacyRequest).toHaveBeenCalledWith({
        type: 'portability',
        subject: mockContext.subject,
        details: 'portability request via AI system',
        verified: false
      })
    })

    it('should throw error when compliance is disabled', async () => {
      complianceIntegration.updateConfig({ enabled: false })

      await expect(complianceIntegration.handleDataSubjectRequest(
        'access',
        mockContext.subject
      )).rejects.toThrow('Compliance features are disabled')
    })
  })

  describe('Compliance Summary', () => {
    it('should generate compliance summary for data subject', async () => {
      const { complianceManager } = await import('../compliance')
      
      // Mock personal data records
      complianceManager.getPersonalData = vi.fn().mockResolvedValue([
        {
          id: 'record-1',
          dataType: 'prompt',
          collectedAt: Date.now() - 86400000, // 1 day ago
          retentionPeriod: 365
        },
        {
          id: 'record-2',
          dataType: 'response',
          collectedAt: Date.now() - 3600000, // 1 hour ago
          retentionPeriod: 180
        }
      ])

      // Mock audit logs
      complianceManager.getAuditLogs = vi.fn().mockResolvedValue([
        { type: 'privacy_request', activity: 'access request' }
      ])

      const summary = await complianceIntegration.getComplianceSummary(mockContext.subject)

      expect(summary.personalDataRecords).toBe(2)
      expect(summary.dataTypes).toEqual(['prompt', 'response'])
      expect(summary.totalRetentionPeriod).toBe(365)
      expect(summary.privacyRequests).toBe(1)
      expect(summary.consentStatus).toBe('unknown')
    })

    it('should handle empty data for compliance summary', async () => {
      const { complianceManager } = await import('../compliance')
      
      complianceManager.getPersonalData = vi.fn().mockResolvedValue([])
      complianceManager.getAuditLogs = vi.fn().mockResolvedValue([])

      const summary = await complianceIntegration.getComplianceSummary(mockContext.subject)

      expect(summary.personalDataRecords).toBe(0)
      expect(summary.dataTypes).toEqual([])
      expect(summary.oldestRecord).toBeNull()
      expect(summary.newestRecord).toBeNull()
      expect(summary.totalRetentionPeriod).toBe(0)
      expect(summary.privacyRequests).toBe(0)
    })
  })

  describe('Configuration', () => {
    it('should update configuration', () => {
      complianceIntegration.updateConfig({
        defaultRetentionPeriod: 180,
        piiDetectionThreshold: 0.8
      })

      const config = complianceIntegration.getConfig()
      expect(config.defaultRetentionPeriod).toBe(180)
      expect(config.piiDetectionThreshold).toBe(0.8)
    })

    it('should return current configuration', () => {
      const config = complianceIntegration.getConfig()
      
      expect(config).toHaveProperty('enabled')
      expect(config).toHaveProperty('trackPrompts')
      expect(config).toHaveProperty('trackResponses')
      expect(config).toHaveProperty('defaultRetentionPeriod')
      expect(config).toHaveProperty('piiDetectionThreshold')
    })
  })

  describe('Content Storage Decisions', () => {
    it('should not store very long content', async () => {
      const { complianceManager } = await import('../compliance')
      const longPrompt = 'a'.repeat(15000) // Very long content
      
      await complianceIntegration.trackPrompt(longPrompt, mockContext)

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '[CONTENT_NOT_STORED]'
        })
      )
    })

    it('should not store content with sensitive patterns', async () => {
      const { complianceManager } = await import('../compliance')
      const sensitivePrompt = 'My SSN is 123-45-6789 and credit card is 4111-1111-1111-1111'
      
      await complianceIntegration.trackPrompt(sensitivePrompt, mockContext)

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '[CONTENT_NOT_STORED]'
        })
      )
    })

    it('should store normal content', async () => {
      const { complianceManager } = await import('../compliance')
      const normalPrompt = 'Hello, can you help me with my project?'
      
      await complianceIntegration.trackPrompt(normalPrompt, mockContext)

      expect(complianceManager.registerPersonalData).toHaveBeenCalledWith(
        expect.objectContaining({
          content: normalPrompt
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle registration errors gracefully', async () => {
      const { complianceManager } = await import('../compliance')
      complianceManager.registerPersonalData = vi.fn().mockRejectedValue(new Error('Registration failed'))

      const result = await complianceIntegration.trackPrompt('test prompt', mockContext)

      expect(result.recordIds).toHaveLength(0)
      expect(result.warnings).toContain('Failed to register prompt data: Registration failed')
    })

    it('should handle PII detection errors gracefully', async () => {
      mockSecurityManager.scrubPII = vi.fn().mockRejectedValue(new Error('PII detection failed'))

      const result = await complianceIntegration.trackPrompt('test prompt', mockContext)

      // Should still register data even if PII detection fails
      expect(result.recordIds).toHaveLength(1)
      expect(result.piiDetected).toBe(false)
    })
  })

  describe('Integration Disabled', () => {
    it('should skip all tracking when disabled', async () => {
      complianceIntegration.updateConfig({ enabled: false })

      const promptResult = await complianceIntegration.trackPrompt('test', mockContext)
      const responseResult = await complianceIntegration.trackResponse('test', mockContext)
      const conversationResult = await complianceIntegration.trackConversation([], mockContext)
      const embeddingResult = await complianceIntegration.trackEmbedding('test', [], mockContext)

      expect(promptResult.recordIds).toHaveLength(0)
      expect(responseResult.recordIds).toHaveLength(0)
      expect(conversationResult.recordIds).toHaveLength(0)
      expect(embeddingResult.recordIds).toHaveLength(0)
    })
  })
})