import { ref } from 'vue'

export interface UseAIStreamOptions {
  onChunk?: (chunk: any) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: Error) => void
}

/**
 * Composable for handling AI streaming responses
 */
export function useAIStream(options: UseAIStreamOptions = {}) {
  // Reactive state
  const isStreaming = ref(false)
  const chunks = ref<any[]>([])
  const fullContent = ref('')
  const error = ref<Error | null>(null)
  
  // Methods
  const startStream = async (url: string, requestBody: any) => {
    if (isStreaming.value) {
      throw new Error('Stream is already active')
    }
    
    isStreaming.value = true
    error.value = null
    chunks.value = []
    fullContent.value = ''
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
          const { done, value } = await reader.read()
          if (done) break
          
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
                  break
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming chunk:', parseError)
              }
            }
          }
        }
        
        // Call completion callback
        if (options.onComplete) {
          options.onComplete(fullContent.value)
        }
      } finally {
        reader.releaseLock()
      }
    } catch (err) {
      error.value = err as Error
      if (options.onError) {
        options.onError(err as Error)
      }
      throw err
    } finally {
      isStreaming.value = false
    }
  }
  
  const stopStream = () => {
    // Note: This is a simplified stop - in a real implementation,
    // you'd want to abort the fetch request
    isStreaming.value = false
  }
  
  const clear = () => {
    chunks.value = []
    fullContent.value = ''
    error.value = null
  }
  
  return {
    // State
    isStreaming: readonly(isStreaming),
    chunks: readonly(chunks),
    fullContent: readonly(fullContent),
    error: readonly(error),
    
    // Methods
    startStream,
    stopStream,
    clear
  }
}