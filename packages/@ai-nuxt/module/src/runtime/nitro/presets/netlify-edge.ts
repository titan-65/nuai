import type { NitroPreset } from 'nitropack'

/**
 * Netlify Edge Functions preset for AI Nuxt
 */
export const netlifyEdge: NitroPreset = {
  extends: 'netlify-edge',
  entry: './runtime/netlify-edge',
  
  // Netlify Edge Functions configuration
  netlify: {
    config: {
      edge_functions: [{
        function: 'ai-nuxt-handler',
        path: '/api/ai/*'
      }]
    }
  },
  
  // Rollup configuration for Netlify Edge
  rollupConfig: {
    external: [
      // Netlify Edge compatible externals
      'netlify:edge'
    ],
    output: {
      format: 'es'
    }
  },
  
  // AI Nuxt configuration for Netlify Edge
  aiNuxt: {
    providers: {
      // OpenAI for Netlify Edge
      openai: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 8,
        timeout: 20000, // Netlify Edge timeout considerations
        config: {
          baseURL: 'https://api.openai.com/v1',
          defaultHeaders: {
            'User-Agent': 'AI-Nuxt-Netlify-Edge/1.0'
          }
        }
      },
      
      // Anthropic for Netlify Edge
      anthropic: {
        enabled: true,
        edgeCompatible: true,
        maxConcurrency: 6,
        timeout: 20000,
        config: {
          baseURL: 'https://api.anthropic.com',
          defaultHeaders: {
            'User-Agent': 'AI-Nuxt-Netlify-Edge/1.0'
          }
        }
      },
      
      // Ollama not supported
      ollama: {
        enabled: false,
        edgeCompatible: false,
        reason: 'Not supported in Netlify Edge Functions'
      }
    },
    
    // Netlify Blobs for caching
    caching: {
      provider: 'netlify-blobs',
      config: {
        siteId: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_TOKEN
      },
      maxSize: 1500,
      ttl: 5400
    },
    
    // Vector store using external service
    vectorStore: {
      provider: 'supabase',
      config: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_ANON_KEY,
        tableName: 'ai_vectors'
      }
    },
    
    // Monitoring with Netlify Analytics
    monitoring: {
      enabled: true,
      provider: 'netlify-analytics',
      metrics: {
        enableDetailedMetrics: false,
        sampleRate: 0.15
      }
    },
    
    // Edge-specific settings
    edge: {
      // Geolocation-based routing
      geo: {
        enabled: true,
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1']
      },
      
      // Performance optimizations
      performance: {
        maxExecutionTime: 10000, // 10 seconds
        memoryLimit: 128 // MB
      }
    }
  }
}