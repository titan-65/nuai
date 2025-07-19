import { ref } from 'vue'

interface CacheItem {
  key: string
  type: string
  value: any
  size: number
  created: Date
  expires: Date
  hits: number
  ttl: number
  metadata: Record<string, any>
}

interface CacheStatistics {
  size: number
  hits: number
  misses: number
  hitRate: number
}

const cacheItems = ref<CacheItem[]>([])
const cacheStats = ref<CacheStatistics>({
  size: 0,
  hits: 0,
  misses: 0,
  hitRate: 0
})

export function useAICache() {
  async function fetchCacheItems() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/cache/items')
      const data = await response.json()
      cacheItems.value = data.map((item: any) => ({
        ...item,
        created: new Date(item.created),
        expires: new Date(item.expires)
      }))
    } catch (error) {
      console.error('Failed to fetch cache items:', error)
      // Mock data for development
      cacheItems.value = [
        {
          key: 'ai:completion:gpt-3.5-turbo:hash123',
          type: 'completion',
          value: 'This is a cached AI response...',
          size: 1024,
          created: new Date(Date.now() - 3600000),
          expires: new Date(Date.now() + 3600000),
          hits: 5,
          ttl: 3600,
          metadata: { model: 'gpt-3.5-turbo', tokens: 150 }
        }
      ]
    }
  }

  async function fetchCacheStats() {
    try {
      const response = await fetch('/__ai_nuxt_devtools/api/cache/stats')
      const data = await response.json()
      cacheStats.value = data
    } catch (error) {
      console.error('Failed to fetch cache stats:', error)
      // Mock data for development
      cacheStats.value = {
        size: cacheItems.value.length,
        hits: 127,
        misses: 23,
        hitRate: 84.7
      }
    }
  }

  async function clearAllCache() {
    try {
      await fetch('/__ai_nuxt_devtools/api/cache', {
        method: 'DELETE'
      })
      cacheItems.value = []
      cacheStats.value = { size: 0, hits: 0, misses: 0, hitRate: 0 }
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  async function deleteCacheItem(key: string) {
    try {
      await fetch(`/__ai_nuxt_devtools/api/cache/items/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      })
      cacheItems.value = cacheItems.value.filter(item => item.key !== key)
    } catch (error) {
      console.error('Failed to delete cache item:', error)
    }
  }

  return {
    cacheItems,
    cacheStats,
    fetchCacheItems,
    fetchCacheStats,
    clearAllCache,
    deleteCacheItem
  }
}