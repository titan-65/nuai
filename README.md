# AI Nuxt Framework

A comprehensive AI framework built on top of Nuxt.js that brings unified AI capabilities to Vue.js developers.

## Packages

- **@ai-nuxt/core** - Core runtime and utilities
- **@ai-nuxt/module** - Main Nuxt module
- **@ai-nuxt/ui** - Vue components
- **@ai-nuxt/devtools** - DevTools extension
- **@ai-nuxt/cli** - CLI tools

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Project Structure

```
packages/
├── @ai-nuxt/core/         # Core runtime and utilities
├── @ai-nuxt/module/       # Main Nuxt module
├── @ai-nuxt/ui/           # Vue components
├── @ai-nuxt/devtools/     # DevTools extension
└── @ai-nuxt/cli/          # CLI tools
```

## Features

- Multi-provider AI integration (OpenAI, Anthropic, Ollama)
- Streaming responses with SSE and WebSocket support
- Vue composables for reactive AI interactions
- Pre-built UI components
- Intelligent caching system
- Vector store integration for RAG
- Multi-agent system
- Security features and compliance tools
- Edge deployment support

## License

MIT