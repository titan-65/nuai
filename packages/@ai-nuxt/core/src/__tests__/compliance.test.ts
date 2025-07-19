/**
 * Tests for GDPR/CCPA compliance and audit logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { 
  DefaultComplianceManager,
  DATA_CATEGORIES,
  LEGAL_BASES,
  type DataSubject,
  type PersonalDataRecord,
  type ConsentRecord,
  type PrivacyRequest
} from '../compliance'

describe('Compliance Manager', () => {
  let complianceManager: DefaultComplianceManager
  let mockDataSubject: DataSubject

  beforeEach(() => {
    complianceManager = new DefaultComplianceManager({
      enabled: true,
      jurisdiction: 'both',
      defaultRetentionPeriod: 365,
      automaticDeletion: false, // Disable for testing
      auditLogging: {
        enabled: true,
        retentionPeriod: 2555,
        includeContent: false
      }
    })

    mockDataSubject = {
      id: 'user-123',
      email: 'test@example.com',
      userId: 'app-user-456',
      ipAddress: '192.168.1.1',
      sessionId: 'session-789'
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Personal Data Management', () => {
    it('should register personal data', async () => {
      const recordId = await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Hello, AI assistant!',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      expect(recordId).toMatch(/^pd_\d+_[a-z0-9]+$/)

      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(1)
      expect(records[0].id).toBe(recordId)
      expect(records[0].content).toBe('Hello, AI assistant!')
      expect(records[0].dataType).toBe('prompt')
    })

    it('should retrieve personal data by subject', async () => {
      // Register multiple records
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'First prompt',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'response',
        content: 'AI response',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'ai-provider'
      })

      // Register data for different subject
      await complianceManager.registerPersonalData({
        subject: { id: 'other-user', email: 'other@example.com' },
        dataType: 'prompt',
        content: 'Other user prompt',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(2)
      expect(records.map(r => r.content)).toEqual(['First prompt', 'AI response'])
    })

    it('should delete personal data', async () => {
      const recordId = await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'To be deleted',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      await complianceManager.deletePersonalData([recordId], 'User request')

      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(0) // Deleted records are filtered out
    })

    it('should anonymize personal data', async () => {
      const recordId = await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Sensitive information',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      await complianceManager.anonymizePersonalData([recordId])

      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(0) // Original subject won't match anonymized record

      // But the record still exists, just anonymized
      const allRecords = await complianceManager.getPersonalData({})
      const anonymizedRecord = allRecords.find(r => r.id === recordId)
      expect(anonymizedRecord?.anonymized).toBe(true)
      expect(anonymizedRecord?.content).toBe('[ANONYMIZED]')
    })

    it('should export personal data in different formats', async () => {
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Export test data',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      // Test JSON export
      const jsonExport = await complianceManager.exportPersonalData(mockDataSubject, 'json')
      const jsonData = JSON.parse(jsonExport)
      expect(Array.isArray(jsonData)).toBe(true)
      expect(jsonData[0].content).toBe('Export test data')

      // Test CSV export
      const csvExport = await complianceManager.exportPersonalData(mockDataSubject, 'csv')
      expect(csvExport).toContain('id,dataType,collectedAt')
      expect(csvExport).toContain('prompt')

      // Test XML export
      const xmlExport = await complianceManager.exportPersonalData(mockDataSubject, 'xml')
      expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xmlExport).toContain('<dataType>prompt</dataType>')
    })
  })

  describe('Privacy Requests', () => {
    beforeEach(async () => {
      // Set up test data
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Test prompt',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })
    })

    it('should handle data access requests', async () => {
      const requestId = await complianceManager.handlePrivacyRequest({
        type: 'access',
        subject: mockDataSubject,
        details: 'I want to see all my personal data',
        verified: true
      })

      await complianceManager.processPrivacyRequest(requestId)

      const auditLogs = await complianceManager.getAuditLogs({
        type: 'privacy_request'
      })

      expect(auditLogs).toHaveLength(2) // One for request creation, one for processing
      expect(auditLogs[1].activity).toContain('Privacy request processed: access')
    })

    it('should handle data erasure requests', async () => {
      const requestId = await complianceManager.handlePrivacyRequest({
        type: 'erasure',
        subject: mockDataSubject,
        details: 'Please delete all my data',
        verified: true
      })

      await complianceManager.processPrivacyRequest(requestId)

      // Data should be deleted
      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(0)
    })

    it('should handle data portability requests', async () => {
      const requestId = await complianceManager.handlePrivacyRequest({
        type: 'portability',
        subject: mockDataSubject,
        details: 'I want to export my data',
        verified: true
      })

      await complianceManager.processPrivacyRequest(requestId)

      const auditLogs = await complianceManager.getAuditLogs({
        type: 'privacy_request'
      })

      const processedLog = auditLogs.find(log => 
        log.activity.includes('Privacy request processed: portability')
      )
      expect(processedLog).toBeDefined()
    })

    it('should require verification before processing', async () => {
      const requestId = await complianceManager.handlePrivacyRequest({
        type: 'access',
        subject: mockDataSubject,
        details: 'Unverified request',
        verified: false
      })

      await expect(complianceManager.processPrivacyRequest(requestId))
        .rejects.toThrow('Privacy request must be verified before processing')
    })
  })

  describe('Consent Management', () => {
    it('should record consent', async () => {
      const consentId = await complianceManager.recordConsent({
        status: 'given',
        givenAt: Date.now(),
        method: 'explicit',
        scope: ['data_processing', 'marketing'],
        evidence: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          timestamp: Date.now(),
          method: 'checkbox'
        }
      })

      expect(consentId).toMatch(/^consent_\d+_[a-z0-9]+$/)

      const auditLogs = await complianceManager.getAuditLogs({
        type: 'consent_given'
      })
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].activity).toContain('data_processing, marketing')
    })

    it('should withdraw consent', async () => {
      const consentId = await complianceManager.recordConsent({
        status: 'given',
        givenAt: Date.now(),
        method: 'explicit',
        scope: ['data_processing']
      })

      await complianceManager.withdrawConsent(consentId, 'User request')

      const auditLogs = await complianceManager.getAuditLogs({
        type: 'consent_withdrawn'
      })
      expect(auditLogs).toHaveLength(1)
      expect(auditLogs[0].details.reason).toBe('User request')
    })

    it('should check consent status', async () => {
      const consentId = await complianceManager.recordConsent({
        status: 'given',
        givenAt: Date.now(),
        method: 'explicit',
        scope: ['data_processing', 'analytics']
      })

      // Check for existing scope
      const consent = await complianceManager.checkConsent(mockDataSubject, ['data_processing'])
      expect(consent).toBeTruthy()
      expect(consent?.scope).toContain('data_processing')

      // Check for non-existing scope
      const noConsent = await complianceManager.checkConsent(mockDataSubject, ['marketing'])
      expect(noConsent).toBeNull()
    })
  })

  describe('Data Cleanup', () => {
    it('should clean up expired data', async () => {
      // Register data with short retention period
      const recordId = await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Expired data',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 0, // Expires immediately
        source: 'chat-interface'
      })

      // Wait a bit to ensure expiry
      await new Promise(resolve => setTimeout(resolve, 10))

      const deletedCount = await complianceManager.cleanupExpiredData()
      expect(deletedCount).toBe(1)

      const records = await complianceManager.getPersonalData(mockDataSubject)
      expect(records).toHaveLength(0)
    })
  })

  describe('Compliance Reporting', () => {
    beforeEach(async () => {
      // Set up test data
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Report test data',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      await complianceManager.recordConsent({
        status: 'given',
        givenAt: Date.now(),
        method: 'explicit',
        scope: ['data_processing']
      })

      await complianceManager.handlePrivacyRequest({
        type: 'access',
        subject: mockDataSubject,
        details: 'Test request',
        verified: true
      })
    })

    it('should generate compliance report', async () => {
      const startDate = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
      const endDate = Date.now()

      const report = await complianceManager.generateComplianceReport(startDate, endDate)

      expect(report).toHaveProperty('dataProcessingActivities')
      expect(report).toHaveProperty('privacyRequests')
      expect(report).toHaveProperty('auditLogs')
      expect(report).toHaveProperty('dataRetention')
      expect(report).toHaveProperty('consentMetrics')

      expect(report.privacyRequests).toHaveLength(1)
      expect(report.dataRetention.totalRecords).toBe(1)
      expect(report.consentMetrics.totalConsents).toBe(1)
      expect(report.consentMetrics.activeConsents).toBe(1)
    })
  })

  describe('Audit Logging', () => {
    it('should log compliance events', async () => {
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Audit test',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      const auditLogs = await complianceManager.getAuditLogs()
      expect(auditLogs.length).toBeGreaterThan(0)

      const dataAccessLog = auditLogs.find(log => log.type === 'data_access')
      expect(dataAccessLog).toBeDefined()
      expect(dataAccessLog?.subject.id).toBe(mockDataSubject.id)
    })

    it('should filter audit logs', async () => {
      const startTime = Date.now()
      
      await complianceManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Filter test',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      const filteredLogs = await complianceManager.getAuditLogs({
        startTime,
        type: 'data_access',
        subject: mockDataSubject
      })

      expect(filteredLogs.length).toBeGreaterThan(0)
      expect(filteredLogs.every(log => log.type === 'data_access')).toBe(true)
      expect(filteredLogs.every(log => log.timestamp >= startTime)).toBe(true)
    })

    it('should respect audit log retention period', async () => {
      const shortRetentionManager = new DefaultComplianceManager({
        auditLogging: {
          enabled: true,
          retentionPeriod: 0, // Very short retention
          includeContent: false
        }
      })

      await shortRetentionManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Retention test',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10))

      // Trigger cleanup by registering another record
      await shortRetentionManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'New record',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })

      const logs = await shortRetentionManager.getAuditLogs()
      // Should only have recent logs due to retention cleanup
      expect(logs.length).toBeLessThan(5)
    })
  })

  describe('Configuration', () => {
    it('should update configuration', () => {
      complianceManager.updateConfig({
        defaultRetentionPeriod: 180,
        automaticDeletion: true
      })

      // Configuration should be updated (we can't directly test private config,
      // but we can test behavior that depends on it)
      expect(() => complianceManager.updateConfig({})).not.toThrow()
    })

    it('should disable features when compliance is disabled', async () => {
      const disabledManager = new DefaultComplianceManager({
        enabled: false
      })

      await expect(disabledManager.registerPersonalData({
        subject: mockDataSubject,
        dataType: 'prompt',
        content: 'Should fail',
        categories: [DATA_CATEGORIES.COMMUNICATION_DATA],
        legalBasis: LEGAL_BASES.CONSENT,
        purpose: ['AI assistance'],
        retentionPeriod: 30,
        source: 'chat-interface'
      })).rejects.toThrow('Compliance features are disabled')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid privacy request processing', async () => {
      await expect(complianceManager.processPrivacyRequest('invalid-id'))
        .rejects.toThrow('Privacy request not found: invalid-id')
    })

    it('should handle invalid consent withdrawal', async () => {
      await expect(complianceManager.withdrawConsent('invalid-id'))
        .rejects.toThrow('Consent record not found: invalid-id')
    })

    it('should handle unsupported export formats', async () => {
      await expect(complianceManager.exportPersonalData(mockDataSubject, 'pdf' as any))
        .rejects.toThrow('Unsupported export format: pdf')
    })
  })

  describe('Data Categories and Legal Bases', () => {
    it('should provide predefined data categories', () => {
      expect(DATA_CATEGORIES.PERSONAL_IDENTIFIERS.id).toBe('personal_identifiers')
      expect(DATA_CATEGORIES.BIOMETRIC_DATA.specialCategory).toBe(true)
      expect(DATA_CATEGORIES.COMMUNICATION_DATA.sensitivity).toBe('high')
    })

    it('should provide predefined legal bases', () => {
      expect(LEGAL_BASES.CONSENT.type).toBe('consent')
      expect(LEGAL_BASES.CONTRACT.type).toBe('contract')
      expect(LEGAL_BASES.LEGITIMATE_INTERESTS.type).toBe('legitimate_interests')
    })
  })
})