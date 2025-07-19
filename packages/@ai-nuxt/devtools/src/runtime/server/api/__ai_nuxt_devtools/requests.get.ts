import { defineEventHandler, getQuery } from 'h3'
import { devToolsManager } from '@ai-nuxt/devtools'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  const filters = {
    type: query.type as string,
    provider: query.provider as string,
    model: query.model as string,
    status: query.status as string,
    limit: query.limit ? parseInt(query.limit as string) : undefined,
    offset: query.offset ? parseInt(query.offset as string) : undefined
  }
  
  const requests = devToolsManager.getRequests(filters)
  
  return requests
})