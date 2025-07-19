export default defineEventHandler(async (event) => {
  const url = getRouterParam(event, 'path') || ''
  
  // Handle different API endpoints
  if (url.startsWith('api/')) {
    const apiPath = url.replace('api/', '')
    
    switch (apiPath) {
      case 'requests':
        return await handleRequestsAPI(event)
      case 'providers':
        return await handleProvidersAPI(event)
      case 'cache/items':
        return await handleCacheItemsAPI(event)
      case 'cache/stats':
        return await handleCacheStatsAPI(event)
      case 'models':
        return await handleModelsAPI(event)
      case 'settings':
        return await handleSettingsAPI(event)
      case 'playground/models':
        return await handlePlaygroundModelsAPI(event)
      case 'playground/templates':
        return await handlePlaygroundTemplatesAPI(event)
      case 'playground/completion':
        return await handlePlaygroundCompletionAPI(event)
      default:
        throw createError({
          statusCode: 404,
          statusMessage: 'API endpoint not found'
        })
    }
  }
  
  // Serve the DevTools UI
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Nuxt DevTools</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="app">
        <div class="loading">Loading AI Nuxt DevTools...</div>
      </div>
      <script type="module">
        import { createApp } from 'vue'
        
        const DevTools = {
          template: \`
            <div style="padding: 2rem; text-align: center;">
              <h1>AI Nuxt DevTools</h1>
              <p>DevTools interface would be rendered here</p>
              <p>This is a placeholder implementation</p>
            </div>
          \`
        }
        
        createApp(DevTools).mount('#app')
      </script>
    </body>
    </html>
  `
})

// API Handlers
async function handleRequestsAPI(event: any) {
  const method = getMethod(event)
  
  if (method === 'GET') {
    // Return mock requests data
    return [
      {
        id: '1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        operation: 'chat',
        prompt: 'Hello, how are you?',
        response: 'I am doing well, thank you!',
        status: 'success',
        timestamp: new Date().toISOString(),
        duration: 1250,
        tokens: 25,
        cost: 0.0001,
        options: { temperature: 0.7 }
      }
    ]
  } else if (method === 'DELETE') {
    // Clear all requests
    return { success: true }
  }
  
  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
}

async function handleProvidersAPI(event: any) {
  return [
    {
      id: 'openai',
      name: 'OpenAI',
      active: true,
      stats: { requests: 42, errors: 2, avgLatency: 1250, cost: 0.0234 },
      models: [
        { id: 'gpt-4', name: 'GPT-4', type: 'chat' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', type: 'chat' }
      ],
      config: { apiKey: 'sk-1234567890abcdef' }
    }
  ]
}

async function handleCacheItemsAPI(event: any) {
  return [
    {
      key: 'ai:completion:gpt-3.5-turbo:hash123',
      type: 'completion',
      value: 'This is a cached AI response...',
      size: 1024,
      created: new Date(Date.now() - 3600000).toISOString(),
      expires: new Date(Date.now() + 3600000).toISOString(),
      hits: 5,
      ttl: 3600,
      metadata: { model: 'gpt-3.5-turbo', tokens: 150 }
    }
  ]
}

async function handleCacheStatsAPI(event: any) {
  return {
    size: 15,
    hits: 127,
    misses: 23,
    hitRate: 84.7
  }
}

async function handleModelsAPI(event: any) {
  return [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      type: 'chat',
      active: true,
      contextLength: 8192,
      maxOutput: 4096,
      pricing: { input: 0.03, output: 0.06 },
      capabilities: ['chat', 'completion', 'function-calling'],
      stats: { requests: 25, avgLatency: 1450, successRate: 96.0, totalCost: 0.0156 }
    }
  ]
}

async function handleSettingsAPI(event: any) {
  const method = getMethod(event)
  
  if (method === 'GET') {
    return {
      devtools: { enabled: true, autoRefresh: true, theme: 'auto' },
      monitoring: { enabled: true, maxRequests: 100, includePrompts: true, includeResponses: true },
      cache: { enabled: true, defaultTTL: 3600, maxSize: 100 },
      performance: { enableMetrics: true, metricsRetention: 24, enableAlerts: true, alertThreshold: 2000 },
      debug: { enabled: false, logLevel: 'info' }
    }
  } else if (method === 'POST') {
    const body = await readBody(event)
    // Save settings (in a real implementation, this would persist to storage)
    return { success: true }
  } else if (method === 'DELETE') {
    // Reset to defaults
    return { success: true }
  }
  
  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
}

async function handlePlaygroundModelsAPI(event: any) {
  return [
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' }
  ]
}

async function handlePlaygroundTemplatesAPI(event: any) {
  const method = getMethod(event)
  
  if (method === 'GET') {
    return [
      {
        id: '1',
        name: 'Code Review',
        systemPrompt: 'You are a senior software engineer reviewing code.',
        userPrompt: 'Please review this code:\\n\\n```javascript\\n// Your code here\\n```',
        config: { provider: 'openai', model: 'gpt-4', temperature: 0.3 }
      }
    ]
  } else if (method === 'POST') {
    const template = await readBody(event)
    // Save template (in a real implementation, this would persist to storage)
    return { success: true, id: template.id }
  }
  
  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
}

async function handlePlaygroundCompletionAPI(event: any) {
  const request = await readBody(event)
  
  // Mock completion response
  return {
    content: 'This is a mock response from the AI model. In a real implementation, this would call the actual AI provider.',
    usage: {
      total_tokens: 50,
      prompt_tokens: 25,
      completion_tokens: 25
    },
    cost: 0.0001
  }
}