import type { NitroPreset } from 'nitropack'

/**
 * Vercel Edge Runtime preset for AI Nuxt
 */
export const vercelEdge: NitroPreset = {
  extends: 'vercel-edge',
  entry: './runtime/vercel-edge',
  
  // Vercel Edge Runtime specific configuration
  vercel: {
    config: {
      runtime: 'edge',
      regions: ['iad1', 'sfo1', 'fra1'], // Multi-region deployment
      memory: 128 // MB
    }
  },
  
  // Edge runtime optimizations
  experimental: {
    wasm: true
  },
  
  // Rollup configuration for Vercel Edge
  rollupConfig: {
    external: [
      // Vercel Edge Runtime compatible externals
      '@vercel/edge-config',
      '@vercel/kv',
      '@vercel/blob'
    ],
    output: {
      format: 'es'
    }
  },
  
  // AI Nuxt configuration for Vercel Edge
  aiNuxt: {
    providers: {
      // OpenAI optimized for Vercel Edge
      openai: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 12,
        timeout: 25000, // Vercel Edge timeout is 30s
        config: {
          baseURL: 'https://api.openai.com/v1',
          defaultHeaders: {
            'User-Agent': 'AI-Nuxt-Vercel-Edge/1.0'
          }
        }
      },
      
      // Anthropic for Vercel Edge
      anthropic: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 10,
        timeout: 25000,
        config: {
          baseURL: 'https://api.anthropic.com',
          defaultHeaders: {
            'User-Agent': 'AI-Nuxt-Vercel-Edge/1.0'
          }
        }
      },
      
      // Ollama not supported
      ollama: {
        enabled: false,
        edgeCompatible: false,
        reason: 'Not supported in Vercel Edge Runtime'
      }
    },
    
    // Vercel KV for caching
    caching: {
      provider: 'vercel-kv',
      config: {
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN
      },
      maxSize: 2000,
      ttl: 7200
    },
    
    // Vector store using Vercel Postgres or external service
    vectorStore: {
      provider: 'vercel-postgres',
      config: {
        connectionString: process.env.POSTGRES_URL,
        tableName: 'ai_vectors',
        dimensions: 1536
      }
    },
    
    // Monitoring with Vercel Analytics
    monitoring: {
      enabled: true,
      provider: 'vercel-analytics',
      config: {
        analyticsId: process.env.VERCEL_ANALYTICS_ID
      },
      metrics: {
        enableDetailedMetrics: true,
        sampleRate: 0.2
      }
    },
    
    // Edge-specific optimizations
    edge: {
      // Streaming optimizations
      streaming: {
        enabled: true,
        chunkSize: 1024,
        flushInterval: 100
      },
      
      // Memory optimizations
      memory: {
        maxCacheSize: 50, // MB
        gcInterval: 30000 // 30 seconds
      }
    }
  }
}