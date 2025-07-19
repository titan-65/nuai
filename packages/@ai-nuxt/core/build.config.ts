import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Main entry point
    'src/index',
    // Separate chunks for different capabilities
    'src/providers/index',
    'src/cache/index',
    'src/vector-store/index',
    'src/agents/index',
    'src/monitoring/index',
    'src/security/index',
    'src/compliance/index',
    'src/testing/index',
    // Individual provider entries for tree-shaking
    'src/providers/openai',
    'src/providers/anthropic',
    'src/providers/ollama',
    // Edge-specific builds
    'src/providers/edge/index',
    // Performance optimization utilities
    'src/performance/index'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    // Enable tree-shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false
    },
    // Optimize bundle size
    output: {
      compact: true,
      minifyInternalExports: true
    }
  },
  // External dependencies to avoid bundling
  externals: [
    'vue',
    'pinia',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/exporter-otlp-http',
    '@opentelemetry/sdk-trace-node'
  ]
})