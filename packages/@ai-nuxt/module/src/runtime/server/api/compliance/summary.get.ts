/**
 * Get compliance summary for a data subject
 */

import { complianceIntegration } from '@ai-nuxt/core'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { userId, email, sessionId, ipAddress } = query
    
    // Build data subject from query parameters
    const subject: any = {}
    
    if (userId) subject.userId = userId as string
    if (email) subject.email = email as string
    if (sessionId) subject.sessionId = sessionId as string
    if (ipAddress) subject.ipAddress = ipAddress as string
    
    // Use userId as primary ID, fallback to email, then sessionId
    subject.id = (userId || email || sessionId || ipAddress) as string
    
    if (!subject.id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'At least one identifier required: userId, email, sessionId, or ipAddress'
      })
    }
    
    // Get compliance summary
    const summary = await complianceIntegration.getComplianceSummary(subject)
    
    return {
      success: true,
      subject: {
        id: subject.id,
        userId: subject.userId,
        email: subject.email,
        sessionId: subject.sessionId,
        ipAddress: subject.ipAddress
      },
      summary
    }
    
  } catch (error) {
    console.error('Compliance summary error:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})