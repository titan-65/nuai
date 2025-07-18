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
      contentFiltering: false
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
        contentFiltering: false
      },
      debug: false
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
    
    // Add server handlers for AI API routes
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
    
    if (moduleOptions.streaming.enabled) {
      addServerHandler({
        route: '/api/ai/stream',
        handler: resolver.resolve('./runtime/server/api/stream.post')
      })
    }
    
    // Add composables auto-imports
    addImports([
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
      },
      {
        name: 'useAIEmbedding',
        from: resolver.resolve('./runtime/composables/useAIEmbedding')
      },
      {
        name: 'useAIStream',
        from: resolver.resolve('./runtime/composables/useAIStream')
      },
      {
        name: 'useAIProvider',
        from: resolver.resolve('./runtime/composables/useAIProvider')
      }
    ])
    
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