/**
 * Security and safety features for AI Nuxt
 */

/**
 * Prompt injection detection result
 */
export interface PromptInjectionResult {
  /** Whether injection was detected */
  detected: boolean
  /** Confidence score (0-1) */
  confidence: number
  /** Type of injection detected */
  type?: 'instruction_override' | 'role_manipulation' | 'system_bypass' | 'data_extraction' | 'jailbreak'
  /** Specific patterns that matched */
  patterns: string[]
  /** Sanitized version of the input */
  sanitized?: string
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * PII detection and scrubbing result
 */
export interface PIIResult {
  /** Whether PII was detected */
  detected: boolean
  /** Types of PII found */
  types: PIIType[]
  /** Original text */
  original: string
  /** Scrubbed text */
  scrubbed: string
  /** Detected PII entities */
  entities: PIIEntity[]
}

/**
 * PII entity information
 */
export interface PIIEntity {
  /** Type of PII */
  type: PIIType
  /** Original value */
  value: string
  /** Replacement value */
  replacement: string
  /** Start position in text */
  start: number
  /** End position in text */
  end: number
  /** Confidence score */
  confidence: number
}

/**
 * Types of PII that can be detected
 */
export type PIIType = 
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'name'
  | 'address'
  | 'date_of_birth'
  | 'passport'
  | 'driver_license'

/**
 * Content filtering result
 */
export interface ContentFilterResult {
  /** Whether content should be blocked */
  blocked: boolean
  /** Categories that triggered the filter */
  categories: ContentCategory[]
  /** Confidence scores for each category */
  scores: Record<ContentCategory, number>
  /** Overall risk score */
  riskScore: number
  /** Filtered/sanitized content */
  filtered?: string
}

/**
 * Content categories for filtering
 */
export type ContentCategory = 
  | 'hate_speech'
  | 'violence'
  | 'sexual_content'
  | 'harassment'
  | 'self_harm'
  | 'illegal_activity'
  | 'spam'
  | 'malware'
  | 'phishing'
  | 'misinformation'

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Prompt injection detection settings */
  promptInjection: {
    enabled: boolean
    strictMode: boolean
    customPatterns?: string[]
    threshold: number // 0-1, confidence threshold for detection
  }
  /** PII scrubbing settings */
  piiScrubbing: {
    enabled: boolean
    types: PIIType[]
    preserveFormat: boolean // Keep format (e.g., XXX-XX-1234 for SSN)
    customReplacements?: Record<PIIType, string>
  }
  /** Content filtering settings */
  contentFiltering: {
    enabled: boolean
    categories: ContentCategory[]
    threshold: number // 0-1, risk threshold for blocking
    strictMode: boolean
  }
  /** Audit logging */
  auditLogging: {
    enabled: boolean
    logLevel: 'basic' | 'detailed' | 'full'
    includeContent: boolean
  }
}

/**
 * Security audit log entry
 */
export interface SecurityAuditLog {
  /** Unique log entry ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Type of security event */
  type: 'prompt_injection' | 'pii_detected' | 'content_filtered' | 'rate_limit' | 'access_denied'
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** User/session identifier */
  userId?: string
  /** IP address */
  ipAddress?: string
  /** Details of the security event */
  details: any
  /** Action taken */
  action: 'allowed' | 'blocked' | 'sanitized' | 'logged'
}

/**
 * Main security manager interface
 */
export interface SecurityManager {
  /**
   * Check for prompt injection attacks
   */
  checkPromptInjection(input: string): Promise<PromptInjectionResult>
  
  /**
   * Detect and scrub PII from text
   */
  scrubPII(text: string): Promise<PIIResult>
  
  /**
   * Filter content for safety
   */
  filterContent(content: string): Promise<ContentFilterResult>
  
  /**
   * Comprehensive security check
   */
  securityCheck(input: string): Promise<{
    promptInjection: PromptInjectionResult
    pii: PIIResult
    contentFilter: ContentFilterResult
    safe: boolean
    sanitized: string
  }>
  
  /**
   * Update security configuration
   */
  updateConfig(config: Partial<SecurityConfig>): void
  
  /**
   * Get security audit logs
   */
  getAuditLogs(filters?: {
    startTime?: number
    endTime?: number
    type?: string
    severity?: string
    userId?: string
  }): SecurityAuditLog[]
  
  /**
   * Clear audit logs
   */
  clearAuditLogs(): void
}

/**
 * Default security manager implementation
 */
export class DefaultSecurityManager implements SecurityManager {
  private config: SecurityConfig
  private auditLogs: SecurityAuditLog[] = []
  
  // Prompt injection patterns
  private readonly injectionPatterns = {
    instruction_override: [
      /ignore\s+(?:previous|above|all)\s+(?:instructions?|prompts?|rules?)/i,
      /forget\s+(?:everything|all|previous|above)/i,
      /disregard\s+(?:previous|above|all)\s+(?:instructions?|prompts?|rules?)/i,
      /new\s+(?:instructions?|prompts?|rules?):/i,
      /system\s*:\s*(?:ignore|forget|disregard)/i
    ],
    role_manipulation: [
      /you\s+are\s+now\s+(?:a|an)\s+/i,
      /act\s+as\s+(?:a|an)\s+/i,
      /pretend\s+(?:to\s+be|you\s+are)\s+/i,
      /roleplay\s+as\s+/i,
      /simulate\s+(?:being|a|an)\s+/i
    ],
    system_bypass: [
      /\[SYSTEM\]/i,
      /\[ADMIN\]/i,
      /\[ROOT\]/i,
      /sudo\s+/i,
      /<\s*system\s*>/i,
      /override\s+safety/i
    ],
    data_extraction: [
      /show\s+me\s+your\s+(?:instructions?|prompts?|system)/i,
      /what\s+are\s+your\s+(?:instructions?|prompts?|rules?)/i,
      /reveal\s+your\s+(?:instructions?|prompts?|system)/i,
      /print\s+your\s+(?:instructions?|prompts?|system)/i
    ],
    jailbreak: [
      /DAN\s+mode/i,
      /developer\s+mode/i,
      /jailbreak/i,
      /unrestricted\s+mode/i,
      /bypass\s+(?:all\s+)?(?:restrictions?|limitations?|filters?)/i
    ]
  }

  // PII patterns
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    ssn: /\b(?:\d{3}-?\d{2}-?\d{4}|\d{9})\b/g,
    credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    name: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Simple name pattern
    date_of_birth: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b/g,
    passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
    driver_license: /\b[A-Z]{1,2}\d{6,8}\b/g
  }

  // Content filtering keywords
  private readonly contentFilters = {
    hate_speech: [
      'hate', 'racist', 'discrimination', 'bigot', 'supremacist'
    ],
    violence: [
      'kill', 'murder', 'assault', 'attack', 'violence', 'harm', 'hurt'
    ],
    sexual_content: [
      'explicit', 'sexual', 'pornographic', 'adult content'
    ],
    harassment: [
      'bully', 'harass', 'threaten', 'intimidate', 'stalk'
    ],
    self_harm: [
      'suicide', 'self-harm', 'cutting', 'overdose'
    ],
    illegal_activity: [
      'drugs', 'illegal', 'fraud', 'scam', 'piracy'
    ],
    spam: [
      'click here', 'free money', 'get rich quick', 'limited time'
    ],
    malware: [
      'virus', 'malware', 'trojan', 'keylogger', 'backdoor'
    ],
    phishing: [
      'verify account', 'click link', 'urgent action required'
    ],
    misinformation: [
      'fake news', 'conspiracy', 'hoax', 'debunked'
    ]
  }

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      promptInjection: {
        enabled: true,
        strictMode: false,
        threshold: 0.7,
        ...config?.promptInjection
      },
      piiScrubbing: {
        enabled: true,
        types: ['email', 'phone', 'ssn', 'credit_card'],
        preserveFormat: true,
        ...config?.piiScrubbing
      },
      contentFiltering: {
        enabled: true,
        categories: ['hate_speech', 'violence', 'harassment', 'illegal_activity'],
        threshold: 0.6,
        strictMode: false,
        ...config?.contentFiltering
      },
      auditLogging: {
        enabled: true,
        logLevel: 'basic',
        includeContent: false,
        ...config?.auditLogging
      }
    }
  }

  async checkPromptInjection(input: string): Promise<PromptInjectionResult> {
    if (!this.config.promptInjection.enabled) {
      return {
        detected: false,
        confidence: 0,
        patterns: [],
        riskLevel: 'low'
      }
    }

    const detectedPatterns: string[] = []
    let maxConfidence = 0
    let detectedType: PromptInjectionResult['type']

    // Check each category of injection patterns
    for (const [type, patterns] of Object.entries(this.injectionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          detectedPatterns.push(pattern.source)
          const confidence = this.calculateInjectionConfidence(input, pattern)
          if (confidence > maxConfidence) {
            maxConfidence = confidence
            detectedType = type as PromptInjectionResult['type']
          }
        }
      }
    }

    // Check custom patterns if provided
    if (this.config.promptInjection.customPatterns) {
      for (const customPattern of this.config.promptInjection.customPatterns) {
        const regex = new RegExp(customPattern, 'i')
        if (regex.test(input)) {
          detectedPatterns.push(customPattern)
          maxConfidence = Math.max(maxConfidence, 0.8)
        }
      }
    }

    const detected = maxConfidence >= this.config.promptInjection.threshold
    const riskLevel = this.calculateRiskLevel(maxConfidence)

    if (detected) {
      this.logSecurityEvent({
        type: 'prompt_injection',
        severity: riskLevel === 'critical' ? 'critical' : 'warning',
        details: {
          type: detectedType,
          confidence: maxConfidence,
          patterns: detectedPatterns
        },
        action: 'blocked'
      })
    }

    return {
      detected,
      confidence: maxConfidence,
      type: detectedType,
      patterns: detectedPatterns,
      sanitized: detected ? this.sanitizePromptInjection(input) : input,
      riskLevel
    }
  }

  async scrubPII(text: string): Promise<PIIResult> {
    if (!this.config.piiScrubbing.enabled) {
      return {
        detected: false,
        types: [],
        original: text,
        scrubbed: text,
        entities: []
      }
    }

    let scrubbed = text
    const entities: PIIEntity[] = []
    const detectedTypes: PIIType[] = []

    for (const type of this.config.piiScrubbing.types) {
      const pattern = this.piiPatterns[type]
      if (!pattern) continue

      const matches = Array.from(text.matchAll(pattern))
      
      for (const match of matches) {
        if (match.index === undefined) continue

        const value = match[0]
        const replacement = this.generatePIIReplacement(type, value)
        
        entities.push({
          type,
          value,
          replacement,
          start: match.index,
          end: match.index + value.length,
          confidence: this.calculatePIIConfidence(type, value)
        })

        scrubbed = scrubbed.replace(value, replacement)
        
        if (!detectedTypes.includes(type)) {
          detectedTypes.push(type)
        }
      }
    }

    const detected = entities.length > 0

    if (detected) {
      this.logSecurityEvent({
        type: 'pii_detected',
        severity: 'warning',
        details: {
          types: detectedTypes,
          count: entities.length
        },
        action: 'sanitized'
      })
    }

    return {
      detected,
      types: detectedTypes,
      original: text,
      scrubbed,
      entities
    }
  }

  async filterContent(content: string): Promise<ContentFilterResult> {
    if (!this.config.contentFiltering.enabled) {
      return {
        blocked: false,
        categories: [],
        scores: {} as Record<ContentCategory, number>,
        riskScore: 0
      }
    }

    const scores: Record<ContentCategory, number> = {} as Record<ContentCategory, number>
    const triggeredCategories: ContentCategory[] = []
    let maxScore = 0

    for (const category of this.config.contentFiltering.categories) {
      const keywords = this.contentFilters[category] || []
      let categoryScore = 0

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        const matches = content.match(regex)
        if (matches) {
          categoryScore += matches.length * 0.1
        }
      }

      categoryScore = Math.min(categoryScore, 1) // Cap at 1.0
      scores[category] = categoryScore

      if (categoryScore >= this.config.contentFiltering.threshold) {
        triggeredCategories.push(category)
        maxScore = Math.max(maxScore, categoryScore)
      }
    }

    const blocked = triggeredCategories.length > 0
    
    if (blocked) {
      this.logSecurityEvent({
        type: 'content_filtered',
        severity: maxScore > 0.8 ? 'error' : 'warning',
        details: {
          categories: triggeredCategories,
          riskScore: maxScore
        },
        action: 'blocked'
      })
    }

    return {
      blocked,
      categories: triggeredCategories,
      scores,
      riskScore: maxScore,
      filtered: blocked ? this.sanitizeContent(content, triggeredCategories) : content
    }
  }

  async securityCheck(input: string) {
    const [promptInjection, pii, contentFilter] = await Promise.all([
      this.checkPromptInjection(input),
      this.scrubPII(input),
      this.filterContent(input)
    ])

    const safe = !promptInjection.detected && !contentFilter.blocked
    let sanitized = input

    // Apply sanitizations in order
    if (pii.detected) {
      sanitized = pii.scrubbed
    }
    
    if (promptInjection.detected && promptInjection.sanitized) {
      sanitized = promptInjection.sanitized
    }
    
    if (contentFilter.blocked && contentFilter.filtered) {
      sanitized = contentFilter.filtered
    }

    return {
      promptInjection,
      pii,
      contentFilter,
      safe,
      sanitized
    }
  }

  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      promptInjection: { ...this.config.promptInjection, ...config.promptInjection },
      piiScrubbing: { ...this.config.piiScrubbing, ...config.piiScrubbing },
      contentFiltering: { ...this.config.contentFiltering, ...config.contentFiltering },
      auditLogging: { ...this.config.auditLogging, ...config.auditLogging }
    }
  }

  getAuditLogs(filters?: {
    startTime?: number
    endTime?: number
    type?: string
    severity?: string
    userId?: string
  }): SecurityAuditLog[] {
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
      if (filters.severity) {
        logs = logs.filter(log => log.severity === filters.severity)
      }
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId)
      }
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp)
  }

  clearAuditLogs(): void {
    this.auditLogs = []
  }

  private calculateInjectionConfidence(input: string, pattern: RegExp): number {
    const matches = input.match(pattern)
    if (!matches) return 0

    // Base confidence based on pattern match
    let confidence = 0.6

    // Increase confidence based on context
    if (input.toLowerCase().includes('system') || input.toLowerCase().includes('admin')) {
      confidence += 0.2
    }

    if (input.includes('ignore') || input.includes('forget') || input.includes('disregard')) {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  private calculatePIIConfidence(type: PIIType, value: string): number {
    // Simple confidence calculation based on pattern strength
    switch (type) {
      case 'email':
        return value.includes('@') && value.includes('.') ? 0.9 : 0.6
      case 'phone':
        return value.replace(/\D/g, '').length === 10 ? 0.9 : 0.7
      case 'ssn':
        return value.replace(/\D/g, '').length === 9 ? 0.95 : 0.7
      case 'credit_card':
        return this.isValidCreditCard(value) ? 0.9 : 0.6
      default:
        return 0.7
    }
  }

  private calculateRiskLevel(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.9) return 'critical'
    if (confidence >= 0.7) return 'high'
    if (confidence >= 0.5) return 'medium'
    return 'low'
  }

  private sanitizePromptInjection(input: string): string {
    let sanitized = input

    // Remove common injection patterns
    for (const patterns of Object.values(this.injectionPatterns)) {
      for (const pattern of patterns) {
        sanitized = sanitized.replace(pattern, '[FILTERED]')
      }
    }

    return sanitized
  }

  private generatePIIReplacement(type: PIIType, value: string): string {
    const customReplacement = this.config.piiScrubbing.customReplacements?.[type]
    if (customReplacement) return customReplacement

    if (this.config.piiScrubbing.preserveFormat) {
      switch (type) {
        case 'email':
          return '[EMAIL]@[DOMAIN]'
        case 'phone':
          return 'XXX-XXX-XXXX'
        case 'ssn':
          return 'XXX-XX-XXXX'
        case 'credit_card':
          return 'XXXX-XXXX-XXXX-XXXX'
        case 'ip_address':
          return 'XXX.XXX.XXX.XXX'
        default:
          return `[${type.toUpperCase()}]`
      }
    }

    return `[${type.toUpperCase()}]`
  }

  private sanitizeContent(content: string, categories: ContentCategory[]): string {
    let sanitized = content

    for (const category of categories) {
      const keywords = this.contentFilters[category] || []
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        sanitized = sanitized.replace(regex, '[FILTERED]')
      }
    }

    return sanitized
  }

  private isValidCreditCard(value: string): boolean {
    // Simple Luhn algorithm check
    const digits = value.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) return false

    let sum = 0
    let isEven = false

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i])

      if (isEven) {
        digit *= 2
        if (digit > 9) digit -= 9
      }

      sum += digit
      isEven = !isEven
    }

    return sum % 10 === 0
  }

  private logSecurityEvent(event: Omit<SecurityAuditLog, 'id' | 'timestamp'>): void {
    if (!this.config.auditLogging.enabled) return

    const logEntry: SecurityAuditLog = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...event
    }

    this.auditLogs.push(logEntry)

    // Keep only last 1000 logs to prevent memory issues
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000)
    }
  }
}

// Export singleton instance
export const securityManager = new DefaultSecurityManager()