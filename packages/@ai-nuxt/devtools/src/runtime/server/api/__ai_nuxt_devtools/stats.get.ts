import { defineEventHandler } from 'h3'
import { devToolsManager } from '@ai-nuxt/devtools'

export default defineEventHandler(async (event) => {
  const stats = devToolsManager.getStats()
  return stats
})