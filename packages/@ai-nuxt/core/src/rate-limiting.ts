/**
 * Rate limiting and API key management for AI Nuxt
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Burst allowance (requests that can exceed the limit temporarily) */
  burstAllowance?: number
  /** Whether to use sliding window (true) or fixed window (false) */
  slidingWindow?: boolean
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Current request count in the window */
  currentCount: number
  /** Maximum allowed requests */
  limit: number
  /** Time until window resets (ms) */
  resetTime: number
  /** Remaining requests in current window */
  remaining: number
  /** Retry after time in seconds (if blocked) */
  retryAfter?: number
}

/**
 * API key information
 */
export interface APIKey {
  /** Unique API key identifier */
  id: string
  /** The actual API key */
  key: string
  /** Human-readable name */
  name: string
  /** User ID this key belongs to */
  userId: string
  /** Key status */
  status: 'active' | 'suspended' | 'revoked'
  /** Rate limit configuration for this key */
  rateLimit: RateLimitConfig
  /** Quota configuration */
  quota: QuotaConfig
  /** Key permissions */
  permissions: APIKeyPermission[]
  /** Key metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: number
    /** Last used timestamp */
    lastUsedAt?: number
    /** Expiration timestamp (optional) */
    expiresAt?: number
    /** IP address restrictions */
    allowedIPs?: string[]
    /** Referrer restrictions */
    allowedReferrers?: string[]
  }
}

/**
 * API key permissions
 */
export interface APIKeyPermission {
  /** Resource type */
  resource: 'chat' | 'completion' | 'embedding' | 'agent' | 'tool' | '*'
  /** Allowed actions */
  actions: ('read' | 'write' | 'execute' | '*')[]
  /** Additional constraints */
  constraints?: {
    /** Maximum tokens per request */
    maxTokens?: number
    /** Allowed models */
    models?: string[]
    /** Allowed providers */
    providers?: string[]
  }
}

/**
 * Quota configuration
 */
export interface QuotaConfig {
  /** Monthly request limit */
  monthlyRequests?: number
  /** Monthly token limit */
  monthlyTokens?: number
  /** Daily request limit */
  dailyRequests?: number
  /** Daily token limit */
  dailyTokens?: number
  /** Cost limit in cents */
  monthlyCostLimit?: number
  /** Reset day of month (1-31) */
  resetDay?: number
}

/**
 * Usage tracking information
 */
export interface UsageStats {
  /** API key or user ID */
  id: string
  /** Current period usage */
  current: {
    /** Requests made */
    requests: number
    /** Tokens used */
    tokens: number
    /** Cost in cents */
    cost: number
    /** Period start time */
    periodStart: number
    /** Period end time */
    periodEnd: number
  }
  /** Historical usage */
  history: UsagePeriod[]
  /** Quota limits */
  limits: QuotaConfig
  /** Usage by resource type */
  breakdown: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
}

/**
 * Usage period data
 */
export interface UsagePeriod {
  /** Period start time */
  start: number
  /** Period end time */
  end: number
  /** Requests in period */
  requests: number
  /** Tokens in period */
  tokens: number
  /** Cost in period */
  cost: number
  /** Period type */
  type: 'hour' | 'day' | 'month'
}

/**
 * Rate limit violation information
 */
export interface RateLimitViolation {
  /** Violation ID */
  id: string
  /** API key or user ID */
  identifier: string
  /** Violation type */
  type: 'rate_limit' | 'quota_exceeded' | 'permission_denied'
  /** Timestamp */
  timestamp: number
  /** Request details */
  request: {
    /** Resource accessed */
    resource: string
    /** Action attempted */
    action: string
    /** IP address */
    ip?: string
    /** User agent */
    userAgent?: string
  }
  /** Current limits */
  limits: {
    /** Current count */
    current: number
    /** Maximum allowed */
    max: number
    /** Window or period */
    window: number
  }
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /**
   * Check if request is allowed
   */
  checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult>
  
  /**
   * Record a request
   */
  recordRequest(identifier: string, config: RateLimitConfig): Promise<void>
  
  /**
   * Reset limits for identifier
   */
  resetLimits(identifier: string): Promise<void>
  
  /**
   * Get current usage
   */
  getUsage(identifier: string): Promise<number>
  
  /**
   * Clean up expired entries
   */
  cleanup(): Promise<void>
}

/**
 * API key manager interface
 */
export interface APIKeyManager {
  /**
   * Create a new API key
   */
  createKey(userId: string, config: Partial<APIKey>): Promise<APIKey>
  
  /**
   * Validate an API key
   */
  validateKey(key: string): Promise<APIKey | null>
  
  /**
   * Update API key configuration
   */
  updateKey(keyId: string, updates: Partial<APIKey>): Promise<APIKey>
  
  /**
   * Revoke an API key
   */
  revokeKey(keyId: string): Promise<void>
  
  /**
   * List API keys for a user
   */
  listKeys(userId: string): Promise<APIKey[]>
  
  /**
   * Get API key usage stats
   */
  getKeyUsage(keyId: string): Promise<UsageStats>
  
  /**
   * Record API key usage
   */
  recordUsage(keyId: string, usage: {
    resource: string
    action: string
    tokens?: number
    cost?: number
  }): Promise<void>
}

/**
 * Quota manager interface
 */
export interface QuotaManager {
  /**
   * Check if usage is within quota
   */
  checkQuota(identifier: string, usage: {
    requests?: number
    tokens?: number
    cost?: number
  }): Promise<{
    allowed: boolean
    remaining: {
      requests?: number
      tokens?: number
      cost?: number
    }
    resetTime: number
  }>
  
  /**
   * Record usage against quota
   */
  recordUsage(identifier: string, usage: {
    resource: string
    requests?: number
    tokens?: number
    cost?: number
  }): Promise<void>
  
  /**
   * Get usage statistics
   */
  getUsageStats(identifier: string): Promise<UsageStats>
  
  /**
   * Reset quota for identifier
   */
  resetQuota(identifier: string): Promise<void>
}

/**
 * In-memory rate limiter implementation
 */
export class MemoryRateLimiter implements RateLimiter {
  private requests: Map<string, { count: number; windowStart: number; requests: number[] }> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  async checkLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.requests.get(identifier)

    if (!entry) {
      return {
        allowed: true,
        currentCount: 0,
        limit: config.maxRequests,
        resetTime: now + config.windowMs,
        remaining: config.maxRequests
      }
    }

    if (config.slidingWindow) {
      return this.checkSlidingWindow(identifier, config, now)
    } else {
      return this.checkFixedWindow(identifier, config, now)
    }
  }

  async recordRequest(identifier: string, config: RateLimitConfig): Promise<void> {
    const now = Date.now()
    const entry = this.requests.get(identifier) || {
      count: 0,
      windowStart: now,
      requests: []
    }

    if (config.slidingWindow) {
      entry.requests.push(now)
      // Keep only requests within the window
      entry.requests = entry.requests.filter(time => now - time < config.windowMs)
      entry.count = entry.requests.length
    } else {
      // Fixed window
      if (now - entry.windowStart >= config.windowMs) {
        entry.count = 1
        entry.windowStart = now
        entry.requests = [now]
      } else {
        entry.count++
        entry.requests.push(now)
      }
    }

    this.requests.set(identifier, entry)
  }

  async resetLimits(identifier: string): Promise<void> {
    this.requests.delete(identifier)
  }

  async getUsage(identifier: string): Promise<number> {
    const entry = this.requests.get(identifier)
    return entry?.count || 0
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.requests.entries()) {
      // Remove entries older than 1 hour
      if (now - entry.windowStart > 3600000) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.requests.delete(key)
    }
  }

  private checkSlidingWindow(identifier: string, config: RateLimitConfig, now: number): RateLimitResult {
    const entry = this.requests.get(identifier)!
    
    // Filter requests within the sliding window
    const validRequests = entry.requests.filter(time => now - time < config.windowMs)
    const currentCount = validRequests.length

    const allowed = currentCount < config.maxRequests
    const oldestRequest = validRequests[0]
    const resetTime = oldestRequest ? oldestRequest + config.windowMs : now + config.windowMs

    return {
      allowed,
      currentCount,
      limit: config.maxRequests,
      resetTime,
      remaining: Math.max(0, config.maxRequests - currentCount),
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    }
  }

  private checkFixedWindow(identifier: string, config: RateLimitConfig, now: number): RateLimitResult {
    const entry = this.requests.get(identifier)!
    
    // Check if we're in a new window
    if (now - entry.windowStart >= config.windowMs) {
      return {
        allowed: true,
        currentCount: 0,
        limit: config.maxRequests,
        resetTime: now + config.windowMs,
        remaining: config.maxRequests
      }
    }

    const allowed = entry.count < config.maxRequests
    const resetTime = entry.windowStart + config.windowMs

    return {
      allowed,
      currentCount: entry.count,
      limit: config.maxRequests,
      resetTime,
      remaining: Math.max(0, config.maxRequests - entry.count),
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

/**
 * In-memory API key manager implementation
 */
export class MemoryAPIKeyManager implements APIKeyManager {
  private keys: Map<string, APIKey> = new Map()
  private keysByUserId: Map<string, Set<string>> = new Map()
  private usage: Map<string, UsageStats> = new Map()

  async createKey(userId: string, config: Partial<APIKey>): Promise<APIKey> {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const apiKey = `ak_${Math.random().toString(36).substr(2, 32)}`

    const key: APIKey = {
      id: keyId,
      key: apiKey,
      name: config.name || 'Unnamed Key',
      userId,
      status: 'active',
      rateLimit: config.rateLimit || {
        maxRequests: 100,
        windowMs: 3600000 // 1 hour
      },
      quota: config.quota || {
        monthlyRequests: 10000,
        monthlyTokens: 1000000
      },
      permissions: config.permissions || [
        { resource: '*', actions: ['*'] }
      ],
      metadata: {
        createdAt: Date.now(),
        ...config.metadata
      }
    }

    this.keys.set(keyId, key)
    
    // Update user key index
    const userKeys = this.keysByUserId.get(userId) || new Set()
    userKeys.add(keyId)
    this.keysByUserId.set(userId, userKeys)

    // Initialize usage stats
    this.initializeUsageStats(keyId, key.quota)

    return key
  }

  async validateKey(key: string): Promise<APIKey | null> {
    for (const apiKey of this.keys.values()) {
      if (apiKey.key === key) {
        if (apiKey.status !== 'active') {
          return null
        }

        // Check expiration
        if (apiKey.metadata.expiresAt && Date.now() > apiKey.metadata.expiresAt) {
          return null
        }

        // Update last used timestamp
        apiKey.metadata.lastUsedAt = Date.now()
        return apiKey
      }
    }
    return null
  }

  async updateKey(keyId: string, updates: Partial<APIKey>): Promise<APIKey> {
    const key = this.keys.get(keyId)
    if (!key) {
      throw new Error(`API key ${keyId} not found`)
    }

    const updatedKey = { ...key, ...updates }
    this.keys.set(keyId, updatedKey)
    return updatedKey
  }

  async revokeKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId)
    if (key) {
      key.status = 'revoked'
      this.keys.set(keyId, key)
    }
  }

  async listKeys(userId: string): Promise<APIKey[]> {
    const userKeyIds = this.keysByUserId.get(userId) || new Set()
    const keys: APIKey[] = []

    for (const keyId of userKeyIds) {
      const key = this.keys.get(keyId)
      if (key) {
        keys.push(key)
      }
    }

    return keys.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)
  }

  async getKeyUsage(keyId: string): Promise<UsageStats> {
    const stats = this.usage.get(keyId)
    if (!stats) {
      throw new Error(`Usage stats for key ${keyId} not found`)
    }
    return stats
  }

  async recordUsage(keyId: string, usage: {
    resource: string
    action: string
    tokens?: number
    cost?: number
  }): Promise<void> {
    const stats = this.usage.get(keyId)
    if (!stats) {
      return
    }

    const now = Date.now()
    
    // Update current period
    stats.current.requests++
    if (usage.tokens) stats.current.tokens += usage.tokens
    if (usage.cost) stats.current.cost += usage.cost

    // Update breakdown
    const resourceKey = `${usage.resource}:${usage.action}`
    if (!stats.breakdown[resourceKey]) {
      stats.breakdown[resourceKey] = { requests: 0, tokens: 0, cost: 0 }
    }
    
    stats.breakdown[resourceKey].requests++
    if (usage.tokens) stats.breakdown[resourceKey].tokens += usage.tokens
    if (usage.cost) stats.breakdown[resourceKey].cost += usage.cost

    // Check if we need to start a new period
    if (now > stats.current.periodEnd) {
      this.rotatePeriod(stats, now)
    }

    this.usage.set(keyId, stats)
  }

  private initializeUsageStats(keyId: string, quota: QuotaConfig): void {
    const now = Date.now()
    const monthStart = new Date(now)
    monthStart.setDate(quota.resetDay || 1)
    monthStart.setHours(0, 0, 0, 0)
    
    if (monthStart.getTime() > now) {
      monthStart.setMonth(monthStart.getMonth() - 1)
    }

    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const stats: UsageStats = {
      id: keyId,
      current: {
        requests: 0,
        tokens: 0,
        cost: 0,
        periodStart: monthStart.getTime(),
        periodEnd: monthEnd.getTime()
      },
      history: [],
      limits: quota,
      breakdown: {}
    }

    this.usage.set(keyId, stats)
  }

  private rotatePeriod(stats: UsageStats, now: number): void {
    // Move current period to history
    stats.history.push({
      start: stats.current.periodStart,
      end: stats.current.periodEnd,
      requests: stats.current.requests,
      tokens: stats.current.tokens,
      cost: stats.current.cost,
      type: 'month'
    })

    // Keep only last 12 months of history
    if (stats.history.length > 12) {
      stats.history = stats.history.slice(-12)
    }

    // Start new period
    const nextPeriodEnd = new Date(stats.current.periodEnd)
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)

    stats.current = {
      requests: 0,
      tokens: 0,
      cost: 0,
      periodStart: stats.current.periodEnd,
      periodEnd: nextPeriodEnd.getTime()
    }

    // Reset breakdown
    stats.breakdown = {}
  }
}

/**
 * In-memory quota manager implementation
 */
export class MemoryQuotaManager implements QuotaManager {
  private quotas: Map<string, QuotaConfig> = new Map()
  private usage: Map<string, UsageStats> = new Map()

  async checkQuota(identifier: string, usage: {
    requests?: number
    tokens?: number
    cost?: number
  }): Promise<{
    allowed: boolean
    remaining: { requests?: number; tokens?: number; cost?: number }
    resetTime: number
  }> {
    const stats = this.usage.get(identifier)
    const quota = this.quotas.get(identifier)

    if (!stats || !quota) {
      return {
        allowed: true,
        remaining: {},
        resetTime: Date.now() + 86400000 // 24 hours
      }
    }

    const allowed = this.isWithinQuota(stats, quota, usage)
    const remaining = this.calculateRemaining(stats, quota)

    return {
      allowed,
      remaining,
      resetTime: stats.current.periodEnd
    }
  }

  async recordUsage(identifier: string, usage: {
    resource: string
    requests?: number
    tokens?: number
    cost?: number
  }): Promise<void> {
    const stats = this.usage.get(identifier)
    if (!stats) return

    stats.current.requests += usage.requests || 1
    if (usage.tokens) stats.current.tokens += usage.tokens
    if (usage.cost) stats.current.cost += usage.cost

    // Update breakdown
    if (!stats.breakdown[usage.resource]) {
      stats.breakdown[usage.resource] = { requests: 0, tokens: 0, cost: 0 }
    }
    
    stats.breakdown[usage.resource].requests += usage.requests || 1
    if (usage.tokens) stats.breakdown[usage.resource].tokens += usage.tokens
    if (usage.cost) stats.breakdown[usage.resource].cost += usage.cost

    this.usage.set(identifier, stats)
  }

  async getUsageStats(identifier: string): Promise<UsageStats> {
    const stats = this.usage.get(identifier)
    if (!stats) {
      throw new Error(`Usage stats for ${identifier} not found`)
    }
    return stats
  }

  async resetQuota(identifier: string): Promise<void> {
    const stats = this.usage.get(identifier)
    if (stats) {
      stats.current.requests = 0
      stats.current.tokens = 0
      stats.current.cost = 0
      stats.breakdown = {}
      this.usage.set(identifier, stats)
    }
  }

  setQuota(identifier: string, quota: QuotaConfig): void {
    this.quotas.set(identifier, quota)
    
    if (!this.usage.has(identifier)) {
      this.initializeUsageStats(identifier, quota)
    }
  }

  private isWithinQuota(stats: UsageStats, quota: QuotaConfig, newUsage: {
    requests?: number
    tokens?: number
    cost?: number
  }): boolean {
    const totalRequests = stats.current.requests + (newUsage.requests || 1)
    const totalTokens = stats.current.tokens + (newUsage.tokens || 0)
    const totalCost = stats.current.cost + (newUsage.cost || 0)

    if (quota.monthlyRequests && totalRequests > quota.monthlyRequests) return false
    if (quota.monthlyTokens && totalTokens > quota.monthlyTokens) return false
    if (quota.monthlyCostLimit && totalCost > quota.monthlyCostLimit) return false

    return true
  }

  private calculateRemaining(stats: UsageStats, quota: QuotaConfig): {
    requests?: number
    tokens?: number
    cost?: number
  } {
    const remaining: any = {}

    if (quota.monthlyRequests) {
      remaining.requests = Math.max(0, quota.monthlyRequests - stats.current.requests)
    }
    
    if (quota.monthlyTokens) {
      remaining.tokens = Math.max(0, quota.monthlyTokens - stats.current.tokens)
    }
    
    if (quota.monthlyCostLimit) {
      remaining.cost = Math.max(0, quota.monthlyCostLimit - stats.current.cost)
    }

    return remaining
  }

  private initializeUsageStats(identifier: string, quota: QuotaConfig): void {
    const now = Date.now()
    const monthStart = new Date(now)
    monthStart.setDate(quota.resetDay || 1)
    monthStart.setHours(0, 0, 0, 0)
    
    if (monthStart.getTime() > now) {
      monthStart.setMonth(monthStart.getMonth() - 1)
    }

    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const stats: UsageStats = {
      id: identifier,
      current: {
        requests: 0,
        tokens: 0,
        cost: 0,
        periodStart: monthStart.getTime(),
        periodEnd: monthEnd.getTime()
      },
      history: [],
      limits: quota,
      breakdown: {}
    }

    this.usage.set(identifier, stats)
  }
}

// Export singleton instances
export const rateLimiter = new MemoryRateLimiter()
export const apiKeyManager = new MemoryAPIKeyManager()
export const quotaManager = new MemoryQuotaManager()