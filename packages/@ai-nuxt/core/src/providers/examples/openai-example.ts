/**
 * Example usage of OpenAI provider
 * This file demonstrates how to use the OpenAI provider for various AI operations
 */

import { OpenAIProvider } from '../openai'
import { providerRegistry } from '../registry'
import type { ProviderConfig } from '../../types'

async function exampleUsage() {
  // Create and register the OpenAI provider
  const openaiProvider = new OpenAIProvider()
  providerRegistry.register(openaiProvider)
  
  // Configure the provider
  const config: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
  }
  
  await openaiProvider.initialize(config)
  
  // Example 1: Chat completion
  console.log('=== Chat Completion Example ===')
  try {
    const chatResponse = await openaiProvider.chat.create({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'What is the capital of France?',
          timestamp: new Date()
        }
      ],
      temperature: 0.7,
      maxTokens: 100
    })
    
    console.log('Chat Response:', chatResponse.message.content)
    console.log('Tokens used:', chatResponse.usage.totalTokens)
  } catch (error) {
    console.error('Chat completion error:', error)
  }
  
  // Example 2: Streaming chat completion
  console.log('\n=== Streaming Chat Example ===')
  try {
    const streamingMessages = [
      {
        id: '2',
        role: 'user' as const,
        content: 'Tell me a short story about a robot.',
        timestamp: new Date()
      }
    ]
    
    let fullResponse = ''
    for await (const chunk of openaiProvider.chat.stream({ messages: streamingMessages })) {
      if (!chunk.finished) {
        process.stdout.write(chunk.delta)
        fullResponse += chunk.delta
      }
    }
    console.log('\nFull response:', fullResponse)
  } catch (error) {
    console.error('Streaming error:', error)
  }
  
  // Example 3: Text completion
  console.log('\n=== Text Completion Example ===')
  try {
    const completionResponse = await openaiProvider.completion.create({
      prompt: 'The future of artificial intelligence is',
      temperature: 0.8,
      maxTokens: 50
    })
    
    console.log('Completion:', completionResponse.text)
    console.log('Tokens used:', completionResponse.usage.totalTokens)
  } catch (error) {
    console.error('Completion error:', error)
  }
  
  // Example 4: Embeddings
  console.log('\n=== Embeddings Example ===')
  try {
    const embeddingResponse = await openaiProvider.embedding.create({
      input: 'This is a sample text for embedding generation.',
      model: 'text-embedding-ada-002'
    })
    
    console.log('Embedding dimensions:', embeddingResponse.embeddings[0].length)
    console.log('First few values:', embeddingResponse.embeddings[0].slice(0, 5))
    console.log('Tokens used:', embeddingResponse.usage.totalTokens)
  } catch (error) {
    console.error('Embedding error:', error)
  }
  
  // Example 5: Multiple embeddings
  console.log('\n=== Multiple Embeddings Example ===')
  try {
    const multipleEmbeddings = await openaiProvider.embedding.create({
      input: [
        'First document to embed',
        'Second document to embed',
        'Third document to embed'
      ]
    })
    
    console.log('Number of embeddings:', multipleEmbeddings.embeddings.length)
    console.log('Total tokens used:', multipleEmbeddings.usage.totalTokens)
  } catch (error) {
    console.error('Multiple embeddings error:', error)
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error)
}

export { exampleUsage }