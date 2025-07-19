/**
 * End-to-end tests for compliance and audit logging integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Page } from 'playwright'
import { 
  setupTestPage, 
  cleanupTestPage, 
  testUtils,
  type E2ETestContext 
} from './setup'

describe('Compliance Integration E2E Tests', () => {
  let context: E2ETestContext
  let page: Page

  beforeEach(async () => {
    context = await setupTestPage()
    page = context.page
  })

  afterEach(async () => {
    await cleanupTestPage(context)
  })

  describe('Data Subject Rights', () => {
    it('should handle data access requests', async () => {
      // Mock compliance API
      await page.route('**/api/compliance/data-subject', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() || '{}')
        
        if (body.type === 'access') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              requestId: 'req-123',
              status: 'completed',
              message: 'Access request processed successfully'
            })
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/privacy/data-request')
      
      // Fill out data access request form
      await page.selectOption('[data-testid="request-type"]', 'access')
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.fill('[data-testid="details"]', 'I want to see all my personal data')
      await page.click('[data-testid="submit-request"]')
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="request-id"]')).toContainText('req-123')
    })

    it('should handle data deletion requests', async () => {
      await page.route('**/api/compliance/data-subject', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() || '{}')
        
        if (body.type === 'delete') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              requestId: 'req-456',
              status: 'pending',
              message: 'Delete request submitted successfully. Verification required before processing.'
            })
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/privacy/data-request')
      
      // Fill out data deletion request form
      await page.selectOption('[data-testid="request-type"]', 'delete')
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.fill('[data-testid="details"]', 'Please delete all my personal data')
      await page.click('[data-testid="submit-request"]')
      
      // Should show pending status
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="status"]')).toContainText('pending')
      await expect(page.locator('[data-testid="verification-notice"]')).toBeVisible()
    })

    it('should handle data portability requests', async () => {
      await page.route('**/api/compliance/data-subject', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() || '{}')
        
        if (body.type === 'portability') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              requestId: 'req-789',
              status: 'completed',
              message: 'Data export completed successfully',
              downloadUrl: '/api/compliance/export/req-789'
            })
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/privacy/data-request')
      
      // Fill out data portability request form
      await page.selectOption('[data-testid="request-type"]', 'portability')
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.fill('[data-testid="details"]', 'I want to export my data')
      await page.click('[data-testid="submit-request"]')
      
      // Should show download link
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="download-link"]')).toBeVisible()
    })

    it('should validate request form inputs', async () => {
      await page.goto('/privacy/data-request')
      
      // Try to submit without required fields
      await page.click('[data-testid="submit-request"]')
      
      // Should show validation errors
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    })
  })

  describe('Compliance Dashboard', () => {
    it('should display compliance summary', async () => {
      // Mock compliance summary API
      await page.route('**/api/compliance/summary**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subject: {
              id: 'user-123',
              email: 'test@example.com'
            },
            summary: {
              personalDataRecords: 15,
              dataTypes: ['prompt', 'response', 'conversation'],
              oldestRecord: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              newestRecord: new Date().toISOString(),
              totalRetentionPeriod: 365,
              consentStatus: 'given',
              privacyRequests: 2
            }
          })
        })
      })

      await page.goto('/privacy/dashboard?email=test@example.com')
      
      // Should display summary information
      await expect(page.locator('[data-testid="personal-data-count"]')).toContainText('15')
      await expect(page.locator('[data-testid="data-types"]')).toContainText('prompt')
      await expect(page.locator('[data-testid="data-types"]')).toContainText('response')
      await expect(page.locator('[data-testid="data-types"]')).toContainText('conversation')
      await expect(page.locator('[data-testid="consent-status"]')).toContainText('given')
      await expect(page.locator('[data-testid="privacy-requests"]')).toContainText('2')
      await expect(page.locator('[data-testid="retention-period"]')).toContainText('365')
    })

    it('should handle empty compliance data', async () => {
      await page.route('**/api/compliance/summary**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subject: {
              id: 'new-user',
              email: 'new@example.com'
            },
            summary: {
              personalDataRecords: 0,
              dataTypes: [],
              oldestRecord: null,
              newestRecord: null,
              totalRetentionPeriod: 0,
              consentStatus: 'unknown',
              privacyRequests: 0
            }
          })
        })
      })

      await page.goto('/privacy/dashboard?email=new@example.com')
      
      // Should display empty state
      await expect(page.locator('[data-testid="no-data-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="personal-data-count"]')).toContainText('0')
      await expect(page.locator('[data-testid="consent-status"]')).toContainText('unknown')
    })

    it('should allow filtering by different identifiers', async () => {
      await page.goto('/privacy/dashboard')
      
      // Test email filter
      await page.fill('[data-testid="email-filter"]', 'test@example.com')
      await page.click('[data-testid="search-button"]')
      
      // Should update URL with email parameter
      expect(page.url()).toContain('email=test@example.com')
      
      // Test user ID filter
      await page.fill('[data-testid="user-id-filter"]', 'user-123')
      await page.click('[data-testid="search-button"]')
      
      // Should update URL with userId parameter
      expect(page.url()).toContain('userId=user-123')
    })
  })

  describe('Automatic Data Tracking', () => {
    it('should track AI chat interactions', async () => {
      let complianceRequests: any[] = []
      
      // Capture compliance tracking requests
      await page.route('**/api/compliance/**', async (route) => {
        const request = route.request()
        complianceRequests.push({
          url: request.url(),
          method: request.method(),
          body: request.postData()
        })
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })

      // Mock AI chat response
      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'Hello! How can I help you today?'
      })

      await page.goto('/chat')
      
      // Send a chat message
      await testUtils.sendChatMessage(page, 'Hello, I need help with my project')
      await testUtils.waitForAIResponse(page)
      
      // Should have tracked the interaction
      expect(complianceRequests.length).toBeGreaterThan(0)
      
      // Check if prompt was tracked
      const promptTracking = complianceRequests.find(req => 
        req.body && req.body.includes('prompt')
      )
      expect(promptTracking).toBeDefined()
    })

    it('should detect PII in conversations', async () => {
      let piiDetected = false
      
      await page.route('**/api/compliance/**', async (route) => {
        const request = route.request()
        const body = request.postData()
        
        if (body && body.includes('piiDetected')) {
          piiDetected = true
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })

      await testUtils.mockAIProvider(page, 'openai', {
        chat: 'I understand you want to share your contact information.'
      })

      await page.goto('/chat')
      
      // Send message with PII
      await testUtils.sendChatMessage(page, 'My email is john.doe@example.com and my phone is 555-123-4567')
      await testUtils.waitForAIResponse(page)
      
      // Should have detected PII
      expect(piiDetected).toBe(true)
    })

    it('should track vector store operations', async () => {
      let vectorOperationTracked = false
      
      await page.route('**/api/compliance/**', async (route) => {
        const request = route.request()
        const body = request.postData()
        
        if (body && body.includes('embedding')) {
          vectorOperationTracked = true
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        })
      })

      await page.goto('/rag')
      
      // Mock embedding generation
      await page.route('**/api/ai/embedding', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
            usage: { promptTokens: 5, totalTokens: 5 }
          })
        })
      })
      
      // Add a document to vector store
      await page.fill('[data-testid="document-input"]', 'This document contains user preferences and settings')
      await page.click('[data-testid="add-document"]')
      
      // Should have tracked the embedding operation
      expect(vectorOperationTracked).toBe(true)
    })
  })

  describe('Consent Management', () => {
    it('should record user consent', async () => {
      let consentRecorded = false
      
      await page.route('**/api/compliance/consent', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() || '{}')
        
        if (body.action === 'record' && body.scope.includes('data_processing')) {
          consentRecorded = true
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentId: 'consent-123'
          })
        })
      })

      await page.goto('/privacy/consent')
      
      // Give consent for data processing
      await page.check('[data-testid="consent-data-processing"]')
      await page.check('[data-testid="consent-analytics"]')
      await page.click('[data-testid="save-consent"]')
      
      // Should have recorded consent
      expect(consentRecorded).toBe(true)
      
      // Should show success message
      await expect(page.locator('[data-testid="consent-saved"]')).toBeVisible()
    })

    it('should withdraw user consent', async () => {
      let consentWithdrawn = false
      
      await page.route('**/api/compliance/consent', async (route) => {
        const request = route.request()
        const body = JSON.parse(request.postData() || '{}')
        
        if (body.action === 'withdraw') {
          consentWithdrawn = true
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Consent withdrawn successfully'
          })
        })
      })

      await page.goto('/privacy/consent')
      
      // Withdraw consent
      await page.uncheck('[data-testid="consent-data-processing"]')
      await page.click('[data-testid="save-consent"]')
      
      // Should have withdrawn consent
      expect(consentWithdrawn).toBe(true)
      
      // Should show withdrawal confirmation
      await expect(page.locator('[data-testid="consent-withdrawn"]')).toBeVisible()
    })

    it('should display current consent status', async () => {
      await page.route('**/api/compliance/consent/status**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consents: [
              {
                id: 'consent-1',
                scope: ['data_processing', 'analytics'],
                status: 'given',
                givenAt: Date.now() - 86400000, // 1 day ago
                method: 'explicit'
              }
            ]
          })
        })
      })

      await page.goto('/privacy/consent')
      
      // Should display current consent status
      await expect(page.locator('[data-testid="consent-data-processing"]')).toBeChecked()
      await expect(page.locator('[data-testid="consent-analytics"]')).toBeChecked()
      await expect(page.locator('[data-testid="consent-date"]')).toBeVisible()
    })
  })

  describe('Audit Logging', () => {
    it('should display audit logs', async () => {
      await page.route('**/api/compliance/audit-logs**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            logs: [
              {
                id: 'log-1',
                timestamp: Date.now() - 3600000, // 1 hour ago
                type: 'data_access',
                activity: 'Personal data accessed',
                result: 'success',
                details: { recordCount: 5 }
              },
              {
                id: 'log-2',
                timestamp: Date.now() - 7200000, // 2 hours ago
                type: 'privacy_request',
                activity: 'Access request processed',
                result: 'success',
                details: { requestType: 'access' }
              },
              {
                id: 'log-3',
                timestamp: Date.now() - 10800000, // 3 hours ago
                type: 'consent_given',
                activity: 'Consent recorded for data processing',
                result: 'success',
                details: { scope: ['data_processing'] }
              }
            ]
          })
        })
      })

      await page.goto('/privacy/audit-logs?email=test@example.com')
      
      // Should display audit logs
      await expect(page.locator('[data-testid="audit-log"]')).toHaveCount(3)
      
      // Check log content
      await expect(page.locator('[data-testid="audit-log"]').first()).toContainText('data_access')
      await expect(page.locator('[data-testid="audit-log"]').first()).toContainText('Personal data accessed')
      await expect(page.locator('[data-testid="audit-log"]').first()).toContainText('success')
    })

    it('should filter audit logs by type', async () => {
      await page.goto('/privacy/audit-logs?email=test@example.com')
      
      // Filter by privacy requests
      await page.selectOption('[data-testid="log-type-filter"]', 'privacy_request')
      await page.click('[data-testid="apply-filter"]')
      
      // Should update URL with filter
      expect(page.url()).toContain('type=privacy_request')
      
      // Should show filtered results
      await expect(page.locator('[data-testid="audit-log"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="audit-log"]').first()).toContainText('privacy_request')
    })

    it('should filter audit logs by date range', async () => {
      await page.goto('/privacy/audit-logs?email=test@example.com')
      
      // Set date range filter
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      
      await page.fill('[data-testid="start-date"]', yesterday)
      await page.fill('[data-testid="end-date"]', today)
      await page.click('[data-testid="apply-filter"]')
      
      // Should update URL with date filters
      expect(page.url()).toContain('startDate=')
      expect(page.url()).toContain('endDate=')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      await page.route('**/api/compliance/data-subject', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error'
          })
        })
      })

      await page.goto('/privacy/data-request')
      
      await page.selectOption('[data-testid="request-type"]', 'access')
      await page.fill('[data-testid="email"]', 'test@example.com')
      await page.click('[data-testid="submit-request"]')
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('server error')
    })

    it('should handle network failures', async () => {
      await page.route('**/api/compliance/**', async (route) => {
        await route.abort('failed')
      })

      await page.goto('/privacy/dashboard?email=test@example.com')
      
      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible()
    })

    it('should validate required fields', async () => {
      await page.goto('/privacy/data-request')
      
      // Try to submit without email
      await page.selectOption('[data-testid="request-type"]', 'access')
      await page.click('[data-testid="submit-request"]')
      
      // Should show validation error
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="email-error"]')).toContainText('required')
    })
  })

  describe('Data Retention', () => {
    it('should display data retention information', async () => {
      await page.route('**/api/compliance/retention**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            retention: {
              totalRecords: 25,
              expiredRecords: 3,
              scheduledForDeletion: 2,
              retentionPolicies: [
                {
                  dataType: 'prompt',
                  retentionPeriod: 365,
                  description: 'User prompts retained for 1 year'
                },
                {
                  dataType: 'conversation',
                  retentionPeriod: 180,
                  description: 'Conversations retained for 6 months'
                }
              ]
            }
          })
        })
      })

      await page.goto('/privacy/retention')
      
      // Should display retention information
      await expect(page.locator('[data-testid="total-records"]')).toContainText('25')
      await expect(page.locator('[data-testid="expired-records"]')).toContainText('3')
      await expect(page.locator('[data-testid="scheduled-deletion"]')).toContainText('2')
      
      // Should display retention policies
      await expect(page.locator('[data-testid="retention-policy"]')).toHaveCount(2)
      await expect(page.locator('[data-testid="retention-policy"]').first()).toContainText('prompt')
      await expect(page.locator('[data-testid="retention-policy"]').first()).toContainText('365')
    })
  })
})