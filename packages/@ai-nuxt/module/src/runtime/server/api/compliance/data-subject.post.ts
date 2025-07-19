/**
 * Handle data subject requests (GDPR/CCPA)
 */

import { complianceIntegration, complianceManager } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { type, subject, details, verified } = body
    
    // Validate request
    if (!type || !subject) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: type, subject'
      })
    }
    
    // Validate request type
    const validTypes = ['access', 'delete', 'portability', 'rectification']
    if (!validTypes.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid request type. Must be one of: ${validTypes.join(', ')}`
      })
    }
    
    // Handle the request
    const requestId = await complianceIntegration.handleDataSubjectRequest(
      type,
      subject,
      details
    )
    
    // If verified, process immediately (for testing/admin purposes)
    if (verified === true) {
      try {
        await complianceManager.processPrivacyRequest(requestId)
        
        return {
          success: true,
          requestId,
          status: 'completed',
          message: `${type} request processed successfully`
        }
      } catch (error) {
        return {
          success: true,
          requestId,
          status: 'failed',
          message: `Request created but processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }
    
    return {
      success: true,
      requestId,
      status: 'pending',
      message: `${type} request submitted successfully. Verification required before processing.`
    }
    
  } catch (error) {
    console.error('Data subject request error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})