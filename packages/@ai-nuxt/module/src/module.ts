import { defineNuxtModule, addPlugin, addServerHandler, addImports, createResolver, addTemplate } from '@nuxt/kit'
import { defu } from 'defu'
import type { ModuleOptions } from '@ai-nuxt/core'

export interface AINuxtModuleOptions extends Partial<ModuleOptions> {
  // Module-specific options can be added here
}

export default defineNuxtModule<AINuxtModuleOptions>({
  meta: {
    name: '@ai-nuxt/module',
    configKey: 'aiNuxt',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    providers: [],
    defaultProvider: 'openai',
    streaming: {
      enabled: true,
      transport: 'sse'
    },
    caching: {
      enabled: true,
      semantic: false,
      ttl: 3600,
      maxSize: 100,
      semanticThreshold: 0.95
    },
    vectorStore: {
      provider: 'memory',
      config: {}
    },
    security: {
      promptInjectionDetection: false,
      piiScrubbing: false,
      contentFiltering: false,
      rateLimit: {
        enabled: false,
        maxRequests: 60,
        windowMs: 60000
      }
    },
    debug: false
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    
    // Merge user options with defaults
    const moduleOptions = defu(options, {
      providers: [],
      defaultProvider: 'openai',
      streaming: {
        enabled: true,
        transport: 'sse'
      },
      caching: {
        enabled: true,
        semantic: false,
        ttl: 3600,
        maxSize: 100,
        semanticThreshold: 0.95
      },
      vectorStore: {
        provider: 'memory',
        config: {}
      },
      security: {
        promptInjectionDetection: false,
        piiScrubbing: false,
        contentFiltering: false,
        rateLimit: {
          enabled: false,
          maxRequests: 60,
          windowMs: 60000
        }
      },
      debug: false,
      monitoring: {
        enabled: true,
        serviceName: 'ai-nuxt-app',
        serviceVersion: '1.0.0',
        enableMetrics: true,
        enableTracing: true,
        enableAlerts: true,
        sampleRate: 1.0,
        enableAutoInstrumentation: true,
        alertCheckInterval: 60000
      }
    }) as ModuleOptions
    
    // Add runtime config
    nuxt.options.runtimeConfig.aiNuxt = defu(nuxt.options.runtimeConfig.aiNuxt, {
      ...moduleOptions,
      // Server-only config
      apiKeys: {}
    })
    
    // Add public runtime config
    nuxt.options.runtimeConfig.public.aiNuxt = defu(nuxt.options.runtimeConfig.public.aiNuxt, {
      defaultProvider: moduleOptions.defaultProvider,
      streaming: moduleOptions.streaming,
      caching: {
        enabled: moduleOptions.caching.enabled,
        ttl: moduleOptions.caching.ttl
      },
      debug: moduleOptions.debug
    })
    
    // Add plugin for client-side initialization
    addPlugin(resolver.resolve('./runtime/plugin.client'))
    
    // Add plugin for server-side initialization
    addPlugin(resolver.resolve('./runtime/plugin.server'))
    
    // Add Pinia plugin for state management
    addPlugin(resolver.resolve('./runtime/plugins/pinia.client'))
    
    // Add monitoring plugin for client-side
    if (moduleOptions.monitoring?.enabled !== false) {
      addPlugin(resolver.resolve('./runtime/plugins/monitoring.client'))
    }
    
    // Add performance monitoring plugin in development
    if (nuxt.options.dev || moduleOptions.debug) {
      addPlugin(resolver.resolve('./runtime/plugins/performance.client'))
    }
    
    // Add middleware for AI routes
    if (moduleOptions.security?.rateLimit?.enabled) {
      addServerHandler({
        route: '/api/ai/**',
        handler: resolver.resolve('./runtime/server/middleware/rate-limit'),
        middleware: true
      })
    }
    
    if (moduleOptions.caching?.enabled) {
      addServerHandler({
        route: '/api/ai/**',
        handler: resolver.resolve('./runtime/server/middleware/cache'),
        middleware: true
      })
    }
    
    if (moduleOptions.debug) {
      addServerHandler({
        route: '/api/ai/**',
        handler: resolver.resolve('./runtime/server/middleware/logger'),
        middleware: true
      })
    }
    
    if (moduleOptions.security && (
      moduleOptions.security.promptInjectionDetection ||
      moduleOptions.security.piiScrubbing ||
      moduleOptions.security.contentFiltering
    )) {
      addServerHandler({
        route: '/api/ai/**',
        handler: resolver.resolve('./runtime/server/middleware/security'),
        middleware: true
      })
    }
    
    // Add monitoring middleware
    if (moduleOptions.monitoring?.enabled !== false) {
      addServerHandler({
        route: '/**',
        handler: resolver.resolve('./runtime/server/middleware/monitoring'),
        middleware: true
      })
    }
    
    // Add authentication middleware
    addServerHandler({
      route: '/api/ai/**',
      handler: resolver.resolve('./runtime/server/middleware/ai-auth'),
      middleware: true
    })
    
    // Add server handlers for AI API routes
    addServerHandler({
      route: '/api/ai/health',
      handler: resolver.resolve('./runtime/server/api/health.get')
    })
    
    addServerHandler({
      route: '/api/ai/providers',
      handler: resolver.resolve('./runtime/server/api/providers.get')
    })
    
    addServerHandler({
      route: '/api/ai/chat',
      handler: resolver.resolve('./runtime/server/api/chat.post')
    })
    
    addServerHandler({
      route: '/api/ai/completion',
      handler: resolver.resolve('./runtime/server/api/completion.post')
    })
    
    addServerHandler({
      route: '/api/ai/embedding',
      handler: resolver.resolve('./runtime/server/api/embedding.post')
    })
    
    // Add monitoring API routes
    if (moduleOptions.monitoring?.enabled !== false) {
      addServerHandler({
        route: '/api/monitoring/health',
        handler: resolver.resolve('./runtime/server/api/monitoring/health.get')
      })
      
      addServerHandler({
        route: '/api/monitoring/metrics',
        handler: resolver.resolve('./runtime/server/api/monitoring/metrics.get')
      })
    }
    
    if (moduleOptions.streaming.enabled) {
      addServerHandler({
        route: '/api/ai/stream',
        handler: resolver.resolve('./runtime/server/api/stream.post')
      })
      
      // Add WebSocket handler for bidirectional streaming
      if (moduleOptions.streaming.transport === 'websocket' || moduleOptions.streaming.transport === 'sse') {
        addServerHandler({
          route: '/api/ai/ws',
          handler: resolver.resolve('./runtime/server/api/ws')
        })
      }
    }
    
    // Add core composables auto-imports (always available)
    const coreImports = [
      {
        name: 'useAI',
        from: resolver.resolve('./runtime/composables/useAI')
      },
      {
        name: 'useAIChat',
        from: resolver.resolve('./runtime/composables/useAIChat')
      },
      {
        name: 'useAICompletion',
        from: resolver.resolve('./runtime/composables/useAICompletion')
      }
    ]
    
    // Add optional composables based on configuration
    const optionalImports = []
    
    if (moduleOptions.streaming?.enabled) {
      optionalImports.push(
        {
          name: 'useAIStream',
          from: resolver.resolve('./runtime/composables/useAIStream')
        },
        {
          name: 'useAIStreamingChat',
          from: resolver.resolve('./runtime/composables/useAIStreamingChat')
        }
      )
      
      if (moduleOptions.streaming.transport === 'websocket') {
        optionalImports.push({
          name: 'useAISocket',
          from: resolver.resolve('./runtime/composables/useAISocket')
        })
      }
    }
    
    if (moduleOptions.caching?.enabled) {
      optionalImports.push({
        name: 'useAICache',
        from: resolver.resolve('./runtime/composables/useAICache')
      })
    }
    
    if (moduleOptions.vectorStore) {
      optionalImports.push({
        name: 'useAIVectorStore',
        from: resolver.resolve('./runtime/composables/useAIVectorStore')
      })
      
      optionalImports.push({
        name: 'useAIRAG',
        from: resolver.resolve('./runtime/composables/useAIRAG')
      })
    }
    
    // Always add store composables
    optionalImports.push(
      {
        name: 'useAIStore',
        from: resolver.resolve('./runtime/composables/useAIStore')
      },
      {
        name: 'useAIChatStore',
        from: resolver.resolve('./runtime/composables/useAIChatStore')
      }
    )
    
    // Add performance monitoring in development or when debug is enabled
    if (nuxt.options.dev || moduleOptions.debug) {
      optionalImports.push({
        name: 'useAIPerformance',
        from: resolver.resolve('./runtime/composables/useAIPerformance')
      })
    }
    
    addImports([...coreImports, ...optionalImports])
    
    // Add types template
    addTemplate({
      filename: 'types/ai-nuxt.d.ts',
      getContents: () => `
import type { ModuleOptions } from '@ai-nuxt/core'

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    aiNuxt: ModuleOptions & {
      apiKeys: Record<string, string>
    }
  }
  interface PublicRuntimeConfig {
    aiNuxt: {
      defaultProvider: string
      streaming: {
        enabled: boolean
        transport: 'sse' | 'websocket'
      }
      caching: {
        enabled: boolean
        ttl: number
      }
      debug: boolean
    }
  }
}

declare module 'nuxt/app' {
  interface NuxtApp {
    $ai: {
      initialized: boolean
      providers: string[]
    }
  }
}

export {}
      `
    })
    
    // Add components directory for auto-registration
    nuxt.hook('components:dirs', (dirs) => {
      dirs.push({
        path: resolver.resolve('./runtime/components'),
        prefix: 'AI'
      })
    })
    
    // Add CSS for components (if needed)
    if (nuxt.options.css) {
      nuxt.options.css.push(resolver.resolve('./runtime/assets/ai-nuxt.css'))
    }
    
    // Development mode enhancements
    if (nuxt.options.dev && moduleOptions.debug) {
      console.log('🤖 AI Nuxt module loaded with options:', moduleOptions)
    }
  }
})