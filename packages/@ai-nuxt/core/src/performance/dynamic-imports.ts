/**
 * Dynamic import utilities for lazy loading AI components and providers
 */

export interface LazyLoadOptions {
  timeout?: number
  retries?: number
  fallback?: () => any
  preload?: boolean
}

export interface LoadedModule<T = any> {
  module: T
  loadTime: number
  size?: number
}

export class DynamicImportManager {
  private cache = new Map<string, Promise<LoadedModule>>()
  private loadTimes = new Map<string, number>()
  private errors = new Map<string, Error>()

  /**
   * Dynamically import a provider with caching and error handling
   */
  async loadProvider(providerName: string, options: LazyLoadOptions = {}): Promise<LoadedModule> {
    const cacheKey = `provider:${providerName}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const loadPromise = this.loadWithRetry(
      () => this.importProvider(providerName),
      options
    )

    this.cache.set(cacheKey, loadPromise)
    return loadPromise
  }

  /**
   * Dynamically import a component with lazy loading
   */
  async loadComponent(componentName: string, options: LazyLoadOptions = {}): Promise<LoadedModule> {
    const cacheKey = `component:${componentName}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const loadPromise = this.loadWithRetry(
      () => this.importComponent(componentName),
      options
    )

    this.cache.set(cacheKey, loadPromise)
    return loadPromise
  }

  /**
   * Dynamically import a feature module
   */
  async loadFeature(featureName: string, options: LazyLoadOptions = {}): Promise<LoadedModule> {
    const cacheKey = `feature:${featureName}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const loadPromise = this.loadWithRetry(
      () => this.importFeature(featureName),
      options
    )

    this.cache.set(cacheKey, loadPromise)
    return loadPromise
  }

  private async importProvider(providerName: string): Promise<any> {
    const startTime = performance.now()
    
    let module: any
    switch (providerName) {
      case 'openai':
        module = await import('@ai-nuxt/core/providers/openai')
        break
      case 'anthropic':
        module = await import('@ai-nuxt/core/providers/anthropic')
        break
      case 'ollama':
        module = await import('@ai-nuxt/core/providers/ollama')
        break
      default:
        throw new Error(`Unknown provider: ${providerName}`)
    }
    
    const loadTime = performance.now() - startTime
    this.loadTimes.set(`provider:${providerName}`, loadTime)
    
    return { module, loadTime }
  }

  private async importComponent(componentName: string): Promise<any> {
    const startTime = performance.now()
    
    let module: any
    switch (componentName) {
      case 'AIChat':
        module = await import('@ai-nuxt/module/runtime/components/AIChat.vue')
        break
      case 'AIPromptBuilder':
        module = await import('@ai-nuxt/module/runtime/components/AIPromptBuilder.vue')
        break
      case 'AIDebugger':
        module = await import('@ai-nuxt/module/runtime/components/AIDebugger.vue')
        break
      case 'AIModelSelector':
        module = await import('@ai-nuxt/module/runtime/components/AIModelSelector.vue')
        break
      default:
        throw new Error(`Unknown component: ${componentName}`)
    }
    
    const loadTime = performance.now() - startTime
    this.loadTimes.set(`component:${componentName}`, loadTime)
    
    return { module, loadTime }
  }

  private async importFeature(featureName: string): Promise<any> {
    const startTime = performance.now()
    
    let module: any
    switch (featureName) {
      case 'cache':
        module = await import('@ai-nuxt/core/cache')
        break
      case 'vector-store':
        module = await import('@ai-nuxt/core/vector-store')
        break
      case 'agents':
        module = await import('@ai-nuxt/core/agents')
        break
      case 'monitoring':
        module = await import('@ai-nuxt/core/monitoring')
        break
      case 'security':
        module = await import('@ai-nuxt/core/security')
        break
      case 'compliance':
        module = await import('@ai-nuxt/core/compliance')
        break
      default:
        throw new Error(`Unknown feature: ${featureName}`)
    }
    
    const loadTime = performance.now() - startTime
    this.loadTimes.set(`feature:${featureName}`, loadTime)
    
    return { module, loadTime }
  }

  private async loadWithRetry<T>(
    loader: () => Promise<T>,
    options: LazyLoadOptions
  ): Promise<T> {
    const { timeout = 10000, retries = 3, fallback } = options
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await Promise.race([
          loader(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Load timeout')), timeout)
          )
        ])
        
        return result
      } catch (error) {
        const err = error as Error
        this.errors.set(`attempt:${attempt}`, err)
        
        if (attempt === retries) {
          if (fallback) {
            console.warn(`Failed to load after ${retries} attempts, using fallback:`, err)
            return fallback()
          }
          throw err
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
    
    throw new Error('Unexpected error in loadWithRetry')
  }

  /**
   * Preload modules for better performance
   */
  async preloadModules(modules: string[]): Promise<void> {
    const preloadPromises = modules.map(async (module) => {
      try {
        if (module.startsWith('provider:')) {
          await this.loadProvider(module.replace('provider:', ''), { preload: true })
        } else if (module.startsWith('component:')) {
          await this.loadComponent(module.replace('component:', ''), { preload: true })
        } else if (module.startsWith('feature:')) {
          await this.loadFeature(module.replace('feature:', ''), { preload: true })
        }
      } catch (error) {
        console.warn(`Failed to preload ${module}:`, error)
      }
    })
    
    await Promise.allSettled(preloadPromises)
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): Record<string, number> {
    return Object.fromEntries(this.loadTimes)
  }

  /**
   * Get loading errors
   */
  getLoadingErrors(): Record<string, Error> {
    return Object.fromEntries(this.errors)
  }

  /**
   * Clear cache for a specific module or all modules
   */
  clearCache(moduleKey?: string): void {
    if (moduleKey) {
      this.cache.delete(moduleKey)
      this.loadTimes.delete(moduleKey)
      this.errors.delete(moduleKey)
    } else {
      this.cache.clear()
      this.loadTimes.clear()
      this.errors.clear()
    }
  }

  /**
   * Check if a module is loaded
   */
  isLoaded(moduleKey: string): boolean {
    return this.cache.has(moduleKey)
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.cache.size
  }
}

// Global instance
export const dynamicImportManager = new DynamicImportManager()

/**
 * Vue composable for dynamic imports
 */
export function useDynamicImport() {
  return {
    loadProvider: dynamicImportManager.loadProvider.bind(dynamicImportManager),
    loadComponent: dynamicImportManager.loadComponent.bind(dynamicImportManager),
    loadFeature: dynamicImportManager.loadFeature.bind(dynamicImportManager),
    preloadModules: dynamicImportManager.preloadModules.bind(dynamicImportManager),
    getLoadingStats: dynamicImportManager.getLoadingStats.bind(dynamicImportManager),
    clearCache: dynamicImportManager.clearCache.bind(dynamicImportManager),
    isLoaded: dynamicImportManager.isLoaded.bind(dynamicImportManager)
  }
}