import { ref, computed } from 'vue'

export interface UseAIStreamOptions {
  onChunk?: (chunk: any) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: Error) => void
  onProgress?: (progress: StreamProgress) => void
  bufferSize?: number
  timeout?: number
  retries?: number
  retryDelay?: number
}

export interface StreamProgress {
  bytesReceived: number
  chunksProcessed: number
  timeElapsed: number
  estimatedTimeRemaining?: number
  speed: number // bytes per second
}

export interface StreamMetrics {
  startTime: number
  endTime?: number
  totalBytes: number
  totalChunks: number
  averageChunkSize: number
  speed: number
  errors: number
  retries: number
}

/**
 * Enhanced composable for handling AI streaming responses with advanced features
 */
export function useAIStream(options: UseAIStreamOptions = {}) {
  // Reactive state
  const isStreaming = ref(false)
  const isPaused = ref(false)
  const chunks = ref<any[]>([])
  const fullContent = ref('')
  const error = ref<Error | null>(null)
  const progress = ref<StreamProgress>({
    bytesReceived: 0,
    chunksProcessed: 0,
    timeElapsed: 0,
    speed: 0
  })
  const metrics = ref<StreamMetrics>({
    startTime: 0,
    totalBytes: 0,
    totalChunks: 0,
    averageChunkSize: 0,
    speed: 0,
    errors: 0,
    retries: 0
  })
  
  // Stream control
  const abortController = ref<AbortController | null>(null)
  const pauseResolver = ref<((value: void) => void) | null>(null)
  
  // Computed properties
  const streamingStats = computed(() => ({
    isActive: isStreaming.value,
    isPaused: isPaused.value,
    progress: progress.value,
    metrics: metrics.value,
    chunksCount: chunks.value.length,
    contentLength: fullContent.value.length
  }))
  
  const canPause = computed(() => isStreaming.value && !isPaused.value)
  const canResume = computed(() => isStreaming.value && isPaused.value)
  const canCancel = computed(() => isStreaming.value)
  
  // Utility functions
  const calculateSpeed = (bytes: number, timeMs: number): number => {
    return timeMs > 0 ? (bytes / timeMs) * 1000 : 0
  }
  
  const estimateTimeRemaining = (totalBytes: number, receivedBytes: number, speed: number): number => {
    if (speed === 0 || receivedBytes === 0) return 0
    const remainingBytes = Math.max(0, totalBytes - receivedBytes)
    return remainingBytes / speed
  }
  
  const updateProgress = (newBytes: number) => {
    const now = Date.now()
    const timeElapsed = now - metrics.value.startTime
    
    progress.value = {
      bytesReceived: metrics.value.totalBytes + newBytes,
      chunksProcessed: chunks.value.length,
      timeElapsed,
      speed: calculateSpeed(metrics.value.totalBytes + newBytes, timeElapsed)
    }
    
    if (options.onProgress) {
      options.onProgress(progress.value)
    }
  }
  
  // Enhanced streaming with advanced features
  const startStream = async (url: string, requestBody: any) => {
    if (isStreaming.value) {
      throw new Error('Stream is already active')
    }
    
    // Initialize state
    isStreaming.value = true
    isPaused.value = false
    error.value = null
    chunks.value = []
    fullContent.value = ''
    
    metrics.value = {
      startTime: Date.now(),
      totalBytes: 0,
      totalChunks: 0,
      averageChunkSize: 0,
      speed: 0,
      errors: 0,
      retries: 0
    }
    
    progress.value = {
      bytesReceived: 0,
      chunksProcessed: 0,
      timeElapsed: 0,
      speed: 0
    }
    
    // Create abort controller
    abortController.value = new AbortController()
    
    const maxRetries = options.retries || 3
    let retryCount = 0
    
    while (retryCount <= maxRetries) {
      try {
        await processStream(url, requestBody)
        break // Success, exit retry loop
      } catch (err: any) {
        metrics.value.errors++
        
        if (err.name === 'AbortError' || retryCount >= maxRetries) {
          throw err
        }
        
        retryCount++
        metrics.value.retries++
        
        // Wait before retry
        const delay = options.retryDelay || (1000 * retryCount)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // Finalize metrics
    metrics.value.endTime = Date.now()
    metrics.value.averageChunkSize = metrics.value.totalChunks > 0 
      ? metrics.value.totalBytes / metrics.value.totalChunks 
      : 0
    
    // Call completion callback
    if (options.onComplete) {
      options.onComplete(fullContent.value)
    }
  }
  
  const processStream = async (url: string, requestBody: any) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: abortController.value?.signal
    })
    
    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status} ${response.statusText}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    try {
      while (true) {
        // Check for abort
        if (abortController.value?.signal.aborted) {
          throw new Error('Stream was cancelled')
        }
        
        // Handle pause
        if (isPaused.value) {
          await new Promise<void>(resolve => {
            pauseResolver.value = resolve
          })
        }
        
        const { done, value } = await reader.read()
        if (done) break
        
        // Update metrics
        const chunkSize = value.byteLength
        metrics.value.totalBytes += chunkSize
        updateProgress(chunkSize)
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === '' || trimmed === 'data: [DONE]') continue
          
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              
              // Handle error in stream
              if (data.error) {
                throw new Error(data.error)
              }
              
              chunks.value.push(data)
              metrics.value.totalChunks++
              
              // Update full content based on chunk type
              if (data.delta) {
                fullContent.value += data.delta
              } else if (data.content) {
                fullContent.value += data.content
              } else if (data.text) {
                fullContent.value += data.text
              }
              
              // Call chunk callback
              if (options.onChunk) {
                options.onChunk(data)
              }
              
              // Check if stream is finished
              if (data.finished) {
                return // Exit the stream processing
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError)
              metrics.value.errors++
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
      isStreaming.value = false
      isPaused.value = false
    }
  }
  
  // Stream control methods
  const pauseStream = () => {
    if (canPause.value) {
      isPaused.value = true
    }
  }
  
  const resumeStream = () => {
    if (canResume.value && pauseResolver.value) {
      isPaused.value = false
      pauseResolver.value()
      pauseResolver.value = null
    }
  }
  
  const cancelStream = () => {
    if (abortController.value) {
      abortController.value.abort()
      isStreaming.value = false
      isPaused.value = false
    }
  }
  
  // Utility methods
  const clear = () => {
    chunks.value = []
    fullContent.value = ''
    error.value = null
    progress.value = {
      bytesReceived: 0,
      chunksProcessed: 0,
      timeElapsed: 0,
      speed: 0
    }
  }
  
  const getStreamSummary = () => ({
    totalTime: metrics.value.endTime ? metrics.value.endTime - metrics.value.startTime : 0,
    totalBytes: metrics.value.totalBytes,
    totalChunks: metrics.value.totalChunks,
    averageChunkSize: metrics.value.averageChunkSize,
    averageSpeed: metrics.value.speed,
    errorCount: metrics.value.errors,
    retryCount: metrics.value.retries,
    finalContentLength: fullContent.value.length
  })
  
  // Advanced streaming utilities
  const streamWithTimeout = async (url: string, requestBody: any, timeoutMs: number = 30000) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stream timeout')), timeoutMs)
    })
    
    return Promise.race([
      startStream(url, requestBody),
      timeoutPromise
    ])
  }
  
  const streamWithRetry = async (url: string, requestBody: any, maxRetries: number = 3) => {
    const originalRetries = options.retries
    options.retries = maxRetries
    
    try {
      return await startStream(url, requestBody)
    } finally {
      options.retries = originalRetries
    }
  }
  
  return {
    // State
    isStreaming: readonly(isStreaming),
    isPaused: readonly(isPaused),
    chunks: readonly(chunks),
    fullContent: readonly(fullContent),
    error: readonly(error),
    progress: readonly(progress),
    metrics: readonly(metrics),
    
    // Computed
    streamingStats,
    canPause,
    canResume,
    canCancel,
    
    // Methods
    startStream,
    pauseStream,
    resumeStream,
    cancelStream,
    clear,
    
    // Advanced methods
    streamWithTimeout,
    streamWithRetry,
    getStreamSummary
  }
}