import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OpenAIEdgeProvider } from '../providers/edge/openai-edge'
import { 
  CloudflareKVCache, 
  VercelKVCache, 
  NetlifyBlobsCache, 
  WebAPICache,
  createEdgeCache 
} from '../cache/edge-cache'

// Mock fetch for edge provider tests
global.fetch = vi.fn()

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn((ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller.signal
  })
}

describe('Edge Deployment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OpenAI Edge Provider', () => {
    let provider: OpenAIEdgeProvider

    beforeEach(() => {
      provider = new OpenAIEdgeProvider({
        apiKey: 'test-api-key',
        maxConcurrency: 5,
        timeout: 10000
      })
    })

    it('should create OpenAI edge provider with configuration', () => {
      expect(provider).toBeInstanceOf(OpenAIEdgeProvider)
    })

    it('should handle chat requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Hello from edge!' },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          },
          model: 'gpt-3.5-turbo'
        })
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await provider.chat([
        { role: 'user', content: 'Hello' }
      ])

      expect(result.content).toBe('Hello from edge!')
      expect(result.usage.totalTokens).toBe(15)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should handle completion requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Completion result' },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 8,
            completion_tokens: 3,
            total_tokens: 11
          },
          model: 'gpt-3.5-turbo'
        })
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await provider.completion('Complete this text')

      expect(result.content).toBe('Completion result')
      expect(result.usage.totalTokens).toBe(11)
    })

    it('should handle embedding requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] }
          ],
          usage: {
            prompt_tokens: 5,
            total_tokens: 5
          },
          model: 'text-embedding-ada-002'
        })
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await provider.embedding(['text1', 'text2'])

      expect(result.embeddings).toHaveLength(2)
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
      expect(result.usage.totalTokens).toBe(5)
    })

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      await expect(provider.chat([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('OpenAI API error: 429 Too Many Requests')
    })

    it('should handle timeouts', async () => {
      vi.mocked(fetch).mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 100)
        })
      )

      await expect(provider.chat([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('OpenAI API timeout after 10000ms')
    })

    it('should perform health check', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] })
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const isHealthy = await provider.healthCheck()

      expect(isHealthy).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      )
    })
  })

  describe('Edge Cache Providers', () => {
    describe('CloudflareKVCache', () => {
      let cache: CloudflareKVCache
      let mockNamespace: any

      beforeEach(() => {
        mockNamespace = {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn()
        }
        cache = new CloudflareKVCache(mockNamespace, 3600)
      })

      it('should get values from KV', async () => {
        mockNamespace.get.mockResolvedValue('{"test": "value"}')

        const result = await cache.get('test-key')

        expect(result).toEqual({ test: 'value' })
        expect(mockNamespace.get).toHaveBeenCalledWith('test-key', 'json')
      })

      it('should set values in KV', async () => {
        await cache.set('test-key', { test: 'value' }, 1800)

        expect(mockNamespace.put).toHaveBeenCalledWith(
          'test-key',
          '{"test":"value"}',
          { expirationTtl: 1800 }
        )
      })

      it('should delete values from KV', async () => {
        await cache.delete('test-key')

        expect(mockNamespace.delete).toHaveBeenCalledWith('test-key')
      })

      it('should check if key exists', async () => {
        mockNamespace.get.mockResolvedValue('some-value')

        const exists = await cache.has('test-key')

        expect(exists).toBe(true)
        expect(mockNamespace.get).toHaveBeenCalledWith('test-key')
      })
    })

    describe('VercelKVCache', () => {
      let cache: VercelKVCache
      let mockKV: any

      beforeEach(() => {
        mockKV = {
          get: vi.fn(),
          set: vi.fn(),
          del: vi.fn(),
          exists: vi.fn(),
          flushall: vi.fn(),
          dbsize: vi.fn()
        }
        cache = new VercelKVCache(mockKV, 3600)
      })

      it('should get values from Vercel KV', async () => {
        mockKV.get.mockResolvedValue({ test: 'value' })

        const result = await cache.get('test-key')

        expect(result).toEqual({ test: 'value' })
        expect(mockKV.get).toHaveBeenCalledWith('test-key')
      })

      it('should set values in Vercel KV', async () => {
        await cache.set('test-key', { test: 'value' }, 1800)

        expect(mockKV.set).toHaveBeenCalledWith(
          'test-key',
          { test: 'value' },
          { ex: 1800 }
        )
      })

      it('should delete values from Vercel KV', async () => {
        await cache.delete('test-key')

        expect(mockKV.del).toHaveBeenCalledWith('test-key')
      })

      it('should check if key exists', async () => {
        mockKV.exists.mockResolvedValue(1)

        const exists = await cache.has('test-key')

        expect(exists).toBe(true)
        expect(mockKV.exists).toHaveBeenCalledWith('test-key')
      })

      it('should get cache size', async () => {
        mockKV.dbsize.mockResolvedValue(42)

        const size = await cache.size()

        expect(size).toBe(42)
        expect(mockKV.dbsize).toHaveBeenCalled()
      })
    })

    describe('NetlifyBlobsCache', () => {
      let cache: NetlifyBlobsCache
      let mockStore: any

      beforeEach(() => {
        mockStore = {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          list: vi.fn()
        }
        cache = new NetlifyBlobsCache(mockStore, 3600)
      })

      it('should get values from Netlify Blobs', async () => {
        const mockBlob = {
          text: vi.fn().mockResolvedValue('{"test":"value"}')
        }
        mockStore.get.mockResolvedValue(mockBlob)

        const result = await cache.get('test-key')

        expect(result).toEqual({ test: 'value' })
        expect(mockStore.get).toHaveBeenCalledWith('test-key')
      })

      it('should set values in Netlify Blobs', async () => {
        await cache.set('test-key', { test: 'value' }, 1800)

        expect(mockStore.set).toHaveBeenCalledWith(
          'test-key',
          '{"test":"value"}',
          expect.objectContaining({
            metadata: expect.objectContaining({
              expiresAt: expect.any(Number)
            })
          })
        )
      })

      it('should delete values from Netlify Blobs', async () => {
        await cache.delete('test-key')

        expect(mockStore.delete).toHaveBeenCalledWith('test-key')
      })

      it('should list blobs for size calculation', async () => {
        mockStore.list.mockResolvedValue({
          blobs: [{ key: 'key1' }, { key: 'key2' }, { key: 'key3' }]
        })

        const size = await cache.size()

        expect(size).toBe(3)
        expect(mockStore.list).toHaveBeenCalled()
      })
    })

    describe('WebAPICache', () => {
      let cache: WebAPICache

      beforeEach(() => {
        cache = new WebAPICache(3600)
      })

      it('should store and retrieve values', async () => {
        await cache.set('test-key', { test: 'value' })

        const result = await cache.get('test-key')

        expect(result).toEqual({ test: 'value' })
      })

      it('should handle expiration', async () => {
        await cache.set('test-key', { test: 'value' }, 0.001) // 1ms TTL

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 10))

        const result = await cache.get('test-key')

        expect(result).toBeNull()
      })

      it('should delete values', async () => {
        await cache.set('test-key', { test: 'value' })
        await cache.delete('test-key')

        const result = await cache.get('test-key')

        expect(result).toBeNull()
      })

      it('should clear all values', async () => {
        await cache.set('key1', 'value1')
        await cache.set('key2', 'value2')
        await cache.clear()

        const result1 = await cache.get('key1')
        const result2 = await cache.get('key2')

        expect(result1).toBeNull()
        expect(result2).toBeNull()
      })

      it('should check if key exists', async () => {
        await cache.set('test-key', { test: 'value' })

        const exists = await cache.has('test-key')

        expect(exists).toBe(true)
      })

      it('should return correct size', async () => {
        await cache.set('key1', 'value1')
        await cache.set('key2', 'value2')

        const size = await cache.size()

        expect(size).toBe(2)
      })
    })

    describe('Edge Cache Factory', () => {
      it('should create Cloudflare cache', () => {
        const mockNamespace = {}
        const cache = createEdgeCache('cloudflare', { namespace: mockNamespace })

        expect(cache).toBeInstanceOf(CloudflareKVCache)
        expect(cache.platform).toBe('cloudflare')
      })

      it('should create Vercel cache', () => {
        const mockKV = {}
        const cache = createEdgeCache('vercel', { kv: mockKV })

        expect(cache).toBeInstanceOf(VercelKVCache)
        expect(cache.platform).toBe('vercel')
      })

      it('should create Netlify cache', () => {
        const mockStore = {}
        const cache = createEdgeCache('netlify', { store: mockStore })

        expect(cache).toBeInstanceOf(NetlifyBlobsCache)
        expect(cache.platform).toBe('netlify')
      })

      it('should create generic cache', () => {
        const cache = createEdgeCache('generic')

        expect(cache).toBeInstanceOf(WebAPICache)
        expect(cache.platform).toBe('generic')
      })
    })
  })

  describe('Edge Runtime Compatibility', () => {
    it('should handle streaming responses', async () => {
      const provider = new OpenAIEdgeProvider({
        apiKey: 'test-api-key'
      })

      // Mock streaming response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        }
      })

      const mockResponse = {
        ok: true,
        body: mockStream
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await provider.chat([
        { role: 'user', content: 'Hello' }
      ], { stream: true })

      expect(result.content).toBe('Hello world')
    })

    it('should handle Web API limitations', () => {
      // Test that edge-compatible APIs are used
      expect(typeof fetch).toBe('function')
      expect(typeof ReadableStream).toBe('function')
      expect(typeof TextEncoder).toBe('function')
      expect(typeof TextDecoder).toBe('function')
    })

    it('should handle memory constraints', async () => {
      const cache = new WebAPICache(1) // 1 second TTL
      
      // Add many items to test memory management
      for (let i = 0; i < 100; i++) {
        await cache.set(`key-${i}`, `value-${i}`)
      }

      const size = await cache.size()
      expect(size).toBe(100)

      // Wait for expiration and check cleanup
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      const sizeAfterExpiration = await cache.size()
      expect(sizeAfterExpiration).toBe(0)
    })
  })

  describe('Platform-Specific Features', () => {
    it('should handle Cloudflare Workers environment', () => {
      // Test Cloudflare-specific features
      const cache = createEdgeCache('cloudflare', {
        namespace: { get: vi.fn(), put: vi.fn(), delete: vi.fn() }
      })

      expect(cache.edgeCompatible).toBe(true)
      expect(cache.platform).toBe('cloudflare')
    })

    it('should handle Vercel Edge Runtime environment', () => {
      // Test Vercel-specific features
      const cache = createEdgeCache('vercel', {
        kv: { get: vi.fn(), set: vi.fn(), del: vi.fn() }
      })

      expect(cache.edgeCompatible).toBe(true)
      expect(cache.platform).toBe('vercel')
    })

    it('should handle Netlify Edge Functions environment', () => {
      // Test Netlify-specific features
      const cache = createEdgeCache('netlify', {
        store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
      })

      expect(cache.edgeCompatible).toBe(true)
      expect(cache.platform).toBe('netlify')
    })
  })
})