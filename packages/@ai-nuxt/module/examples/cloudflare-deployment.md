# Cloudflare Workers Deployment Guide

This guide shows how to deploy AI Nuxt applications to Cloudflare Workers.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed
- AI Nuxt project

## Configuration

### 1. Install Dependencies

```bash
npm install @ai-nuxt/module
```

### 2. Configure Nuxt

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-workers',
    // Use AI Nuxt's Cloudflare preset
    experimental: {
      wasm: true
    }
  },
  
  aiNuxt: {
    // Edge-optimized configuration
    providers: {
      openai: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 10
      },
      anthropic: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 8
      }
    },
    
    // Cloudflare KV for caching
    caching: {
      provider: 'cloudflare-kv',
      maxSize: 1000,
      ttl: 3600
    },
    
    // Cloudflare Vectorize for vector storage
    vectorStore: {
      provider: 'cloudflare-vectorize',
      config: {
        indexName: 'ai-nuxt-vectors',
        dimensions: 1536
      }
    },
    
    // Monitoring with Cloudflare Analytics
    monitoring: {
      enabled: true,
      provider: 'cloudflare-analytics',
      metrics: {
        enableDetailedMetrics: false,
        sampleRate: 0.1
      }
    }
  }
})
```

### 3. Wrangler Configuration

```toml
# wrangler.toml
name = "ai-nuxt-app"
main = ".output/server/index.mjs"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "ai-nuxt-app-prod"

[env.production.vars]
NODE_ENV = "production"
AI_NUXT_SERVICE_NAME = "ai-nuxt-cloudflare"
AI_NUXT_VERSION = "1.0.0"
AI_NUXT_SAMPLE_RATE = "0.1"

# KV Namespaces
[[env.production.kv_namespaces]]
binding = "AI_NUXT_CACHE"
id = "your-kv-namespace-id"

# Vectorize Indexes
[[env.production.vectorize]]
binding = "AI_VECTORS"
index_name = "ai-nuxt-vectors"

# Secrets (set via wrangler secret put)
# OPENAI_API_KEY
# ANTHROPIC_API_KEY
```

### 4. Environment Variables

Set your secrets using Wrangler:

```bash
# Set API keys
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY

# Set other environment variables
wrangler secret put AI_NUXT_CACHE_TTL --env production
```

### 5. Build and Deploy

```bash
# Build for Cloudflare Workers
npm run build

# Deploy to Cloudflare
wrangler deploy --env production
```

## Features Available on Cloudflare Workers

### ✅ Supported Features

- **AI Providers**: OpenAI, Anthropic
- **Caching**: Cloudflare KV
- **Vector Storage**: Cloudflare Vectorize
- **Monitoring**: Cloudflare Analytics
- **Streaming**: Server-Sent Events
- **Edge Locations**: Global distribution

### ❌ Limitations

- **Local Models**: Ollama not supported
- **File System**: No persistent file storage
- **WebSockets**: Limited support
- **Memory**: 128MB limit
- **Execution Time**: 30 second limit

## Performance Optimizations

### 1. Reduce Bundle Size

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    rollupConfig: {
      external: [
        // Externalize large dependencies
        'node:crypto',
        'node:buffer'
      ]
    }
  }
})
```

### 2. Optimize Caching

```typescript
// Use aggressive caching for edge
aiNuxt: {
  caching: {
    provider: 'cloudflare-kv',
    maxSize: 2000,
    ttl: 7200, // 2 hours
    semanticThreshold: 0.9 // Higher threshold for better cache hits
  }
}
```

### 3. Configure Rate Limiting

```typescript
aiNuxt: {
  security: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    }
  }
}
```

## Monitoring and Debugging

### 1. View Logs

```bash
# Stream logs
wrangler tail --env production

# View specific function logs
wrangler tail --env production --format pretty
```

### 2. Analytics

Access Cloudflare Analytics dashboard to monitor:
- Request volume
- Error rates
- Response times
- Geographic distribution

### 3. Health Checks

Your deployed app will have health endpoints:
- `https://your-app.workers.dev/api/monitoring/health`
- `https://your-app.workers.dev/api/monitoring/metrics`

## Troubleshooting

### Common Issues

1. **Bundle Size Too Large**
   - Use external dependencies
   - Enable tree shaking
   - Remove unused providers

2. **Memory Limits**
   - Reduce cache size
   - Optimize data structures
   - Use streaming for large responses

3. **Timeout Issues**
   - Reduce AI model timeout
   - Use faster models
   - Implement request queuing

### Debug Mode

```typescript
// Enable debug mode for development
aiNuxt: {
  debug: true,
  monitoring: {
    enabled: true,
    metrics: {
      enableDetailedMetrics: true
    }
  }
}
```

## Example API Usage

```typescript
// pages/api/chat.post.ts
export default defineEventHandler(async (event) => {
  const { message } = await readBody(event)
  
  const { chat } = useAI()
  
  const response = await chat([
    { role: 'user', content: message }
  ], {
    model: 'gpt-3.5-turbo',
    temperature: 0.7
  })
  
  return { response: response.content }
})
```

## Cost Optimization

### 1. Use Appropriate Models

```typescript
// Use cost-effective models for simple tasks
const response = await chat(messages, {
  model: 'gpt-3.5-turbo', // Cheaper than GPT-4
  maxTokens: 150 // Limit token usage
})
```

### 2. Implement Caching

```typescript
// Cache frequently requested completions
const cacheKey = `completion:${hashPrompt(prompt)}`
const cached = await cache.get(cacheKey)

if (cached) {
  return cached
}

const result = await completion(prompt)
await cache.set(cacheKey, result, 3600)
```

### 3. Monitor Usage

Set up alerts for:
- High API usage
- Expensive model usage
- Cache miss rates
- Error rates

## Security Best Practices

1. **API Key Management**
   - Use Wrangler secrets
   - Rotate keys regularly
   - Monitor usage

2. **Rate Limiting**
   - Implement per-user limits
   - Use Cloudflare's built-in DDoS protection
   - Monitor for abuse

3. **Input Validation**
   - Validate all inputs
   - Sanitize user content
   - Implement content filtering

## Next Steps

- Set up custom domains
- Configure SSL certificates
- Implement A/B testing
- Add custom analytics
- Scale to multiple regions