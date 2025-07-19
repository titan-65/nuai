# Configuration Guide

This guide covers all configuration options available in AI Nuxt.

## Basic Configuration

### Module Registration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@ai-nuxt/module'
  ],
  
  aiNuxt: {
    // Your configuration here
  }
})
```

### Environment Variables

AI Nuxt supports configuration through environment variables:

```bash
# .env
# AI Provider API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
OLLAMA_HOST=http://localhost:11434

# AI Nuxt Configuration
AI_NUXT_DEFAULT_PROVIDER=openai
AI_NUXT_DEBUG=true
AI_NUXT_CACHE_ENABLED=true
AI_NUXT_STREAMING_ENABLED=true

# Monitoring
AI_NUXT_MONITORING_ENABLED=true
AI_NUXT_TELEMETRY_ENDPOINT=https://api.honeycomb.io
AI_NUXT_TELEMETRY_API_KEY=your-telemetry-key
```

## Provider Configuration

### OpenAI Configuration

```typescript
aiNuxt: {
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1', // Optional: custom endpoint
      organization: 'your-org-id', // Optional: organization ID
      
      models: {
        chat: 'gpt-4',
        completion: 'gpt-3.5-turbo',
        embedding: 'text-embedding-ada-002'
      },
      
      defaultOptions: {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
      },
      
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000
      }
    }
  }
}
```

### Anthropic Configuration

```typescript
aiNuxt: {
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com', // Optional: custom endpoint
      
      models: {
        chat: 'claude-3-opus-20240229',
        completion: 'claude-3-sonnet-20240229'
      },
      
      defaultOptions: {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 1
      },
      
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      }
    }
  }
}
```

### Ollama Configuration

```typescript
aiNuxt: {
  providers: {
    ollama: {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      
      models: {
        chat: 'llama2',
        completion: 'codellama',
        embedding: 'nomic-embed-text'
      },
      
      defaultOptions: {
        temperature: 0.7,
        numPredict: 1000,
        topK: 40,
        topP: 0.9
      },
      
      timeout: 30000 // 30 seconds
    }
  }
}
```

## Caching Configuration

### Basic Caching

```typescript
aiNuxt: {
  caching: {
    enabled: true,
    ttl: 3600, // Time to live in seconds (1 hour)
    maxSize: 100, // Maximum number of cached items
    
    // Cache key generation
    keyGenerator: (prompt, options) => {
      return `${prompt}-${JSON.stringify(options)}`
    }
  }
}
```

### Semantic Caching

```typescript
aiNuxt: {
  caching: {
    enabled: true,
    semantic: true,
    semanticThreshold: 0.95, // Similarity threshold (0-1)
    
    // Embedding model for semantic similarity
    embeddingModel: 'text-embedding-ada-002',
    
    // Cache providers
    providers: {
      memory: {
        enabled: true,
        maxSize: 1000
      },
      redis: {
        enabled: false,
        url: process.env.REDIS_URL
      }
    }
  }
}
```

### Multi-Layer Caching

```typescript
aiNuxt: {
  caching: {
    enabled: true,
    layers: [
      {
        name: 'memory',
        provider: 'memory',
        ttl: 300, // 5 minutes
        maxSize: 50
      },
      {
        name: 'redis',
        provider: 'redis',
        ttl: 3600, // 1 hour
        url: process.env.REDIS_URL
      },
      {
        name: 'semantic',
        provider: 'semantic',
        ttl: 86400, // 24 hours
        threshold: 0.95
      }
    ]
  }
}
```

## Streaming Configuration

### Server-Sent Events (SSE)

```typescript
aiNuxt: {
  streaming: {
    enabled: true,
    transport: 'sse',
    
    // SSE configuration
    sse: {
      heartbeatInterval: 30000, // 30 seconds
      maxConnections: 100,
      cors: {
        origin: '*',
        credentials: true
      }
    }
  }
}
```

### WebSocket Configuration

```typescript
aiNuxt: {
  streaming: {
    enabled: true,
    transport: 'websocket',
    
    // WebSocket configuration
    websocket: {
      port: 3001,
      path: '/ai-websocket',
      maxConnections: 50,
      pingInterval: 25000,
      pongTimeout: 5000
    }
  }
}
```

## Vector Store Configuration

### Memory Vector Store

```typescript
aiNuxt: {
  vectorStore: {
    provider: 'memory',
    config: {
      dimensions: 1536, // OpenAI embedding dimensions
      similarity: 'cosine', // 'cosine', 'euclidean', 'dot'
      indexType: 'flat' // 'flat', 'ivf'
    }
  }
}
```

### External Vector Store

```typescript
aiNuxt: {
  vectorStore: {
    provider: 'pinecone',
    config: {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
      indexName: 'ai-nuxt-vectors',
      dimensions: 1536
    }
  }
}
```

## Security Configuration

### Rate Limiting

```typescript
aiNuxt: {
  security: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      
      // Per-user rate limiting
      keyGenerator: (req) => req.ip,
      
      // Custom rate limits per endpoint
      endpoints: {
        '/api/ai/chat': { maxRequests: 50, windowMs: 60000 },
        '/api/ai/completion': { maxRequests: 30, windowMs: 60000 }
      }
    }
  }
}
```

### Content Filtering

```typescript
aiNuxt: {
  security: {
    contentFiltering: {
      enabled: true,
      
      // Input filtering
      input: {
        maxLength: 10000,
        blockedPatterns: [
          /harmful-pattern/i,
          /inappropriate-content/i
        ]
      },
      
      // Output filtering
      output: {
        enabled: true,
        moderationModel: 'text-moderation-latest'
      }
    }
  }
}
```

### PII Scrubbing

```typescript
aiNuxt: {
  security: {
    piiScrubbing: {
      enabled: true,
      
      patterns: {
        email: true,
        phone: true,
        ssn: true,
        creditCard: true,
        
        // Custom patterns
        custom: [
          {
            name: 'api-key',
            pattern: /sk-[a-zA-Z0-9]{48}/g,
            replacement: '[API_KEY_REDACTED]'
          }
        ]
      }
    }
  }
}
```

## Monitoring Configuration

### OpenTelemetry

```typescript
aiNuxt: {
  monitoring: {
    enabled: true,
    serviceName: 'my-ai-app',
    serviceVersion: '1.0.0',
    environment: process.env.NODE_ENV,
    
    // OpenTelemetry configuration
    telemetry: {
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      apiKey: process.env.OTEL_EXPORTER_OTLP_HEADERS,
      sampleRate: 0.1, // 10% sampling
      
      // Enable/disable features
      enableTracing: true,
      enableMetrics: true,
      enableLogs: true
    }
  }
}
```

### Custom Metrics

```typescript
aiNuxt: {
  monitoring: {
    metrics: {
      enabled: true,
      
      // Custom metrics
      custom: [
        {
          name: 'ai_request_cost',
          type: 'histogram',
          description: 'Cost of AI requests in USD',
          labels: ['provider', 'model']
        },
        {
          name: 'ai_cache_hit_rate',
          type: 'gauge',
          description: 'Cache hit rate percentage'
        }
      ]
    }
  }
}
```

### Alerting

```typescript
aiNuxt: {
  monitoring: {
    alerts: {
      enabled: true,
      
      rules: [
        {
          name: 'High Error Rate',
          condition: 'error_rate > 0.05',
          duration: '5m',
          severity: 'warning',
          channels: ['email', 'slack']
        },
        {
          name: 'High Latency',
          condition: 'avg_latency > 2000',
          duration: '2m',
          severity: 'critical',
          channels: ['email', 'pagerduty']
        }
      ],
      
      channels: {
        email: {
          enabled: true,
          to: ['admin@example.com'],
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          }
        },
        
        slack: {
          enabled: true,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts'
        }
      }
    }
  }
}
```

## Edge Deployment Configuration

### Cloudflare Workers

```typescript
aiNuxt: {
  edge: {
    platform: 'cloudflare',
    
    // Cloudflare-specific configuration
    cloudflare: {
      kv: {
        namespace: 'AI_CACHE',
        ttl: 3600
      },
      
      vectorize: {
        indexName: 'ai-vectors',
        dimensions: 1536
      },
      
      analytics: {
        enabled: true,
        datasetId: 'ai-nuxt-analytics'
      }
    }
  }
}
```

### Vercel Edge

```typescript
aiNuxt: {
  edge: {
    platform: 'vercel',
    
    // Vercel-specific configuration
    vercel: {
      kv: {
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN
      },
      
      postgres: {
        url: process.env.POSTGRES_URL
      },
      
      analytics: {
        enabled: true,
        id: process.env.VERCEL_ANALYTICS_ID
      }
    }
  }
}
```

## Development Configuration

### Debug Mode

```typescript
aiNuxt: {
  debug: true, // Enable debug mode
  
  // Development-specific settings
  development: {
    mockResponses: false, // Use mock responses instead of real API calls
    logLevel: 'debug', // 'error', 'warn', 'info', 'debug'
    
    // Development server configuration
    devServer: {
      port: 3000,
      host: 'localhost'
    }
  }
}
```

### Testing Configuration

```typescript
aiNuxt: {
  testing: {
    enabled: true,
    
    // Mock providers for testing
    mockProviders: {
      openai: {
        responses: {
          chat: 'Mock chat response',
          completion: 'Mock completion response',
          embedding: [0.1, 0.2, 0.3] // Mock embedding
        }
      }
    },
    
    // Test utilities
    utilities: {
      snapshotTesting: true,
      responseValidation: true
    }
  }
}
```

## Runtime Configuration

### Server-Side Configuration

```typescript
// Server-only configuration (not exposed to client)
export default defineNuxtConfig({
  runtimeConfig: {
    aiNuxt: {
      // Server-side secrets
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY
      },
      
      // Database connections
      database: {
        url: process.env.DATABASE_URL
      }
    }
  }
})
```

### Client-Side Configuration

```typescript
// Client-side configuration (exposed to browser)
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      aiNuxt: {
        defaultProvider: 'openai',
        streaming: {
          enabled: true,
          transport: 'sse'
        },
        debug: false
      }
    }
  }
})
```

## Configuration Validation

AI Nuxt automatically validates your configuration and provides helpful error messages:

```typescript
// Invalid configuration example
aiNuxt: {
  providers: {
    openai: {
      // Missing required apiKey
      models: {
        chat: 'invalid-model-name' // Invalid model
      }
    }
  },
  
  caching: {
    ttl: -1 // Invalid TTL
  }
}
```

Error output:
```
[AI Nuxt] Configuration Error:
- providers.openai.apiKey is required
- providers.openai.models.chat: "invalid-model-name" is not a valid OpenAI model
- caching.ttl must be a positive number
```

## Configuration Best Practices

1. **Use Environment Variables** for sensitive data like API keys
2. **Enable Caching** for production to reduce API costs
3. **Configure Rate Limiting** to prevent abuse
4. **Enable Monitoring** for production deployments
5. **Use Debug Mode** only in development
6. **Validate Configuration** before deployment
7. **Keep Secrets Secure** - never commit API keys to version control

## Next Steps

- [Providers Guide](./providers.md) - Learn about AI provider configuration
- [Caching Guide](./caching.md) - Deep dive into caching strategies
- [Security Guide](./security.md) - Security best practices
- [Monitoring Guide](./monitoring.md) - Observability and monitoring