import { ProjectTemplate, TemplateMetadata } from './index'

/**
 * Project template metadata
 */
export const PROJECT_TEMPLATES: Record<ProjectTemplate, TemplateMetadata> = {
  basic: {
    name: 'Basic AI Nuxt Project',
    description: 'Simple AI Nuxt project with basic AI functionality',
    features: ['AI Chat', 'Text Completion', 'Provider Configuration'],
    dependencies: ['@ai-nuxt/module', '@ai-nuxt/core']
  },
  chat: {
    name: 'Chat Application',
    description: 'AI chat interface with conversation management',
    features: ['AI Chat UI', 'Message History', 'Multiple Providers', 'Real-time Updates'],
    dependencies: ['@ai-nuxt/module', '@ai-nuxt/core', 'socket.io']
  },
  agent: {
    name: 'AI Agent',
    description: 'Autonomous AI agent with tool usage',
    features: ['AI Agents', 'Tool Integration', 'Multi-Agent Communication', 'Task Orchestration'],
    dependencies: ['@ai-nuxt/module', '@ai-nuxt/core', '@ai-nuxt/agents']
  },
  rag: {
    name: 'RAG System',
    description: 'Retrieval-Augmented Generation system',
    features: ['Document Processing', 'Vector Search', 'RAG Pipeline', 'Knowledge Base'],
    dependencies: ['@ai-nuxt/module', '@ai-nuxt/core', '@ai-nuxt/rag']
  },
  full: {
    name: 'Full Stack AI Application',
    description: 'Complete AI application with all features',
    features: ['All AI Features', 'Authentication', 'Database', 'Admin Panel', 'API'],
    dependencies: ['@ai-nuxt/module', '@ai-nuxt/core', '@ai-nuxt/agents', '@ai-nuxt/rag', '@ai-nuxt/devtools']
  }
}

/**
 * Get project template files
 */
export function getProjectTemplate(template: ProjectTemplate): Record<string, string> {
  const baseFiles = getBaseProjectFiles()
  
  switch (template) {
    case 'basic':
      return {
        ...baseFiles,
        ...getBasicTemplateFiles()
      }
    case 'chat':
      return {
        ...baseFiles,
        ...getChatTemplateFiles()
      }
    case 'agent':
      return {
        ...baseFiles,
        ...getAgentTemplateFiles()
      }
    case 'rag':
      return {
        ...baseFiles,
        ...getRagTemplateFiles()
      }
    case 'full':
      return {
        ...baseFiles,
        ...getFullTemplateFiles()
      }
    default:
      return baseFiles
  }
}

/**
 * Base project files
 */
function getBaseProjectFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({
      name: 'ai-nuxt-app',
      private: true,
      scripts: {
        build: 'nuxt build',
        dev: 'nuxt dev',
        generate: 'nuxt generate',
        preview: 'nuxt preview',
        postinstall: 'nuxt prepare'
      },
      devDependencies: {
        '@nuxt/devtools': '^3.0.0',
        nuxt: '^3.8.0',
        vue: '^3.3.8',
        'vue-router': '^4.2.5'
      },
      dependencies: {
        '@ai-nuxt/module': 'latest'
      }
    }, null, 2),
    
    'nuxt.config.ts': `export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@ai-nuxt/module'
  ],
  aiNuxt: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    models: {
      chat: 'gpt-4',
      completion: 'gpt-3.5-turbo',
      embedding: 'text-embedding-ada-002'
    }
  }
})`,

    'app.vue': `<template>
  <div>
    <NuxtWelcome />
  </div>
</template>`,

    'README.md': `# AI Nuxt Application

This is an AI-powered application built with [AI Nuxt](https://ai-nuxt.dev).

## Setup

Make sure to install the dependencies:

\`\`\`bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install
\`\`\`

## Development Server

Start the development server on \`http://localhost:3000\`:

\`\`\`bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev
\`\`\`

## Production

Build the application for production:

\`\`\`bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build
\`\`\`

Locally preview production build:

\`\`\`bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview
\`\`\`

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
`,

    'tsconfig.json': JSON.stringify({
      extends: './.nuxt/tsconfig.json'
    }, null, 2)
  }
}

/**
 * Basic template files
 */
function getBasicTemplateFiles(): Record<string, string> {
  return {
    'pages/index.vue': `<template>
  <div class="container mx-auto p-8">
    <h1 class="text-4xl font-bold mb-8">AI Nuxt Basic App</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">AI Chat</h2>
        <AIChat />
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">Text Completion</h2>
        <AICompletion />
      </div>
    </div>
  </div>
</template>

<script setup>
// Page metadata
useHead({
  title: 'AI Nuxt Basic App'
})
</script>`,

    'components/AICompletion.vue': `<template>
  <div class="space-y-4">
    <textarea
      v-model="prompt"
      placeholder="Enter your prompt..."
      class="w-full p-3 border rounded-lg resize-none"
      rows="3"
    />
    
    <button
      @click="complete"
      :disabled="loading"
      class="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
    >
      {{ loading ? 'Generating...' : 'Complete Text' }}
    </button>
    
    <div v-if="result" class="p-4 bg-gray-50 rounded-lg">
      <p class="whitespace-pre-wrap">{{ result }}</p>
    </div>
  </div>
</template>

<script setup>
const { completion } = useAI()

const prompt = ref('')
const result = ref('')
const loading = ref(false)

async function complete() {
  if (!prompt.value.trim()) return
  
  loading.value = true
  try {
    result.value = await completion(prompt.value)
  } catch (error) {
    console.error('Completion error:', error)
  } finally {
    loading.value = false
  }
}
</script>`
  }
}

/**
 * Chat template files
 */
function getChatTemplateFiles(): Record<string, string> {
  return {
    'pages/index.vue': `<template>
  <div class="h-screen flex flex-col">
    <header class="bg-blue-600 text-white p-4">
      <h1 class="text-2xl font-bold">AI Chat Application</h1>
    </header>
    
    <main class="flex-1 flex">
      <div class="flex-1 flex flex-col">
        <AIChat class="flex-1" />
      </div>
      
      <aside class="w-80 bg-gray-50 p-4 border-l">
        <h2 class="text-lg font-semibold mb-4">Chat Settings</h2>
        <AIModelSelector />
      </aside>
    </main>
  </div>
</template>

<script setup>
useHead({
  title: 'AI Chat Application'
})
</script>`,

    'components/AIModelSelector.vue': `<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2">AI Model</label>
      <select
        v-model="selectedModel"
        class="w-full p-2 border rounded-lg"
      >
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        <option value="claude-3-opus">Claude 3 Opus</option>
        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
      </select>
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Temperature</label>
      <input
        v-model="temperature"
        type="range"
        min="0"
        max="2"
        step="0.1"
        class="w-full"
      />
      <span class="text-sm text-gray-600">{{ temperature }}</span>
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Max Tokens</label>
      <input
        v-model="maxTokens"
        type="number"
        min="1"
        max="4000"
        class="w-full p-2 border rounded-lg"
      />
    </div>
  </div>
</template>

<script setup>
const selectedModel = ref('gpt-4')
const temperature = ref(0.7)
const maxTokens = ref(1000)

// Update AI configuration when values change
watch([selectedModel, temperature, maxTokens], () => {
  // Update AI configuration
  console.log('Model settings updated:', {
    model: selectedModel.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value
  })
})
</script>`
  }
}

/**
 * Agent template files
 */
function getAgentTemplateFiles(): Record<string, string> {
  return {
    'pages/index.vue': `<template>
  <div class="container mx-auto p-8">
    <h1 class="text-4xl font-bold mb-8">AI Agent System</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">Agent Chat</h2>
        <AIAgentChat />
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">Agent Status</h2>
        <AIAgentStatus />
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'AI Agent System'
})
</script>`,

    'agents/AssistantAgent.ts': `import { defineAgent } from '@ai-nuxt/core'

export const AssistantAgent = defineAgent({
  name: 'AssistantAgent',
  description: 'A helpful AI assistant',
  capabilities: ['canUseTool', 'canCommunicate'],
  
  async execute(input: string) {
    // Agent logic here
    return \`Assistant response to: \${input}\`
  }
})`
  }
}

/**
 * RAG template files
 */
function getRagTemplateFiles(): Record<string, string> {
  return {
    'pages/index.vue': `<template>
  <div class="container mx-auto p-8">
    <h1 class="text-4xl font-bold mb-8">RAG System</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">Document Q&A</h2>
        <AIDocumentQA />
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-semibold mb-4">Knowledge Base</h2>
        <AIKnowledgeBase />
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'RAG System'
})
</script>`
  }
}

/**
 * Full template files
 */
function getFullTemplateFiles(): Record<string, string> {
  return {
    ...getChatTemplateFiles(),
    ...getAgentTemplateFiles(),
    ...getRagTemplateFiles(),
    
    'pages/dashboard.vue': `<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b">
      <div class="container mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <h1 class="text-xl font-semibold">AI Dashboard</h1>
          <div class="flex space-x-4">
            <NuxtLink to="/" class="text-blue-600 hover:text-blue-800">Chat</NuxtLink>
            <NuxtLink to="/agents" class="text-blue-600 hover:text-blue-800">Agents</NuxtLink>
            <NuxtLink to="/documents" class="text-blue-600 hover:text-blue-800">Documents</NuxtLink>
          </div>
        </div>
      </div>
    </nav>
    
    <main class="container mx-auto p-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Total Chats</h3>
          <p class="text-3xl font-bold text-blue-600">{{ stats.totalChats }}</p>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Active Agents</h3>
          <p class="text-3xl font-bold text-green-600">{{ stats.activeAgents }}</p>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">Documents</h3>
          <p class="text-3xl font-bold text-purple-600">{{ stats.documents }}</p>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <h3 class="text-lg font-semibold mb-2">API Calls</h3>
          <p class="text-3xl font-bold text-orange-600">{{ stats.apiCalls }}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
          <AIActivityFeed />
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <h2 class="text-xl font-semibold mb-4">System Status</h2>
          <AISystemStatus />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
const stats = ref({
  totalChats: 142,
  activeAgents: 5,
  documents: 28,
  apiCalls: 1247
})

useHead({
  title: 'AI Dashboard'
})
</script>`
  }
}