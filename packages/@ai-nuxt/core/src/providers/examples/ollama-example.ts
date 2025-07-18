/**
 * Example usage of Ollama provider
 * This file demonstrates how to use the Ollama provider for local AI operations
 */

import { OllamaProvider } from '../ollama'
import { providerRegistry } from '../registry'
import type { ProviderConfig } from '../../types'

async function exampleUsage() {
  // Create and register the Ollama provider
  const ollamaProvider = new OllamaProvider()
  providerRegistry.register(ollamaProvider)
  
  // Configure the provider (no API key needed for local Ollama)
  const config: ProviderConfig = {
    id: 'ollama',
    name: 'Ollama',
    baseURL: 'http://localhost:11434' // Default Ollama URL
  }
  
  try {
    await ollamaProvider.initialize(config)
    console.log('Ollama provider initialized successfully!')
    console.log('Available models:', ollamaProvider.getAvailableModels())
  } catch (error) {
    console.error('Failed to initialize Ollama provider:', error)
    console.log('Make sure Ollama is running: ollama serve')
    return
  }
  
  // Example 1: List available models
  console.log('\n=== Available Models ===')
  try {
    const models = await ollamaProvider.listModels()
    console.log('Installed models:')
    models.forEach(model => {
      console.log(`- ${model.name} (${model.details.parameter_size || 'unknown size'})`)
    })
  } catch (error) {
    console.error('Error listing models:', error)
  }
  
  // Example 2: Pull a model (if not already available)
  console.log('\n=== Model Management ===')
  try {
    const availableModels = ollamaProvider.getAvailableModels()
    if (!availableModels.includes('llama2')) {
      console.log('Pulling llama2 model...')
      await ollamaProvider.pullModel('llama2')
      console.log('llama2 model pulled successfully!')
    } else {
      console.log('llama2 model is already available')
    }
  } catch (error) {
    console.error('Error managing models:', error)
  }
  
  // Example 3: Chat completion with local model
  console.log('\n=== Local Chat Completion Example ===')
  try {
    const chatResponse = await ollamaProvider.chat.create({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Explain the benefits of running AI models locally.',
          timestamp: new Date()
        }
      ],
      model: 'llama2', // Use specific model
      temperature: 0.7,
      maxTokens: 200
    })
    
    console.log('Local AI Response:', chatResponse.message.content)
    console.log('Tokens used:', chatResponse.usage.totalTokens)
    console.log('Model used:', chatResponse.model)
  } catch (error) {
    console.error('Chat completion error:', error)
  }
  
  // Example 4: Chat with system prompt
  console.log('\n=== Chat with System Prompt Example ===')
  try {
    const systemChatResponse = await ollamaProvider.chat.create({
      messages: [
        {
          id: '2',
          role: 'user',
          content: 'What is machine learning?',
          timestamp: new Date()
        }
      ],
      systemPrompt: 'You are a computer science professor explaining concepts to undergraduate students. Use clear, educational language.',
      temperature: 0.5,
      maxTokens: 250
    })
    
    console.log('Educational response:', systemChatResponse.message.content)
  } catch (error) {
    console.error('System chat error:', error)
  }
  
  // Example 5: Streaming chat completion
  console.log('\n=== Streaming Chat Example ===')
  try {
    const streamingMessages = [
      {
        id: '3',
        role: 'user' as const,
        content: 'Write a short story about a robot learning to paint.',
        timestamp: new Date()
      }
    ]
    
    console.log('Streaming response:')
    let fullResponse = ''
    for await (const chunk of ollamaProvider.chat.stream({ 
      messages: streamingMessages,
      model: 'llama2'
    })) {
      if (!chunk.finished) {
        process.stdout.write(chunk.delta)
        fullResponse += chunk.delta
      } else {
        console.log('\n--- Stream completed ---')
      }
    }
  } catch (error) {
    console.error('Streaming error:', error)
  }
  
  // Example 6: Text completion
  console.log('\n=== Text Completion Example ===')
  try {
    const completionResponse = await ollamaProvider.completion.create({
      prompt: 'The advantages of local AI deployment include',
      temperature: 0.8,
      maxTokens: 150,
      model: 'llama2'
    })
    
    console.log('Completion:', completionResponse.text)
    console.log('Tokens used:', completionResponse.usage.totalTokens)
  } catch (error) {
    console.error('Completion error:', error)
  }
  
  // Example 7: Embeddings (if embedding model is available)
  console.log('\n=== Embeddings Example ===')
  try {
    // First check if we have an embedding model
    const availableModels = ollamaProvider.getAvailableModels()
    const embeddingModel = availableModels.find(model => 
      model.includes('embed') || model.includes('nomic')
    ) || 'nomic-embed-text'
    
    console.log(`Using embedding model: ${embeddingModel}`)
    
    const embeddingResponse = await ollamaProvider.embedding.create({
      input: 'Local AI models provide privacy and control over your data.',
      model: embeddingModel
    })
    
    console.log('Embedding dimensions:', embeddingResponse.embeddings[0].length)
    console.log('First few values:', embeddingResponse.embeddings[0].slice(0, 5))
  } catch (error) {
    console.error('Embedding error:', error)
    console.log('You may need to pull an embedding model: ollama pull nomic-embed-text')
  }
  
  // Example 8: Multiple embeddings
  console.log('\n=== Multiple Embeddings Example ===')
  try {
    const multipleEmbeddings = await ollamaProvider.embedding.create({
      input: [
        'Local AI is private and secure',
        'Cloud AI is convenient and scalable',
        'Hybrid approaches combine both benefits'
      ],
      model: 'nomic-embed-text'
    })
    
    console.log('Number of embeddings:', multipleEmbeddings.embeddings.length)
    console.log('Embedding dimensions:', multipleEmbeddings.embeddings[0].length)
  } catch (error) {
    console.error('Multiple embeddings error:', error)
  }
  
  // Example 9: Code generation with CodeLlama
  console.log('\n=== Code Generation Example ===')
  try {
    const availableModels = ollamaProvider.getAvailableModels()
    const codeModel = availableModels.find(model => 
      model.includes('codellama') || model.includes('code')
    )
    
    if (codeModel) {
      const codeResponse = await ollamaProvider.completion.create({
        prompt: 'Write a Python function to calculate the factorial of a number:\n\ndef factorial(n):',
        model: codeModel,
        temperature: 0.2,
        maxTokens: 200
      })
      
      console.log(`Code generated by ${codeModel}:`)
      console.log('def factorial(n):' + codeResponse.text)
    } else {
      console.log('No code model available. Try: ollama pull codellama')
    }
  } catch (error) {
    console.error('Code generation error:', error)
  }
  
  // Example 10: Model comparison
  console.log('\n=== Model Comparison Example ===')
  const testPrompt = 'Explain quantum computing in one sentence.'
  const availableModels = ollamaProvider.getAvailableModels().slice(0, 3) // Test first 3 models
  
  for (const model of availableModels) {
    try {
      console.log(`\n--- Testing ${model} ---`)
      const start = Date.now()
      
      const response = await ollamaProvider.chat.create({
        messages: [
          {
            id: `test-${model}`,
            role: 'user',
            content: testPrompt,
            timestamp: new Date()
          }
        ],
        model,
        temperature: 0.3,
        maxTokens: 100
      })
      
      const duration = Date.now() - start
      console.log(`${model} response (${duration}ms):`, response.message.content)
      console.log(`Tokens: ${response.usage.totalTokens}`)
    } catch (error) {
      console.error(`Error with ${model}:`, error)
    }
  }
  
  console.log('\n=== Ollama Examples Complete ===')
  console.log('Tips:')
  console.log('- Use "ollama list" to see installed models')
  console.log('- Use "ollama pull <model>" to install new models')
  console.log('- Use "ollama rm <model>" to remove models')
  console.log('- Local models provide privacy but may be slower than cloud APIs')
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error)
}

export { exampleUsage }