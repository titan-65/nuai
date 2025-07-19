import { defineEventHandler } from 'h3'
import { devToolsManager } from '@ai-nuxt/devtools'

export default defineEventHandler(async (event) => {
  devToolsManager.clearRequests()
  
  return {
    success: true,
    message: 'All tracked requests have been cleared'
  }
})