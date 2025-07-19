import type { CacheProvider } from './types'

/**
 * Edge-compatible cache interface
 */
export interface EdgeCacheProvider extends CacheProvider {
  readonly edgeCompatible: true
  readonly platform: 'cloudflare' | 'vercel' | 'netlify' | 'generic'
}

/**
 * Cloudflare KV cache provider
 */
export class CloudflareKVCache implements EdgeCacheProvider {
  readonly edgeCompatible = true as const
  readonly platform = 'cloudflare' as const
  
  private namespace: KVNamespace
  private defaultTTL: number

  constructor(namespace: KVNamespace, defaultTTL = 3600) {
    this.namespace = namespace
    this.defaultTTL = defaultTTL
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.namespace.get(key, 'json')
      return value as T | null
    } catch (error) {
      console.error('CloudflareKVCache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.namespace.put(key, JSON.stringify(value), {
        expirationTtl: ttl || this.defaultTTL
      })
    } catch (error) {
      console.error('CloudflareKVCache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.namespace.delete(key)
    } catch (error) {
      console.error('CloudflareKVCache delete error:', error)
    }
  }

  async clear(): Promise<void> {
    // KV doesn't support bulk delete, so we'll skip this
    console.warn('CloudflareKVCache clear not implemented (KV limitation)')
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.namespace.get(key)
      return value !== null
    } catch (error) {
      console.error('CloudflareKVCache has error:', error)
      return false
    }
  }

  async size(): Promise<number> {
    // KV doesn't provide size information
    return -1
  }
}

/**
 * Vercel KV cache provider
 */
export class VercelKVCache implements EdgeCacheProvider {
  readonly edgeCompatible = true as const
  readonly platform = 'vercel' as const
  
  private kv: any // @vercel/kv instance
  private defaultTTL: number

  constructor(kv: any, defaultTTL = 3600) {
    this.kv = kv
    this.defaultTTL = defaultTTL
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key)
      return value as T | null
    } catch (error) {
      console.error('VercelKVCache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.kv.set(key, value, {
        ex: ttl || this.defaultTTL
      })
    } catch (error) {
      console.error('VercelKVCache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.del(key)
    } catch (error) {
      console.error('VercelKVCache delete error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      await this.kv.flushall()
    } catch (error) {
      console.error('VercelKVCache clear error:', error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.kv.exists(key)
      return exists === 1
    } catch (error) {
      console.error('VercelKVCache has error:', error)
      return false
    }
  }

  async size(): Promise<number> {
    try {
      return await this.kv.dbsize()
    } catch (error) {
      console.error('VercelKVCache size error:', error)
      return -1
    }
  }
}

/**
 * Netlify Blobs cache provider
 */
export class NetlifyBlobsCache implements EdgeCacheProvider {
  readonly edgeCompatible = true as const
  readonly platform = 'netlify' as const
  
  private store: any // Netlify Blobs store
  private defaultTTL: number

  constructor(store: any, defaultTTL = 3600) {
    this.store = store
    this.defaultTTL = defaultTTL
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const blob = await this.store.get(key)
      if (!blob) return null
      
      const text = await blob.text()
      return JSON.parse(text) as T
    } catch (error) {
      console.error('NetlifyBlobsCache get error:', error)
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const data = JSON.stringify(value)
      await this.store.set(key, data, {
        metadata: {
          expiresAt: Date.now() + (ttl || this.defaultTTL) * 1000
        }
      })
    } catch (error) {
      console.error('NetlifyBlobsCache set error:', error)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.store.delete(key)
    } catch (error) {
      console.error('NetlifyBlobsCache delete error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const { blobs } = await this.store.list()
      await Promise.all(blobs.map((blob: any) => this.store.delete(blob.key)))
    } catch (error) {
      console.error('NetlifyBlobsCache clear error:', error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const blob = await this.store.get(key)
      return blob !== null
    } catch (error) {
      console.error('NetlifyBlobsCache has error:', error)
      return false
    }
  }

  async size(): Promise<number> {
    try {
      const { blobs } = await this.store.list()
      return blobs.length
    } catch (error) {
      console.error('NetlifyBlobsCache size error:', error)
      return -1
    }
  }
}

/**
 * Generic edge cache using Web APIs
 */
export class WebAPICache implements EdgeCacheProvider {
  readonly edgeCompatible = true as const
  readonly platform = 'generic' as const
  
  private cache = new Map<string, { value: any; expires: number }>()
  private defaultTTL: number

  constructor(defaultTTL = 3600) {
    this.defaultTTL = defaultTTL
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key)
    
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }
    
    return item.value as T
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.defaultTTL) * 1000
    this.cache.set(key, { value, expires })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key)
    
    if (!item) return false
    
    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }

  async size(): Promise<number> {
    // Clean expired items first
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
    
    return this.cache.size
  }
}

/**
 * Edge cache factory
 */
export function createEdgeCache(
  platform: 'cloudflare' | 'vercel' | 'netlify' | 'generic',
  config: any = {}
): EdgeCacheProvider {
  switch (platform) {
    case 'cloudflare':
      return new CloudflareKVCache(config.namespace, config.ttl)
    case 'vercel':
      return new VercelKVCache(config.kv, config.ttl)
    case 'netlify':
      return new NetlifyBlobsCache(config.store, config.ttl)
    case 'generic':
    default:
      return new WebAPICache(config.ttl)
  }
}