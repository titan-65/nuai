# Performance Optimization Guide

AI Nuxt includes comprehensive performance optimizations to ensure minimal bundle size and optimal runtime performance. This guide explains the optimization features and how to use them effectively.

## Bundle Size Optimization

### Tree Shaking

AI Nuxt is built with tree-shaking in mind. Only the features and providers you actually use will be included in your final bundle.

```typescript
// ✅ Good - Only imports what you need
import { useAI } from '@ai-nuxt/module'

// ❌ Avoid - Imports everything
import * as AINuxt from '@ai-nuxt/module'
```

### Modular Architecture

The framework is split into separate chunks for different capabilities:

- **Core** (`@ai-nuxt/core`): Essential functionality (~50KB)
- **Providers** (`@ai-nuxt/core/providers/*`): Individual AI providers (~30-50KB each)
- **Features**: Optional features loaded on demand
  - Cache system (~25KB)
  - Vector store (~40KB)
  - Agent system (~60KB)
  - Monitoring (~30KB)
  - Security (~20KB)

### Dynamic Imports

Heavy features are loaded dynamically when needed:

```typescript
// Providers are loaded on-demand
const { useAI } = await import('@ai-nuxt/module')
const ai = useAI()

// Switch providers dynamically
await ai.switchProvider('anthropic') // Loads Anthropic provider only when needed
```

## Performance Monitoring

### Bundle Analysis

Use the `useAIPerformance` composable to monitor your bundle:

```vue
<template>
  <div>
    <h2>Bundle Analysis</h2>
    <div v-if="bundleSize">
      <p>Total Size: {{ bundleSize.total }}</p>
      <p>Gzipped: {{ bundleSize.gzipped }}</p>
      <p>Compression: {{ bundleSize.compressionRatio }}</p>
    </div>
    
    <h3>Recommendations</h3>
    <ul>
      <li v-for="rec in state.recommendations" :key="rec">
        {{ rec }}
      </li>
    </ul>
  </div>
</template>

<script setup>
const { 
  state, 
  bundleSize, 
  analyzeBundleSize, 
  generateRecommendations 
} = useAIPerformance()

// Analyze bundle on mount
onMounted(async () => {
  await analyzeBundleSize()
})
</script>
```

### Memory Monitoring

Track memory usage in real-time:

```typescript
const { trackMemoryUsage, memoryUsage } = useAIPerformance()

// Monitor memory usage
setInterval(() => {
  const usage = trackMemoryUsage()
  if (usage > 0.8) {
    console.warn('High memory usage detected:', usage)
  }
}, 30000)
```

### Loading Performance

Monitor dynamic import performance:

```typescript
const { getLoadingStats, loadingPerformance } = useAIPerformance()

// Get loading statistics
const stats = getLoadingStats()
console.log('Average load time:', loadingPerformance.value?.average)
```

## Configuration Optimization

### Conditional Loading

Configure features based on your needs:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@ai-nuxt/module'],
  aiNuxt: {
    // Only enable features you need
    streaming: {
      enabled: true,
      transport: 'sse' // 'websocket' adds more bundle size
    },
    caching: {
      enabled: true,
      semantic: false // Disable if not using semantic caching
    },
    vectorStore: {
      provider: 'memory' // Use 'none' if not needed
    },
    security: {
      promptInjectionDetection: false, // Enable only if needed
      piiScrubbing: false,
      contentFiltering: false
    },
    monitoring: {
      enabled: process.env.NODE_ENV === 'production'
    }
  }
})
```

### Provider Selection

Only configure the providers you actually use:

```typescript
export default defineNuxtConfig({
  aiNuxt: {
    providers: [
      // Only include providers you need
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY
      }
      // Don't include unused providers
    ],
    defaultProvider: 'openai'
  }
})
```

## Edge Deployment Optimization

### Edge-Optimized Builds

For edge deployments, use optimized provider builds:

```typescript
// Use edge-optimized providers
import { OpenAIEdgeProvider } from '@ai-nuxt/core/providers/edge'

// Smaller bundle size, optimized for edge runtime
const provider = new OpenAIEdgeProvider({
  apiKey: process.env.OPENAI_API_KEY
})
```

### Nitro Presets

AI Nuxt includes optimized Nitro presets for popular edge platforms:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-workers', // or 'vercel-edge', 'netlify-edge'
    // AI Nuxt automatically optimizes for the target platform
  }
})
```

## Bundle Size Monitoring

### CI/CD Integration

Add bundle size checks to your CI/CD pipeline:

```json
{
  "scripts": {
    "build:check": "pnpm build && pnpm bundle-size",
    "bundle-size": "node scripts/bundle-size-check.js"
  }
}
```

The bundle size check will fail if bundles exceed defined thresholds:

- Core module: 100KB
- Individual providers: 50KB each
- Feature modules: 15-60KB depending on complexity

### Size Thresholds

Current bundle size limits:

| Module | Threshold | Description |
|--------|-----------|-------------|
| `@ai-nuxt/core` | 100KB | Core functionality |
| `@ai-nuxt/core/providers/openai` | 50KB | OpenAI provider |
| `@ai-nuxt/core/providers/anthropic` | 50KB | Anthropic provider |
| `@ai-nuxt/core/providers/ollama` | 50KB | Ollama provider |
| `@ai-nuxt/core/cache` | 25KB | Caching system |
| `@ai-nuxt/core/vector-store` | 40KB | Vector operations |
| `@ai-nuxt/core/agents` | 60KB | Agent system |
| `@ai-nuxt/core/monitoring` | 30KB | Observability |
| `@ai-nuxt/core/security` | 20KB | Security features |
| `@ai-nuxt/core/compliance` | 15KB | Compliance tools |

## Performance Best Practices

### 1. Lazy Load Heavy Features

```typescript
// ✅ Good - Load on demand
const loadVectorStore = async () => {
  const { useAIVectorStore } = await import('@ai-nuxt/module')
  return useAIVectorStore()
}

// ❌ Avoid - Always loaded
import { useAIVectorStore } from '@ai-nuxt/module'
```

### 2. Use Semantic Caching Wisely

```typescript
// Enable semantic caching only for repetitive queries
export default defineNuxtConfig({
  aiNuxt: {
    caching: {
      enabled: true,
      semantic: true, // Only if you have repetitive similar queries
      semanticThreshold: 0.95 // Adjust based on your needs
    }
  }
})
```

### 3. Optimize Provider Usage

```typescript
// ✅ Good - Switch providers dynamically
const ai = useAI()
await ai.switchProvider('anthropic') // Loads only when needed

// ❌ Avoid - Multiple provider instances
const openai = useAI({ provider: 'openai' })
const anthropic = useAI({ provider: 'anthropic' })
```

### 4. Monitor Performance in Production

```typescript
// Enable performance monitoring in production
export default defineNuxtConfig({
  aiNuxt: {
    monitoring: {
      enabled: true,
      enableMetrics: true,
      sampleRate: 0.1 // Sample 10% of requests
    }
  }
})
```

### 5. Use Preloading Strategically

```typescript
// Preload critical providers
const { preloadModules } = useDynamicImport()

onMounted(() => {
  // Preload likely-to-be-used providers
  preloadModules(['provider:openai', 'component:AIChat'])
})
```

## Troubleshooting Performance Issues

### Large Bundle Size

1. **Check unused providers**: Use `useAIPerformance` to identify loaded but unused providers
2. **Disable unnecessary features**: Review your configuration and disable unused features
3. **Use dynamic imports**: Load heavy features on demand
4. **Check dependencies**: Ensure you're not importing entire libraries

### High Memory Usage

1. **Clear caches periodically**: Use cache TTL and size limits
2. **Monitor vector store size**: Limit document storage
3. **Use streaming**: Reduce memory usage for large responses
4. **Clean up resources**: Properly dispose of unused providers

### Slow Loading Times

1. **Enable preloading**: Preload critical modules
2. **Use CDN**: Serve static assets from CDN
3. **Optimize images**: Compress and optimize any images
4. **Check network**: Monitor network requests and optimize API calls

## Performance Metrics

The framework tracks several key performance metrics:

- **Bundle Load Time**: Time to load initial bundle
- **Provider Init Time**: Time to initialize AI providers
- **First Interaction Time**: Time to first user interaction
- **Memory Usage**: Current memory consumption
- **Cache Hit Rate**: Effectiveness of caching

Access these metrics using:

```typescript
const { getMetrics } = useAIPerformance()
const metrics = getMetrics()

console.log('Bundle load time:', metrics?.bundleLoadTime)
console.log('Memory usage:', metrics?.memoryUsage)
```

## Continuous Optimization

1. **Regular bundle analysis**: Run bundle analysis regularly to catch size increases
2. **Performance testing**: Include performance tests in your CI/CD pipeline
3. **Monitor production**: Use real-user monitoring to track performance
4. **Update dependencies**: Keep dependencies updated for performance improvements
5. **Review configurations**: Regularly review and optimize your AI Nuxt configuration