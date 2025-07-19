import { getDashboard } from '@ai-nuxt/core'

/**
 * Health check endpoint
 */
export default defineEventHandler(async (event) => {
  try {
    const dashboard = getDashboard()
    const health = await dashboard.getOverview()

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      health: health.health,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
})