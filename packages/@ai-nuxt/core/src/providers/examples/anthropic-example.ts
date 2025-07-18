/**
 * Example usage of Anthropic provider
 * This file demonstrates how to use the Anthropic provider for various AI operations
 */

import { AnthropicProvider } from '../anthropic'
import { providerRegistry } from '../registry'
import type { ProviderConfig } from '../../types'

async function exampleUsage() {
  // Create and register the Anthropic provider
  const anthropicProvider = new AnthropicProvider()
  providerRegistry.register(anthropicProvider)
  
  // Configure the provider
  const config: ProviderConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
    options: {
      version: '2023-06-01' // Optional: specify API version
    }
  }
  
  await anthropicProvider.initialize(config)
  
  // Example 1: Chat completion with Claude
  console.log('=== Claude Chat Completion Example ===')
  try {
    const chatResponse = await anthropicProvider.chat.create({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'What are the key differences between Claude and other AI assistants?',
          timestamp: new Date()
        }
      ],
      temperature: 0.7,
      maxTokens: 200
    })
    
    console.log('Claude Response:', chatResponse.message.content)
    console.log('Tokens used:', chatResponse.usage.totalTokens)
    console.log('Model:', chatResponse.model)
  } catch (error) {
    console.error('Chat completion error:', error)
  }
  
  // Example 2: Chat with system prompt
  console.log('\n=== Chat with System Prompt Example ===')
  try {
    const systemChatResponse = await anthropicProvider.chat.create({
      messages: [
        {
          id: '2',
          role: 'user',
          content: 'Explain quantum computing in simple terms.',
          timestamp: new Date()
        }
      ],
      systemPrompt: 'You are a physics teacher explaining complex concepts to high school students. Use simple language and analogies.',
      temperature: 0.5,
      maxTokens: 300
    })
    
    console.log('System-guided response:', systemChatResponse.message.content)
  } catch (error) {
    console.error('System chat error:', error)
  }
  
  // Example 3: Streaming chat completion
  console.log('\n=== Streaming Chat Example ===')
  try {
    const streamingMessages = [
      {
        id: '3',
        role: 'user' as const,
        content: 'Write a short poem about artificial intelligence.',
        timestamp: new Date()
      }
    ]
    
    console.log('Streaming response:')
    let fullResponse = ''
    for await (const chunk of anthropicProvider.chat.stream({ messages: streamingMessages })) {
      if (!chunk.finished) {
        process.stdout.write(chunk.delta)
        fullResponse += chunk.delta
      } else {
        console.log('\n--- Stream completed ---')
      }
    }
    console.log('Full response:', fullResponse)
  } catch (error) {
    console.error('Streaming error:', error)
  }
  
  // Example 4: Text completion (legacy format)
  console.log('\n=== Text Completion Example ===')
  try {
    const completionResponse = await anthropicProvider.completion.create({
      prompt: 'The most important aspect of artificial intelligence ethics is',
      temperature: 0.8,
      maxTokens: 150,
      model: 'claude-2.1'
    })
    
    console.log('Completion:', completionResponse.text)
    console.log('Tokens used:', completionResponse.usage.totalTokens)
  } catch (error) {
    console.error('Completion error:', error)
  }
  
  // Example 5: Multi-turn conversation
  console.log('\n=== Multi-turn Conversation Example ===')
  try {
    const conversationMessages = [
      {
        id: '4',
        role: 'user' as const,
        content: 'What is machine learning?',
        timestamp: new Date()
      },
      {
        id: '5',
        role: 'assistant' as const,
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.',
        timestamp: new Date()
      },
      {
        id: '6',
        role: 'user' as const,
        content: 'Can you give me a practical example?',
        timestamp: new Date()
      }
    ]
    
    const conversationResponse = await anthropicProvider.chat.create({
      messages: conversationMessages,
      temperature: 0.6,
      maxTokens: 200
    })
    
    console.log('Conversation response:', conversationResponse.message.content)
  } catch (error) {
    console.error('Conversation error:', error)
  }
  
  // Example 6: Different Claude models
  console.log('\n=== Different Models Example ===')
  const models = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
  
  for (const model of models) {
    try {
      console.log(`\n--- Testing ${model} ---`)
      const modelResponse = await anthropicProvider.chat.create({
        messages: [
          {
            id: `test-${model}`,
            role: 'user',
            content: 'Explain the concept of recursion in one sentence.',
            timestamp: new Date()
          }
        ],
        model,
        temperature: 0.3,
        maxTokens: 100
      })
      
      console.log(`${model} response:`, modelResponse.message.content)
      console.log(`Tokens: ${modelResponse.usage.totalTokens}`)
    } catch (error) {
      console.error(`Error with ${model}:`, error)
    }
  }
  
  // Example 7: Error handling demonstration
  console.log('\n=== Error Handling Example ===')
  try {
    // This will fail because Anthropic doesn't support embeddings
    await anthropicProvider.embedding.create({
      input: 'This will fail'
    })
  } catch (error) {
    console.log('Expected error for embeddings:', (error as Error).message)
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error)
}

export { exampleUsage }