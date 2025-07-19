import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  MemoryRateLimiter, 
  MemoryAPIKeyManager, 
  MemoryQuotaManager 
} from '../rate-limiting'
import type { 
  RateLimitConfig, 
  APIKey, 
  QuotaConfig, 
  APIKeyPermission 
} from '../rate-limiting'

describe('MemoryRateLimiter', () => {
  let rateLimiter: MemoryRateLimiter

  beforeEach(() => {
    rateLimiter = new MemoryRateLimiter()
  })

  afterEach(() => {
    rateLimiter.destroy()
  })

  describe('Fixed Window Rate Limiting', () => {
    const config: RateLimitConfig = {
      maxRequests: 5,
      windowMs: 60000, // 1 minute
      slidingWindow: false
    }

    it('should allow requests within limit', async () => {
      const identifier = 'user1'
      
      // First request should be allowed
      const result1 = await rateLimiter.checkLimit(identifier, config)
      expect(result1.allowed).toBe(true)
      expect(result1.currentCount).toBe(0)
      expect(result1.remaining).toBe(5)
      
      // Record the request
      await rateLimiter.recordRequest(identifier, config)
      
      // Check again
      const result2 = await rateLimiter.checkLimit(identifier, config)
      expect(result2.allowed).toBe(true)
      expect(result2.currentCount).toBe(1)
      expect(result2.remaining).toBe(4)
    })

    it('should block requests when limit exceeded', async () => {
      const identifier = 'user2'
      
      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        await rateLimiter.recordRequest(identifier, config)
      }
      
      // 6th request should be blocked
      const result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(false)
      expect(result.currentCount).toBe(5)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should reset window after time expires', async () => {
      const shortConfig: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 100, // 100ms
        slidingWindow: false
      }
      
      const identifier = 'user3'
      
      // Exhaust the limit
      await rateLimiter.recordRequest(identifier, shortConfig)
      await rateLimiter.recordRequest(identifier, shortConfig)
      
      let result = await rateLimiter.checkLimit(identifier, shortConfig)
      expect(result.allowed).toBe(false)
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 150))
      
      result = await rateLimiter.checkLimit(identifier, shortConfig)
      expect(result.allowed).toBe(true)
      expect(result.currentCount).toBe(0)
    })
  })

  describe('Sliding Window Rate Limiting', () => {
    const config: RateLimitConfig = {
      maxRequests: 3,
      windowMs: 1000, // 1 second
      slidingWindow: true
    }

    it('should allow requests within sliding window', async () => {
      const identifier = 'user4'
      
      // Make 3 requests quickly
      await rateLimiter.recordRequest(identifier, config)
      await rateLimiter.recordRequest(identifier, config)
      await rateLimiter.recordRequest(identifier, config)
      
      // Should be at limit
      let result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(false)
      
      // Wait for part of the window to pass
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Should still be blocked (requests still in window)
      result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(false)
      
      // Wait for full window to pass
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Should be allowed again
      result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(true)
    })

    it('should handle gradual request distribution', async () => {
      const identifier = 'user5'
      
      // Make requests with delays
      await rateLimiter.recordRequest(identifier, config)
      await new Promise(resolve => setTimeout(resolve, 400))
      
      await rateLimiter.recordRequest(identifier, config)
      await new Promise(resolve => setTimeout(resolve, 400))
      
      await rateLimiter.recordRequest(identifier, config)
      
      // Should be at limit
      let result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(false)
      
      // Wait for first request to fall out of window
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Should be allowed again
      result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Multiple Identifiers', () => {
    const config: RateLimitConfig = {
      maxRequests: 2,
      windowMs: 60000,
      slidingWindow: false
    }

    it('should handle different identifiers independently', async () => {
      // Exhaust limit for user1
      await rateLimiter.recordRequest('user1', config)
      await rateLimiter.recordRequest('user1', config)
      
      const result1 = await rateLimiter.checkLimit('user1', config)
      expect(result1.allowed).toBe(false)
      
      // user2 should still be allowed
      const result2 = await rateLimiter.checkLimit('user2', config)
      expect(result2.allowed).toBe(true)
    })
  })

  describe('Utility Methods', () => {
    it('should reset limits for identifier', async () => {
      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 60000,
        slidingWindow: false
      }
      
      const identifier = 'user6'
      
      // Exhaust limit
      await rateLimiter.recordRequest(identifier, config)
      let result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(false)
      
      // Reset limits
      await rateLimiter.resetLimits(identifier)
      
      // Should be allowed again
      result = await rateLimiter.checkLimit(identifier, config)
      expect(result.allowed).toBe(true)
    })

    it('should get current usage', async () => {
      const config: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60000,
        slidingWindow: false
      }
      
      const identifier = 'user7'
      
      expect(await rateLimiter.getUsage(identifier)).toBe(0)
      
      await rateLimiter.recordRequest(identifier, config)
      await rateLimiter.recordRequest(identifier, config)
      
      expect(await rateLimiter.getUsage(identifier)).toBe(2)
    })

    it('should cleanup expired entries', async () => {
      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 100,
        slidingWindow: false
      }
      
      await rateLimiter.recordRequest('temp_user', config)
      
      // Wait for entry to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Cleanup should remove expired entries
      await rateLimiter.cleanup()
      
      // This is more of an internal test - in practice we'd check memory usage
      expect(await rateLimiter.getUsage('temp_user')).toBe(0)
    })
  })
})

describe('MemoryAPIKeyManager', () => {
  let apiKeyManager: MemoryAPIKeyManager

  beforeEach(() => {
    apiKeyManager = new MemoryAPIKeyManager()
  })

  describe('API Key Creation', () => {
    it('should create a new API key', async () => {
      const userId = 'user1'
      const config = {
        name: 'Test Key',
        rateLimit: {
          maxRequests: 100,
          windowMs: 3600000
        },
        quota: {
          monthlyRequests: 10000,
          monthlyTokens: 1000000
        }
      }

      const key = await apiKeyManager.createKey(userId, config)
      
      expect(key.id).toMatch(/^key_/)
      expect(key.key).toMatch(/^ak_/)
      expect(key.name).toBe('Test Key')
      expect(key.userId).toBe(userId)
      expect(key.status).toBe('active')
      expect(key.rateLimit).toEqual(config.rateLimit)
      expect(key.quota).toEqual(config.quota)
      expect(key.metadata.createdAt).toBeGreaterThan(0)
    })

    it('should create key with default values', async () => {
      const key = await apiKeyManager.createKey('user2', {})
      
      expect(key.name).toBe('Unnamed Key')
      expect(key.rateLimit.maxRequests).toBe(100)
      expect(key.quota.monthlyRequests).toBe(10000)
      expect(key.permissions).toEqual([{ resource: '*', actions: ['*'] }])
    })
  })

  describe('API Key Validation', () => {
    it('should validate active API key', async () => {
      const userId = 'user3'
      const createdKey = await apiKeyManager.createKey(userId, { name: 'Valid Key' })
      
      const validatedKey = await apiKeyManager.validateKey(createdKey.key)
      
      expect(validatedKey).not.toBeNull()
      expect(validatedKey!.id).toBe(createdKey.id)
      expect(validatedKey!.metadata.lastUsedAt).toBeGreaterThan(0)
    })

    it('should reject invalid API key', async () => {
      const result = await apiKeyManager.validateKey('invalid_key')
      expect(result).toBeNull()
    })

    it('should reject revoked API key', async () => {
      const userId = 'user4'
      const createdKey = await apiKeyManager.createKey(userId, { name: 'Revoked Key' })
      
      // Revoke the key
      await apiKeyManager.revokeKey(createdKey.id)
      
      const result = await apiKeyManager.validateKey(createdKey.key)
      expect(result).toBeNull()
    })

    it('should reject expired API key', async () => {
      const userId = 'user5'
      const createdKey = await apiKeyManager.createKey(userId, {
        name: 'Expired Key',
        metadata: {
          expiresAt: Date.now() - 1000 // Expired 1 second ago
        }
      })
      
      const result = await apiKeyManager.validateKey(createdKey.key)
      expect(result).toBeNull()
    })
  })

  describe('API Key Management', () => {
    it('should update API key', async () => {
      const userId = 'user6'
      const createdKey = await apiKeyManager.createKey(userId, { name: 'Original Name' })
      
      const updatedKey = await apiKeyManager.updateKey(createdKey.id, {
        name: 'Updated Name',
        status: 'suspended'
      })
      
      expect(updatedKey.name).toBe('Updated Name')
      expect(updatedKey.status).toBe('suspended')
    })

    it('should list keys for user', async () => {
      const userId = 'user7'
      
      await apiKeyManager.createKey(userId, { name: 'Key 1' })
      await apiKeyManager.createKey(userId, { name: 'Key 2' })
      await apiKeyManager.createKey('other_user', { name: 'Other Key' })
      
      const userKeys = await apiKeyManager.listKeys(userId)
      
      expect(userKeys).toHaveLength(2)
      expect(userKeys.map(k => k.name)).toEqual(['Key 2', 'Key 1']) // Sorted by creation time desc
    })

    it('should handle non-existent key updates', async () => {
      await expect(apiKeyManager.updateKey('nonexistent', { name: 'New Name' }))
        .rejects.toThrow('API key nonexistent not found')
    })
  })

  describe('Usage Tracking', () => {
    it('should record and retrieve usage', async () => {
      const userId = 'user8'
      const createdKey = await apiKeyManager.createKey(userId, { name: 'Usage Key' })
      
      // Record some usage
      await apiKeyManager.recordUsage(createdKey.id, {
        resource: 'chat',
        action: 'completion',
        tokens: 100,
        cost: 50
      })
      
      await apiKeyManager.recordUsage(createdKey.id, {
        resource: 'embedding',
        action: 'generate',
        tokens: 50,
        cost: 25
      })
      
      const usage = await apiKeyManager.getKeyUsage(createdKey.id)
      
      expect(usage.current.requests).toBe(2)
      expect(usage.current.tokens).toBe(150)
      expect(usage.current.cost).toBe(75)
      expect(usage.breakdown['chat:completion']).toEqual({
        requests: 1,
        tokens: 100,
        cost: 50
      })
      expect(usage.breakdown['embedding:generate']).toEqual({
        requests: 1,
        tokens: 50,
        cost: 25
      })
    })

    it('should handle usage for non-existent key', async () => {
      // Should not throw error
      await apiKeyManager.recordUsage('nonexistent', {
        resource: 'test',
        action: 'test'
      })
    })

    it('should throw error for non-existent usage stats', async () => {
      await expect(apiKeyManager.getKeyUsage('nonexistent'))
        .rejects.toThrow('Usage stats for key nonexistent not found')
    })
  })
})

describe('MemoryQuotaManager', () => {
  let quotaManager: MemoryQuotaManager

  beforeEach(() => {
    quotaManager = new MemoryQuotaManager()
  })

  describe('Quota Management', () => {
    it('should check quota within limits', async () => {
      const identifier = 'user1'
      const quota: QuotaConfig = {
        monthlyRequests: 1000,
        monthlyTokens: 100000,
        monthlyCostLimit: 5000
      }
      
      quotaManager.setQuota(identifier, quota)
      
      const result = await quotaManager.checkQuota(identifier, {
        requests: 1,
        tokens: 100,
        cost: 50
      })
      
      expect(result.allowed).toBe(true)
      expect(result.remaining.requests).toBe(1000)
      expect(result.remaining.tokens).toBe(100000)
      expect(result.remaining.cost).toBe(5000)
    })

    it('should block when quota exceeded', async () => {
      const identifier = 'user2'
      const quota: QuotaConfig = {
        monthlyRequests: 5,
        monthlyTokens: 1000
      }
      
      quotaManager.setQuota(identifier, quota)
      
      // Use up most of the quota
      await quotaManager.recordUsage(identifier, {
        resource: 'test',
        requests: 4,
        tokens: 900
      })
      
      // This should exceed the request limit
      const result = await quotaManager.checkQuota(identifier, {
        requests: 2
      })
      
      expect(result.allowed).toBe(false)
      expect(result.remaining.requests).toBe(1)
    })

    it('should track usage correctly', async () => {
      const identifier = 'user3'
      const quota: QuotaConfig = {
        monthlyRequests: 1000,
        monthlyTokens: 100000
      }
      
      quotaManager.setQuota(identifier, quota)
      
      await quotaManager.recordUsage(identifier, {
        resource: 'chat',
        requests: 5,
        tokens: 500
      })
      
      await quotaManager.recordUsage(identifier, {
        resource: 'embedding',
        requests: 3,
        tokens: 300
      })
      
      const stats = await quotaManager.getUsageStats(identifier)
      
      expect(stats.current.requests).toBe(8)
      expect(stats.current.tokens).toBe(800)
      expect(stats.breakdown.chat).toEqual({
        requests: 5,
        tokens: 500,
        cost: 0
      })
      expect(stats.breakdown.embedding).toEqual({
        requests: 3,
        tokens: 300,
        cost: 0
      })
    })

    it('should reset quota', async () => {
      const identifier = 'user4'
      const quota: QuotaConfig = {
        monthlyRequests: 100
      }
      
      quotaManager.setQuota(identifier, quota)
      
      await quotaManager.recordUsage(identifier, {
        resource: 'test',
        requests: 50
      })
      
      let stats = await quotaManager.getUsageStats(identifier)
      expect(stats.current.requests).toBe(50)
      
      await quotaManager.resetQuota(identifier)
      
      stats = await quotaManager.getUsageStats(identifier)
      expect(stats.current.requests).toBe(0)
      expect(Object.keys(stats.breakdown)).toHaveLength(0)
    })

    it('should handle non-existent identifiers gracefully', async () => {
      const result = await quotaManager.checkQuota('nonexistent', {
        requests: 1
      })
      
      expect(result.allowed).toBe(true)
      expect(result.remaining).toEqual({})
    })

    it('should throw error for non-existent usage stats', async () => {
      await expect(quotaManager.getUsageStats('nonexistent'))
        .rejects.toThrow('Usage stats for nonexistent not found')
    })
  })

  describe('Complex Quota Scenarios', () => {
    it('should handle multiple quota types', async () => {
      const identifier = 'user5'
      const quota: QuotaConfig = {
        monthlyRequests: 100,
        monthlyTokens: 10000,
        monthlyCostLimit: 1000
      }
      
      quotaManager.setQuota(identifier, quota)
      
      // Use up tokens but not requests
      await quotaManager.recordUsage(identifier, {
        resource: 'test',
        requests: 10,
        tokens: 9500,
        cost: 500
      })
      
      // This should be blocked by token limit
      const result1 = await quotaManager.checkQuota(identifier, {
        requests: 1,
        tokens: 600
      })
      expect(result1.allowed).toBe(false)
      
      // This should be allowed (within token limit)
      const result2 = await quotaManager.checkQuota(identifier, {
        requests: 1,
        tokens: 400
      })
      expect(result2.allowed).toBe(true)
    })

    it('should calculate remaining quotas correctly', async () => {
      const identifier = 'user6'
      const quota: QuotaConfig = {
        monthlyRequests: 1000,
        monthlyTokens: 100000,
        monthlyCostLimit: 5000
      }
      
      quotaManager.setQuota(identifier, quota)
      
      await quotaManager.recordUsage(identifier, {
        resource: 'test',
        requests: 250,
        tokens: 25000,
        cost: 1250
      })
      
      const result = await quotaManager.checkQuota(identifier, {
        requests: 1,
        tokens: 100,
        cost: 50
      })
      
      expect(result.remaining.requests).toBe(750)
      expect(result.remaining.tokens).toBe(75000)
      expect(result.remaining.cost).toBe(3750)
    })
  })
})

describe('Integration Tests', () => {
  let rateLimiter: MemoryRateLimiter
  let apiKeyManager: MemoryAPIKeyManager
  let quotaManager: MemoryQuotaManager

  beforeEach(() => {
    rateLimiter = new MemoryRateLimiter()
    apiKeyManager = new MemoryAPIKeyManager()
    quotaManager = new MemoryQuotaManager()
  })

  afterEach(() => {
    rateLimiter.destroy()
  })

  it('should work together for complete rate limiting solution', async () => {
    const userId = 'integration_user'
    
    // Create API key with limits
    const apiKey = await apiKeyManager.createKey(userId, {
      name: 'Integration Test Key',
      rateLimit: {
        maxRequests: 5,
        windowMs: 60000
      },
      quota: {
        monthlyRequests: 100,
        monthlyTokens: 10000
      }
    })
    
    // Set quota in quota manager
    quotaManager.setQuota(apiKey.id, apiKey.quota)
    
    // Simulate API requests
    for (let i = 0; i < 3; i++) {
      // Check rate limit
      const rateLimitResult = await rateLimiter.checkLimit(apiKey.id, apiKey.rateLimit)
      expect(rateLimitResult.allowed).toBe(true)
      
      // Check quota
      const quotaResult = await quotaManager.checkQuota(apiKey.id, {
        requests: 1,
        tokens: 100
      })
      expect(quotaResult.allowed).toBe(true)
      
      // Record the request
      await rateLimiter.recordRequest(apiKey.id, apiKey.rateLimit)
      await quotaManager.recordUsage(apiKey.id, {
        resource: 'chat',
        requests: 1,
        tokens: 100
      })
      await apiKeyManager.recordUsage(apiKey.id, {
        resource: 'chat',
        action: 'completion',
        tokens: 100,
        cost: 50
      })
    }
    
    // Verify usage tracking
    const usage = await apiKeyManager.getKeyUsage(apiKey.id)
    expect(usage.current.requests).toBe(3)
    expect(usage.current.tokens).toBe(300)
    expect(usage.current.cost).toBe(150)
    
    const quotaStats = await quotaManager.getUsageStats(apiKey.id)
    expect(quotaStats.current.requests).toBe(3)
    expect(quotaStats.current.tokens).toBe(300)
  })

  it('should handle API key permissions', async () => {
    const permissions: APIKeyPermission[] = [
      {
        resource: 'chat',
        actions: ['read', 'write'],
        constraints: {
          maxTokens: 1000,
          models: ['gpt-3.5-turbo'],
          providers: ['openai']
        }
      },
      {
        resource: 'embedding',
        actions: ['read']
      }
    ]
    
    const apiKey = await apiKeyManager.createKey('user_with_permissions', {
      name: 'Restricted Key',
      permissions
    })
    
    expect(apiKey.permissions).toEqual(permissions)
    
    // In a real implementation, you'd check these permissions before allowing operations
    const chatPermission = apiKey.permissions.find(p => p.resource === 'chat')
    expect(chatPermission?.actions).toContain('write')
    expect(chatPermission?.constraints?.maxTokens).toBe(1000)
  })
})