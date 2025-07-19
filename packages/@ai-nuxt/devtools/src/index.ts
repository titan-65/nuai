import { defineNuxtModule } from '@nuxt/kit'
import { addCustomTab } from '@nuxt/devtools-kit'
import { resolve } from 'pathe'

export interface ModuleOptions {
  /**
   * Enable AI Nuxt DevTools
   * @default true
   */
  enabled?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@ai-nuxt/devtools',
    configKey: 'aiNuxtDevtools',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    enabled: true
  },
  setup(options, nuxt) {
    if (!options.enabled) {
      return
    }

    // Add AI Nuxt DevTools client
    nuxt.hook('devtools:customTabs', (tabs) => {
      tabs.push({
        name: 'ai-nuxt',
        title: 'AI Nuxt',
        icon: 'i-carbon-machine-learning-model',
        view: {
          type: 'iframe',
          src: '/__ai_nuxt_devtools'
        }
      })
    })

    // Register the DevTools client
    addCustomTab({
      name: 'ai-nuxt',
      title: 'AI Nuxt',
      icon: 'i-carbon-machine-learning-model',
      view: {
        type: 'iframe',
        src: '/__ai_nuxt_devtools'
      }
    })

    // Register the DevTools server routes
    nuxt.hook('devtools:setupRoutes', (server) => {
      server.use('/__ai_nuxt_devtools', (req, res) => {
        res.end('AI Nuxt DevTools')
      })
    })

    // Register the DevTools client routes
    nuxt.hook('vite:extendConfig', (config) => {
      config.plugins = config.plugins || []
      config.plugins.push({
        name: 'ai-nuxt-devtools',
        configureServer(server) {
          server.middlewares.use('/__ai_nuxt_devtools', (req, res) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>AI Nuxt DevTools</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <script type="module" src="/__ai_nuxt_devtools_client"></script>
              </head>
              <body>
                <div id="app"></div>
              </body>
              </html>
            `)
          })

          server.middlewares.use('/__ai_nuxt_devtools_client', (req, res) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/javascript')
            res.end(`
              import { createApp } from 'vue'
              import DevTools from '${resolve(__dirname, './client/index.js')}'
              
              const app = createApp(DevTools)
              app.mount('#app')
            `)
          })
        }
      })
    })
  }
})

export * from './client'
export * from './types'