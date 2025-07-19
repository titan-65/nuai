/**
 * GDPR/CCPA Compliance and Data Protection Module
 */

export interface DataSubject {
  /** Unique identifier for the data subject */
  id: string
  /** Email address */
  email?: string
  /** User ID in the application */
  userId?: string
  /** IP address */
  ipAddress?: string
  /** Session identifier */
  sessionId?: string
  /** Additional identifiers */
  identifiers?: Record<string, string>
}

export interface PersonalDataRecord {
  /** Unique record ID */
  id: string
  /** Data subject information */
  subject: DataSubject
  /** Type of personal data */
  dataType: 'prompt' | 'response' | 'conversation' | 'embedding' | 'cache' | 'log' | 'analytics'
  /** The actual data content */
  content: any
  /** Data categories (GDPR Article 4) */
  categories: DataCategory[]
  /** Legal basis for processing */
  legalBasis: LegalBasis
  /** Purpose of processing */
  purpose: string[]
  /** Timestamp when data was collected */
  collectedAt: number
  /** Timestamp when data was last accessed */
  lastAccessedAt?: number
  /** Retention period in days */
  retentionPeriod: number
  /** Expiry timestamp */
  expiresAt: number
  /** Data source */
  source: string
  /** Processing location */
  location?: string
  /** Consent status */
  consent?: ConsentRecord
  /** Anonymization status */
  anonymized: boolean
  /** Deletion status */
  deleted: boolean
  /** Metadata */
  metadata?: Record<string, any>
}

export interface DataCategory {
  /** Category identifier */
  id: string
  /** Category name */
  name: string
  /** Description */
  description: string
  /** Sensitivity level */
  sensitivity: 'low' | 'medium' | 'high' | 'critical'
  /** Special category under GDPR Article 9 */
  specialCategory: boolean
}

export interface LegalBasis {
  /** Legal basis type under GDPR Article 6 */
  type: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests'
  /** Description of the legal basis */
  description: string
  /** Reference to specific law or regulation */
  reference?: string
}

export interface ConsentRecord {
  /** Consent ID */
  id: string
  /** Consent status */
  status: 'given' | 'withdrawn' | 'expired'
  /** Timestamp when consent was given */
  givenAt: number
  /** Timestamp when consent was withdrawn */
  withdrawnAt?: number
  /** Consent expiry */
  expiresAt?: number
  /** Consent method */
  method: 'explicit' | 'implicit' | 'opt_in' | 'opt_out'
  /** Consent scope */
  scope: string[]
  /** Consent evidence */
  evidence?: {
    ipAddress: string
    userAgent: string
    timestamp: number
    method: string
  }
}

export interface DataProcessingActivity {
  /** Activity ID */
  id: string
  /** Activity name */
  name: string
  /** Description */
  description: string
  /** Data controller */
  controller: string
  /** Data processor */
  processor?: string
  /** Data subjects */
  dataSubjects: string[]
  /** Data categories */
  dataCategories: DataCategory[]
  /** Legal basis */
  legalBasis: LegalBasis
  /** Purpose */
  purposes: string[]
  /** Recipients */
  recipients?: string[]
  /** Third country transfers */
  thirdCountryTransfers?: {
    country: string
    adequacyDecision: boolean
    safeguards: string[]
  }[]
  /** Retention period */
  retentionPeriod: number
  /** Security measures */
  securityMeasures: string[]
  /** Created timestamp */
  createdAt: number
  /** Updated timestamp */
  updatedAt: number
}

export interface ComplianceAuditLog {
  /** Log entry ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Event type */
  type: 'data_access' | 'data_export' | 'data_deletion' | 'consent_given' | 'consent_withdrawn' | 
        'data_breach' | 'privacy_request' | 'data_transfer' | 'retention_expired' | 'anonymization'
  /** Data subject */
  subject: DataSubject
  /** Activity description */
  activity: string
  /** Data affected */
  dataAffected?: {
    recordIds: string[]
    dataTypes: string[]
    categories: string[]
  }
  /** Legal basis */
  legalBasis?: LegalBasis
  /** Result */
  result: 'success' | 'failure' | 'partial'
  /** Details */
  details: any
  /** IP address */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Location */
  location?: string
}

export interface PrivacyRequest {
  /** Request ID */
  id: string
  /** Request type */
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection'
  /** Data subject */
  subject: DataSubject
  /** Request details */
  details: string
  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  /** Created timestamp */
  createdAt: number
  /** Updated timestamp */
  updatedAt: number
  /** Deadline */
  deadline: number
  /** Response */
  response?: {
    message: string
    data?: any
    timestamp: number
  }
  /** Verification status */
  verified: boolean
  /** Verification method */
  verificationMethod?: string
}

export interface ComplianceConfig {
  /** Enable compliance features */
  enabled: boolean
  /** Jurisdiction */
  jurisdiction: 'gdpr' | 'ccpa' | 'both'
  /** Default retention period in days */
  defaultRetentionPeriod: number
  /** Automatic deletion */
  automaticDeletion: boolean
  /** Data minimization */
  dataMinimization: boolean
  /** Consent management */
  consentManagement: {
    enabled: boolean
    defaultExpiry: number // days
    requireExplicit: boolean
  }
  /** Audit logging */
  auditLogging: {
    enabled: boolean
    retentionPeriod: number // days
    includeContent: boolean
  }
  /** Data breach notification */
  breachNotification: {
    enabled: boolean
    notificationPeriod: number // hours
    authorities: string[]
    contacts: string[]
  }
  /** Privacy request handling */
  privacyRequests: {
    enabled: boolean
    responsePeriod: number // days
    autoVerification: boolean
  }
}

/**
 * Compliance Manager Interface
 */
export interface ComplianceManager {
  /**
   * Register personal data
   */
  registerPersonalData(data: Omit<PersonalDataRecord, 'id' | 'collectedAt' | 'expiresAt'>): Promise<string>
  
  /**
   * Get personal data for a subject
   */
  getPersonalData(subject: Partial<DataSubject>): Promise<PersonalDataRecord[]>
  
  /**
   * Delete personal data
   */
  deletePersonalData(recordIds: string[], reason: string): Promise<void>
  
  /**
   * Anonymize personal data
   */
  anonymizePersonalData(recordIds: string[]): Promise<void>
  
  /**
   * Export personal data
   */
  exportPersonalData(subject: Partial<DataSubject>, format: 'json' | 'csv' | 'xml'): Promise<any>
  
  /**
   * Handle privacy request
   */
  handlePrivacyRequest(request: Omit<PrivacyRequest, 'id' | 'createdAt' | 'updatedAt' | 'deadline' | 'status'>): Promise<string>
  
  /**
   * Process privacy request
   */
  processPrivacyRequest(requestId: string): Promise<void>
  
  /**
   * Record consent
   */
  recordConsent(consent: Omit<ConsentRecord, 'id'>): Promise<string>
  
  /**
   * Withdraw consent
   */
  withdrawConsent(consentId: string, reason?: string): Promise<void>
  
  /**
   * Check consent status
   */
  checkConsent(subject: Partial<DataSubject>, scope: string[]): Promise<ConsentRecord | null>
  
  /**
   * Clean up expired data
   */
  cleanupExpiredData(): Promise<number>
  
  /**
   * Generate compliance report
   */
  generateComplianceReport(startDate: number, endDate: number): Promise<{
    dataProcessingActivities: DataProcessingActivity[]
    privacyRequests: PrivacyRequest[]
    auditLogs: ComplianceAuditLog[]
    dataRetention: {
      totalRecords: number
      expiredRecords: number
      deletedRecords: number
      anonymizedRecords: number
    }
    consentMetrics: {
      totalConsents: number
      activeConsents: number
      withdrawnConsents: number
      expiredConsents: number
    }
  }>
  
  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    startTime?: number
    endTime?: number
    type?: string
    subject?: Partial<DataSubject>
  }): Promise<ComplianceAuditLog[]>
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComplianceConfig>): void
}

/**
 * Default Compliance Manager Implementation
 */
export class DefaultComplianceManager implements ComplianceManager {
  private config: ComplianceConfig
  private personalDataRecords: Map<string, PersonalDataRecord> = new Map()
  private consentRecords: Map<string, ConsentRecord> = new Map()
  private privacyRequests: Map<string, PrivacyRequest> = new Map()
  private auditLogs: ComplianceAuditLog[] = []
  private processingActivities: Map<string, DataProcessingActivity> = new Map()

  constructor(config: Partial<ComplianceConfig> = {}) {
    this.config = {
      enabled: true,
      jurisdiction: 'both',
      defaultRetentionPeriod: 365, // 1 year
      automaticDeletion: true,
      dataMinimization: true,
      consentManagement: {
        enabled: true,
        defaultExpiry: 365, // 1 year
        requireExplicit: true
      },
      auditLogging: {
        enabled: true,
        retentionPeriod: 2555, // 7 years
        includeContent: false
      },
      breachNotification: {
        enabled: true,
        notificationPeriod: 72, // 72 hours
        authorities: [],
        contacts: []
      },
      privacyRequests: {
        enabled: true,
        responsePeriod: 30, // 30 days
        autoVerification: false
      },
      ...config
    }

    // Start cleanup scheduler
    if (this.config.automaticDeletion) {
      this.startCleanupScheduler()
    }
  }

  async registerPersonalData(data: Omit<PersonalDataRecord, 'id' | 'collectedAt' | 'expiresAt'>): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Compliance features are disabled')
    }

    const id = `pd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    const expiresAt = now + (data.retentionPeriod * 24 * 60 * 60 * 1000)

    const record: PersonalDataRecord = {
      id,
      collectedAt: now,
      expiresAt,
      anonymized: false,
      deleted: false,
      ...data
    }

    this.personalDataRecords.set(id, record)

    // Log the data registration
    await this.logComplianceEvent({
      type: 'data_access',
      subject: data.subject,
      activity: `Personal data registered: ${data.dataType}`,
      dataAffected: {
        recordIds: [id],
        dataTypes: [data.dataType],
        categories: data.categories.map(c => c.name)
      },
      legalBasis: data.legalBasis,
      result: 'success',
      details: { purpose: data.purpose }
    })

    return id
  }

  async getPersonalData(subject: Partial<DataSubject>): Promise<PersonalDataRecord[]> {
    const records = Array.from(this.personalDataRecords.values())
      .filter(record => this.matchesSubject(record.subject, subject))
      .filter(record => !record.deleted)

    // Log data access
    if (records.length > 0) {
      await this.logComplianceEvent({
        type: 'data_access',
        subject: subject as DataSubject,
        activity: 'Personal data accessed',
        dataAffected: {
          recordIds: records.map(r => r.id),
          dataTypes: records.map(r => r.dataType),
          categories: records.flatMap(r => r.categories.map(c => c.name))
        },
        result: 'success',
        details: { recordCount: records.length }
      })
    }

    return records
  }

  async deletePersonalData(recordIds: string[], reason: string): Promise<void> {
    const deletedRecords: PersonalDataRecord[] = []

    for (const id of recordIds) {
      const record = this.personalDataRecords.get(id)
      if (record && !record.deleted) {
        record.deleted = true
        record.metadata = { ...record.metadata, deletionReason: reason, deletedAt: Date.now() }
        deletedRecords.push(record)
      }
    }

    if (deletedRecords.length > 0) {
      await this.logComplianceEvent({
        type: 'data_deletion',
        subject: deletedRecords[0].subject,
        activity: `Personal data deleted: ${reason}`,
        dataAffected: {
          recordIds: deletedRecords.map(r => r.id),
          dataTypes: deletedRecords.map(r => r.dataType),
          categories: deletedRecords.flatMap(r => r.categories.map(c => c.name))
        },
        result: 'success',
        details: { reason, recordCount: deletedRecords.length }
      })
    }
  }

  async anonymizePersonalData(recordIds: string[]): Promise<void> {
    const anonymizedRecords: PersonalDataRecord[] = []

    for (const id of recordIds) {
      const record = this.personalDataRecords.get(id)
      if (record && !record.anonymized && !record.deleted) {
        record.anonymized = true
        record.content = this.anonymizeContent(record.content, record.dataType)
        record.subject = this.anonymizeSubject(record.subject)
        record.metadata = { ...record.metadata, anonymizedAt: Date.now() }
        anonymizedRecords.push(record)
      }
    }

    if (anonymizedRecords.length > 0) {
      await this.logComplianceEvent({
        type: 'anonymization',
        subject: anonymizedRecords[0].subject,
        activity: 'Personal data anonymized',
        dataAffected: {
          recordIds: anonymizedRecords.map(r => r.id),
          dataTypes: anonymizedRecords.map(r => r.dataType),
          categories: anonymizedRecords.flatMap(r => r.categories.map(c => c.name))
        },
        result: 'success',
        details: { recordCount: anonymizedRecords.length }
      })
    }
  }

  async exportPersonalData(subject: Partial<DataSubject>, format: 'json' | 'csv' | 'xml'): Promise<any> {
    const records = await this.getPersonalData(subject)
    
    await this.logComplianceEvent({
      type: 'data_export',
      subject: subject as DataSubject,
      activity: `Personal data exported in ${format} format`,
      dataAffected: {
        recordIds: records.map(r => r.id),
        dataTypes: records.map(r => r.dataType),
        categories: records.flatMap(r => r.categories.map(c => c.name))
      },
      result: 'success',
      details: { format, recordCount: records.length }
    })

    switch (format) {
      case 'json':
        return JSON.stringify(records, null, 2)
      case 'csv':
        return this.convertToCSV(records)
      case 'xml':
        return this.convertToXML(records)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  async handlePrivacyRequest(request: Omit<PrivacyRequest, 'id' | 'createdAt' | 'updatedAt' | 'deadline' | 'status'>): Promise<string> {
    const id = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    const deadline = now + (this.config.privacyRequests.responsePeriod * 24 * 60 * 60 * 1000)

    const privacyRequest: PrivacyRequest = {
      id,
      createdAt: now,
      updatedAt: now,
      deadline,
      status: 'pending',
      verified: this.config.privacyRequests.autoVerification,
      ...request
    }

    this.privacyRequests.set(id, privacyRequest)

    await this.logComplianceEvent({
      type: 'privacy_request',
      subject: request.subject,
      activity: `Privacy request received: ${request.type}`,
      result: 'success',
      details: { requestType: request.type, details: request.details }
    })

    return id
  }

  async processPrivacyRequest(requestId: string): Promise<void> {
    const request = this.privacyRequests.get(requestId)
    if (!request) {
      throw new Error(`Privacy request not found: ${requestId}`)
    }

    if (!request.verified) {
      throw new Error('Privacy request must be verified before processing')
    }

    request.status = 'in_progress'
    request.updatedAt = Date.now()

    try {
      switch (request.type) {
        case 'access':
          const data = await this.getPersonalData(request.subject)
          request.response = {
            message: 'Personal data export completed',
            data: data,
            timestamp: Date.now()
          }
          break

        case 'erasure':
          const records = await this.getPersonalData(request.subject)
          await this.deletePersonalData(records.map(r => r.id), 'Privacy request - Right to erasure')
          request.response = {
            message: `${records.length} records deleted`,
            timestamp: Date.now()
          }
          break

        case 'portability':
          const exportData = await this.exportPersonalData(request.subject, 'json')
          request.response = {
            message: 'Data portability export completed',
            data: JSON.parse(exportData),
            timestamp: Date.now()
          }
          break

        case 'rectification':
        case 'restriction':
        case 'objection':
          // These would require manual handling
          request.response = {
            message: 'Request requires manual review',
            timestamp: Date.now()
          }
          break
      }

      request.status = 'completed'
      request.updatedAt = Date.now()

      await this.logComplianceEvent({
        type: 'privacy_request',
        subject: request.subject,
        activity: `Privacy request processed: ${request.type}`,
        result: 'success',
        details: { requestType: request.type, response: request.response?.message }
      })

    } catch (error) {
      request.status = 'rejected'
      request.updatedAt = Date.now()
      request.response = {
        message: `Request processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      }

      await this.logComplianceEvent({
        type: 'privacy_request',
        subject: request.subject,
        activity: `Privacy request failed: ${request.type}`,
        result: 'failure',
        details: { requestType: request.type, error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  async recordConsent(consent: Omit<ConsentRecord, 'id'>): Promise<string> {
    const id = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const consentRecord: ConsentRecord = {
      id,
      ...consent
    }

    this.consentRecords.set(id, consentRecord)

    await this.logComplianceEvent({
      type: 'consent_given',
      subject: { id: 'unknown' }, // Would need to be passed in
      activity: `Consent recorded for scopes: ${consent.scope.join(', ')}`,
      result: 'success',
      details: { consentId: id, scope: consent.scope, method: consent.method }
    })

    return id
  }

  async withdrawConsent(consentId: string, reason?: string): Promise<void> {
    const consent = this.consentRecords.get(consentId)
    if (!consent) {
      throw new Error(`Consent record not found: ${consentId}`)
    }

    consent.status = 'withdrawn'
    consent.withdrawnAt = Date.now()

    await this.logComplianceEvent({
      type: 'consent_withdrawn',
      subject: { id: 'unknown' }, // Would need to be tracked
      activity: `Consent withdrawn for scopes: ${consent.scope.join(', ')}`,
      result: 'success',
      details: { consentId, reason, scope: consent.scope }
    })
  }

  async checkConsent(subject: Partial<DataSubject>, scope: string[]): Promise<ConsentRecord | null> {
    // This is a simplified implementation - in practice, you'd need to link consents to subjects
    const consents = Array.from(this.consentRecords.values())
      .filter(consent => consent.status === 'given')
      .filter(consent => scope.every(s => consent.scope.includes(s)))
      .filter(consent => !consent.expiresAt || consent.expiresAt > Date.now())

    return consents[0] || null
  }

  async cleanupExpiredData(): Promise<number> {
    const now = Date.now()
    let deletedCount = 0

    // Clean up expired personal data
    for (const [id, record] of this.personalDataRecords.entries()) {
      if (record.expiresAt <= now && !record.deleted) {
        await this.deletePersonalData([id], 'Automatic cleanup - retention period expired')
        deletedCount++
      }
    }

    // Clean up expired audit logs
    const auditRetentionPeriod = this.config.auditLogging.retentionPeriod * 24 * 60 * 60 * 1000
    this.auditLogs = this.auditLogs.filter(log => (now - log.timestamp) < auditRetentionPeriod)

    return deletedCount
  }

  async generateComplianceReport(startDate: number, endDate: number): Promise<any> {
    const auditLogs = this.auditLogs.filter(log => 
      log.timestamp >= startDate && log.timestamp <= endDate
    )

    const privacyRequests = Array.from(this.privacyRequests.values())
      .filter(req => req.createdAt >= startDate && req.createdAt <= endDate)

    const personalDataRecords = Array.from(this.personalDataRecords.values())
    const consentRecords = Array.from(this.consentRecords.values())

    return {
      dataProcessingActivities: Array.from(this.processingActivities.values()),
      privacyRequests,
      auditLogs,
      dataRetention: {
        totalRecords: personalDataRecords.length,
        expiredRecords: personalDataRecords.filter(r => r.expiresAt <= Date.now()).length,
        deletedRecords: personalDataRecords.filter(r => r.deleted).length,
        anonymizedRecords: personalDataRecords.filter(r => r.anonymized).length
      },
      consentMetrics: {
        totalConsents: consentRecords.length,
        activeConsents: consentRecords.filter(c => c.status === 'given').length,
        withdrawnConsents: consentRecords.filter(c => c.status === 'withdrawn').length,
        expiredConsents: consentRecords.filter(c => c.status === 'expired').length
      }
    }
  }

  async getAuditLogs(filters?: {
    startTime?: number
    endTime?: number
    type?: string
    subject?: Partial<DataSubject>
  }): Promise<ComplianceAuditLog[]> {
    let logs = [...this.auditLogs]

    if (filters) {
      if (filters.startTime) {
        logs = logs.filter(log => log.timestamp >= filters.startTime!)
      }
      if (filters.endTime) {
        logs = logs.filter(log => log.timestamp <= filters.endTime!)
      }
      if (filters.type) {
        logs = logs.filter(log => log.type === filters.type)
      }
      if (filters.subject) {
        logs = logs.filter(log => this.matchesSubject(log.subject, filters.subject!))
      }
    }

    return logs
  }

  updateConfig(config: Partial<ComplianceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private async logComplianceEvent(event: Omit<ComplianceAuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.auditLogging.enabled) return

    const logEntry: ComplianceAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...event
    }

    this.auditLogs.push(logEntry)

    // Keep only logs within retention period
    const retentionPeriod = this.config.auditLogging.retentionPeriod * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - retentionPeriod
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoff)
  }

  private matchesSubject(subject1: DataSubject, subject2: Partial<DataSubject>): boolean {
    if (subject2.id && subject1.id === subject2.id) return true
    if (subject2.email && subject1.email === subject2.email) return true
    if (subject2.userId && subject1.userId === subject2.userId) return true
    if (subject2.sessionId && subject1.sessionId === subject2.sessionId) return true
    return false
  }

  private anonymizeContent(content: any, dataType: string): any {
    // Simple anonymization - in practice, this would be more sophisticated
    if (typeof content === 'string') {
      return '[ANONYMIZED]'
    }
    if (typeof content === 'object' && content !== null) {
      const anonymized: any = {}
      for (const key in content) {
        anonymized[key] = '[ANONYMIZED]'
      }
      return anonymized
    }
    return '[ANONYMIZED]'
  }

  private anonymizeSubject(subject: DataSubject): DataSubject {
    return {
      id: `anon_${Math.random().toString(36).substr(2, 9)}`,
      email: undefined,
      userId: undefined,
      ipAddress: undefined,
      sessionId: undefined,
      identifiers: undefined
    }
  }

  private convertToCSV(records: PersonalDataRecord[]): string {
    if (records.length === 0) return ''

    const headers = ['id', 'dataType', 'collectedAt', 'retentionPeriod', 'purpose', 'legalBasis', 'anonymized', 'deleted']
    const rows = records.map(record => [
      record.id,
      record.dataType,
      new Date(record.collectedAt).toISOString(),
      record.retentionPeriod.toString(),
      record.purpose.join(';'),
      record.legalBasis.type,
      record.anonymized.toString(),
      record.deleted.toString()
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  private convertToXML(records: PersonalDataRecord[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<personalData>\n'
    
    for (const record of records) {
      xml += '  <record>\n'
      xml += `    <id>${record.id}</id>\n`
      xml += `    <dataType>${record.dataType}</dataType>\n`
      xml += `    <collectedAt>${new Date(record.collectedAt).toISOString()}</collectedAt>\n`
      xml += `    <retentionPeriod>${record.retentionPeriod}</retentionPeriod>\n`
      xml += `    <purpose>${record.purpose.join(';')}</purpose>\n`
      xml += `    <legalBasis>${record.legalBasis.type}</legalBasis>\n`
      xml += `    <anonymized>${record.anonymized}</anonymized>\n`
      xml += `    <deleted>${record.deleted}</deleted>\n`
      xml += '  </record>\n'
    }
    
    xml += '</personalData>'
    return xml
  }

  private startCleanupScheduler(): void {
    // Run cleanup every 24 hours
    setInterval(async () => {
      try {
        await this.cleanupExpiredData()
      } catch (error) {
        console.error('Compliance cleanup failed:', error)
      }
    }, 24 * 60 * 60 * 1000)
  }
}

// Export default instance
export const complianceManager = new DefaultComplianceManager()

// Common data categories
export const DATA_CATEGORIES = {
  PERSONAL_IDENTIFIERS: {
    id: 'personal_identifiers',
    name: 'Personal Identifiers',
    description: 'Names, email addresses, phone numbers, etc.',
    sensitivity: 'medium' as const,
    specialCategory: false
  },
  BIOMETRIC_DATA: {
    id: 'biometric_data',
    name: 'Biometric Data',
    description: 'Fingerprints, voice patterns, facial recognition data',
    sensitivity: 'critical' as const,
    specialCategory: true
  },
  LOCATION_DATA: {
    id: 'location_data',
    name: 'Location Data',
    description: 'GPS coordinates, IP addresses, location history',
    sensitivity: 'high' as const,
    specialCategory: false
  },
  BEHAVIORAL_DATA: {
    id: 'behavioral_data',
    name: 'Behavioral Data',
    description: 'Usage patterns, preferences, interaction data',
    sensitivity: 'medium' as const,
    specialCategory: false
  },
  COMMUNICATION_DATA: {
    id: 'communication_data',
    name: 'Communication Data',
    description: 'Messages, emails, chat logs, AI conversations',
    sensitivity: 'high' as const,
    specialCategory: false
  }
} as const

// Common legal bases
export const LEGAL_BASES = {
  CONSENT: {
    type: 'consent' as const,
    description: 'The data subject has given consent to the processing'
  },
  CONTRACT: {
    type: 'contract' as const,
    description: 'Processing is necessary for the performance of a contract'
  },
  LEGAL_OBLIGATION: {
    type: 'legal_obligation' as const,
    description: 'Processing is necessary for compliance with a legal obligation'
  },
  LEGITIMATE_INTERESTS: {
    type: 'legitimate_interests' as const,
    description: 'Processing is necessary for legitimate interests pursued by the controller'
  }
} as const