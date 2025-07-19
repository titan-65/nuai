import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAIStream } from '../useAIStream'

// Mock fetch
global.fetch = vi.fn()

describe('useAIStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('initialization', () => {
    it('should initialize with default state', () => {
      const stream = useAIStream()
      
      expect(stream.isStreaming.value).toBe(false)
      expect(stream.isPaused.value).toBe(false)
      expect(stream.chunks.value).toEqual([])
      expect(stream.fullContent.value).toBe('')
      expect(stream.error.value).toBeNull()
    })
    
    it('should initialize with custom options', () => {
      const onChunk = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()
      const onProgress = vi.fn()
      
      const stream = useAIStream({
        onChunk,
        onComplete,
        onError,
        onProgress,
        bufferSize: 1024,
        timeout: 30000,
        retries: 5,
        retryDelay: 2000
      })
      
      expect(stream.isStreaming.value).toBe(false)
    })
  })
  
  describe('streaming functionality', () => {
    it('should stream data successfully', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"Hello","finished":false}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":" World","finished":false}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"!","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const onChunk = vi.fn()
      const onComplete = vi.fn()
      const stream = useAIStream({ onChunk, onComplete })
      
      await stream.startStream('/api/stream', { prompt: 'test' })
      
      expect(stream.fullContent.value).toBe('Hello World!')
      expect(stream.chunks.value).toHaveLength(3)
      expect(onChunk).toHaveBeenCalledTimes(3)
      expect(onComplete).toHaveBeenCalledWith('Hello World!')
    })
    
    it('should handle streaming errors', async () => {
      const mockError = new Error('Network error')
      vi.mocked(fetch).mockRejectedValue(mockError)
      
      const onError = vi.fn()
      const stream = useAIStream({ onError })
      
      await expect(stream.startStream('/api/stream', { prompt: 'test' })).rejects.toThrow('Network error')
      expect(onError).toHaveBeenCalledWith(mockError)
      expect(stream.error.value).toBe(mockError)
    })
    
    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)
      
      const stream = useAIStream()
      
      await expect(stream.startStream('/api/stream', { prompt: 'test' })).rejects.toThrow('Stream request failed: 500 Internal Server Error')
    })
    
    it('should prevent concurrent streams', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => 
              new Promise(resolve => setTimeout(() => resolve({ done: true }), 100))
            ),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      const promise1 = stream.startStream('/api/stream', { prompt: 'test1' })
      
      await expect(stream.startStream('/api/stream', { prompt: 'test2' })).rejects.toThrow('Stream is already active')
      
      await promise1
    })
  })
  
  describe('stream control', () => {
    it('should pause and resume streaming', async () => {
      let readResolver: any
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => 
              new Promise(resolve => {
                readResolver = resolve
              })
            ),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      // Start streaming
      const streamPromise = stream.startStream('/api/stream', { prompt: 'test' })
      
      // Wait a bit then pause
      await new Promise(resolve => setTimeout(resolve, 10))
      stream.pauseStream()
      
      expect(stream.isPaused.value).toBe(true)
      expect(stream.canResume.value).toBe(true)
      
      // Resume
      stream.resumeStream()
      expect(stream.isPaused.value).toBe(false)
      
      // Complete the stream
      readResolver({ done: true })
      await streamPromise
    })
    
    it('should cancel streaming', async () => {
      let readResolver: any
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => 
              new Promise(resolve => {
                readResolver = resolve
              })
            ),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      // Start streaming
      const streamPromise = stream.startStream('/api/stream', { prompt: 'test' })
      
      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 10))
      stream.cancelStream()
      
      expect(stream.isStreaming.value).toBe(false)
      expect(stream.canCancel.value).toBe(false)
      
      // The stream should be cancelled
      await expect(streamPromise).rejects.toThrow()
    })
  })
  
  describe('progress tracking', () => {
    it('should track streaming progress', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"Hello","finished":false}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":" World","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const onProgress = vi.fn()
      const stream = useAIStream({ onProgress })
      
      await stream.startStream('/api/stream', { prompt: 'test' })
      
      expect(onProgress).toHaveBeenCalled()
      expect(stream.progress.value.bytesReceived).toBeGreaterThan(0)
      expect(stream.progress.value.chunksProcessed).toBe(2)
      expect(stream.progress.value.timeElapsed).toBeGreaterThan(0)
    })
    
    it('should calculate streaming metrics', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"Test","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      await stream.startStream('/api/stream', { prompt: 'test' })
      
      const summary = stream.getStreamSummary()
      
      expect(summary.totalTime).toBeGreaterThan(0)
      expect(summary.totalBytes).toBeGreaterThan(0)
      expect(summary.totalChunks).toBe(1)
      expect(summary.finalContentLength).toBe(4) // "Test"
    })
  })
  
  describe('retry mechanism', () => {
    it('should retry on network errors', async () => {
      const networkError = new Error('Network error')
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"Success","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockStreamResponse as any)
      
      const stream = useAIStream({ retries: 3, retryDelay: 10 })
      
      await stream.startStream('/api/stream', { prompt: 'test' })
      
      expect(stream.fullContent.value).toBe('Success')
      expect(stream.metrics.value.retries).toBe(2)
      expect(fetch).toHaveBeenCalledTimes(3)
    })
    
    it('should fail after max retries', async () => {
      const networkError = new Error('Persistent network error')
      vi.mocked(fetch).mockRejectedValue(networkError)
      
      const stream = useAIStream({ retries: 2, retryDelay: 10 })
      
      await expect(stream.startStream('/api/stream', { prompt: 'test' })).rejects.toThrow('Persistent network error')
      expect(stream.metrics.value.retries).toBe(2)
      expect(fetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })
  
  describe('advanced streaming methods', () => {
    it('should handle streaming with timeout', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => 
              new Promise(resolve => setTimeout(() => resolve({ done: true }), 100))
            ),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      // This should timeout quickly
      await expect(stream.streamWithTimeout('/api/stream', { prompt: 'test' }, 50)).rejects.toThrow('Stream timeout')
    })
    
    it('should handle streaming with custom retry count', async () => {
      const networkError = new Error('Network error')
      vi.mocked(fetch).mockRejectedValue(networkError)
      
      const stream = useAIStream()
      
      await expect(stream.streamWithRetry('/api/stream', { prompt: 'test' }, 1)).rejects.toThrow('Network error')
      expect(fetch).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })
  
  describe('computed properties', () => {
    it('should compute streaming stats correctly', () => {
      const stream = useAIStream()
      
      const stats = stream.streamingStats.value
      
      expect(stats.isActive).toBe(false)
      expect(stats.isPaused).toBe(false)
      expect(stats.chunksCount).toBe(0)
      expect(stats.contentLength).toBe(0)
    })
    
    it('should compute control states correctly', () => {
      const stream = useAIStream()
      
      expect(stream.canPause.value).toBe(false)
      expect(stream.canResume.value).toBe(false)
      expect(stream.canCancel.value).toBe(false)
    })
  })
  
  describe('utility methods', () => {
    it('should clear stream state', () => {
      const stream = useAIStream()
      
      // Manually set some state
      stream.chunks.value.push({ test: 'data' })
      stream.fullContent.value = 'test content'
      
      stream.clear()
      
      expect(stream.chunks.value).toEqual([])
      expect(stream.fullContent.value).toBe('')
      expect(stream.error.value).toBeNull()
      expect(stream.progress.value.bytesReceived).toBe(0)
    })
    
    it('should provide stream summary', () => {
      const stream = useAIStream()
      
      const summary = stream.getStreamSummary()
      
      expect(summary).toHaveProperty('totalTime')
      expect(summary).toHaveProperty('totalBytes')
      expect(summary).toHaveProperty('totalChunks')
      expect(summary).toHaveProperty('averageChunkSize')
      expect(summary).toHaveProperty('errorCount')
      expect(summary).toHaveProperty('retryCount')
      expect(summary).toHaveProperty('finalContentLength')
    })
  })
  
  describe('error handling', () => {
    it('should handle malformed JSON in stream', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: invalid json\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta":"Valid","finished":true}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      await stream.startStream('/api/stream', { prompt: 'test' })
      
      // Should continue despite malformed JSON
      expect(stream.fullContent.value).toBe('Valid')
      expect(stream.metrics.value.errors).toBe(1)
    })
    
    it('should handle stream errors in data', async () => {
      const mockStreamResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"error":"Stream error occurred"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: vi.fn()
          })
        }
      }
      
      vi.mocked(fetch).mockResolvedValue(mockStreamResponse as any)
      
      const stream = useAIStream()
      
      await expect(stream.startStream('/api/stream', { prompt: 'test' })).rejects.toThrow('Stream error occurred')
    })
  })
})