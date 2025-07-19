import type { NitroPreset } from 'nitropack'

/**
 * Cloudflare Workers preset for AI Nuxt
 */
export const cloudflareWorkers: NitroPreset = {
  extends: 'cloudflare',
  entry: './runtime/cloudflare-workers',
  
  // Cloudflare Workers specific configuration
  wasm: {
    lazy: false,
    esmImport: true
  },
  
  // AI Nuxt specific optimizations for Cloudflare Workers
  experimental: {
    wasm: true
  },
  
  // Environment variables and bindings
  cloudflare: {
    pages: {
      routes: {
        include: ['/*'],
        exclude: ['/api/monitoring/*']
      }
    }
  },
  
  // Rollup configuration for edge compatibility
  rollupConfig: {
    external: [
      // External dependencies that should be handled by Cloudflare
      'node:crypto',
      'node:buffer',
      'node:stream'
    ],
    output: {
      format: 'es'
    }
  },
  
  // AI provider configurations for edge
  aiNuxt: {
    providers: {
      // OpenAI works well on edge
      openai: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 10
      },
      // Anthropic works on edge
      anthropic: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 8
      },
      // Ollama not supported on edge (requires local runtime)
      ollama: {
        enabled: false,
        edgeCompatible: false,
        reason: 'Requires local model runtime'
      }
    },
    
    // Edge-optimized caching
    caching: {
      provider: 'cloudflare-kv',
      maxSize: 1000, // Smaller cache for edge
      ttl: 3600
    },
    
    // Vector store configuration for edge
    vectorStore: {
      provider: 'cloudflare-vectorize',
      config: {
        indexName: 'ai-nuxt-vectors',
        dimensions: 1536
      }
    },
    
    // Monitoring configuration for edge
    monitoring: {
      enabled: true,
      provider: 'cloudflare-analytics',
      metrics: {
        // Reduced metrics for edge performance
        enableDetailedMetrics: false,
        sampleRate: 0.1
      }
    }
  }
}