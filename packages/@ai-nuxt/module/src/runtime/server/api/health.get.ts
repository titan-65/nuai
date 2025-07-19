import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#nitro'

/**
 * Health check endpoint for AI services
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const aiConfig = config.aiNuxt
  
  // Basic health status
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0', // Should match package version
    providers: {
      default: aiConfig.defaultProvider,
      configured: aiConfig.providers?.length || 0
    },
    features: {
      streaming: aiConfig.streaming?.enabled || false,
      caching: aiConfig.caching?.enabled || false,
      security: {
        promptInjectionDetection: aiConfig.security?.promptInjectionDetection || false,
        piiScrubbing: aiConfig.security?.piiScrubbing || false,
        contentFiltering: aiConfig.security?.contentFiltering || false,
        rateLimit: aiConfig.security?.rateLimit?.enabled || false
      }
    }
  }
  
  // Add detailed provider info if in debug mode
  if (aiConfig.debug) {
    health.config = {
      providers: aiConfig.providers,
      caching: aiConfig.caching,
      security: aiConfig.security
    }
  }
  
  return health
})