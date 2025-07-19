# Migration Guide

This guide helps you migrate to AI Nuxt from other AI frameworks or upgrade between versions.

## Migrating from Other Frameworks

### From LangChain.js

If you're coming from LangChain.js, here's how to migrate your existing code:

#### Before (LangChain.js)

```javascript
import { OpenAI } from "langchain/llms/openai"
import { ConversationChain } from "langchain/chains"
import { BufferMemory } from "langchain/memory"

const model = new OpenAI({ 
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7 
})

const memory = new BufferMemory()
const chain = new ConversationChain({ llm: model, memory })

const response = await chain.call({ input: "Hello!" })
```

#### After (AI Nuxt)

```vue
<script setup>
// Automatic configuration from nuxt.config.ts
const { chat } = useAI({
  provider: 'openai',
  temperature: 0.7
})

// Built-in conversation memory
const { messages, sendMessage } = useAIChat()

await sendMessage("Hello!")
</script>
```

### From OpenAI SDK

#### Before (OpenAI SDK)

```javascript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 1000
})

console.log(completion.choices[0].message.content)
```

#### After (AI Nuxt)

```vue
<script setup>
const { chat } = useAI()

const response = await chat([
  { role: 'user', content: 'Hello!' }
], {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000
})

console.log(response.content)
</script>
```

### From Vercel AI SDK

#### Before (Vercel AI SDK)

```javascript
import { openai } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'

// Text generation
const { text } = await generateText({
  model: openai('gpt-4'),
  prompt: 'Hello!',
})

// Streaming
const { textStream } = await streamText({
  model: openai('gpt-4'),
  prompt: 'Tell me a story',
})

for await (const textPart of textStream) {
  process.stdout.write(textPart)
}
```

#### After (AI Nuxt)

```vue
<script setup>
const { chat } = useAI({ provider: 'openai' })

// Text generation
const response = await chat([
  { role: 'user', content: 'Hello!' }
], { model: 'gpt-4' })

// Streaming
const { startStream, content } = useAIStream({ provider: 'openai' })
await startStream('Tell me a story')

watch(content, (newContent) => {
  console.log(newContent)
})
</script>
```

## Version Migration

### From v0.x to v1.x

#### Breaking Changes

1. **Configuration Structure**
   ```typescript
   // v0.x
   export default defineNuxtConfig({
     aiNuxt: {
       openai: {
         apiKey: process.env.OPENAI_API_KEY
       }
     }
   })
   
   // v1.x
   export default defineNuxtConfig({
     aiNuxt: {
       providers: {
         openai: {
           apiKey: process.env.OPENAI_API_KEY
         }
       }
     }
   })
   ```

2. **Composable API Changes**
   ```vue
   <!-- v0.x -->
   <script setup>
   const { generate } = useOpenAI()
   const response = await generate('Hello!')
   </script>
   
   <!-- v1.x -->
   <script setup>
   const { chat } = useAI({ provider: 'openai' })
   const response = await chat([
     { role: 'user', content: 'Hello!' }
   ])
   </script>
   ```

3. **Component Props**
   ```vue
   <!-- v0.x -->
   <OpenAIChat api-key="..." model="gpt-4" />
   
   <!-- v1.x -->
   <AIChat provider="openai" model="gpt-4" />
   ```

#### Migration Steps

1. **Update Configuration**
   ```bash
   # Install new version
   npm install @ai-nuxt/module@latest
   ```

2. **Update nuxt.config.ts**
   ```typescript
   export default defineNuxtConfig({
     modules: ['@ai-nuxt/module'],
     aiNuxt: {
       providers: {
         openai: {
           apiKey: process.env.OPENAI_API_KEY
         }
       }
     }
   })
   ```

3. **Update Composables**
   ```vue
   <script setup>
   // Replace provider-specific composables
   const { chat } = useAI({ provider: 'openai' })
   
   // Update method calls
   const response = await chat(messages, options)
   </script>
   ```

4. **Update Components**
   ```vue
   <template>
     <!-- Replace provider-specific components -->
     <AIChat provider="openai" />
   </template>
   ```

#### Migration Tool

Use the AI Nuxt CLI migration tool:

```bash
npx @ai-nuxt/cli migrate --from=0.x --to=1.x
```

This tool will:
- Update configuration files
- Replace deprecated composables
- Update component usage
- Generate migration report

### From v1.x to v2.x

#### New Features

1. **Multi-Agent Support**
2. **Enhanced Vector Storage**
3. **Edge Runtime Support**
4. **Advanced Monitoring**

#### Migration Steps

1. **Update Dependencies**
   ```bash
   npm install @ai-nuxt/module@2.x
   ```

2. **Optional: Enable New Features**
   ```typescript
   export default defineNuxtConfig({
     aiNuxt: {
       // Enable multi-agent support
       agents: {
         enabled: true
       },
       
       // Enable vector storage
       vectorStore: {
         provider: 'memory'
       },
       
       // Enable monitoring
       monitoring: {
         enabled: true
       }
     }
   })
   ```

## Common Migration Patterns

### Environment Variables

#### Before
```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

#### After
```bash
# Same environment variables work
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Additional options
AI_NUXT_DEFAULT_PROVIDER=openai
AI_NUXT_DEBUG=true
```

### Error Handling

#### Before
```javascript
try {
  const response = await openai.chat.completions.create(...)
} catch (error) {
  if (error.status === 429) {
    console.log('Rate limited')
  }
}
```

#### After
```vue
<script setup>
const { chat } = useAI()

try {
  const response = await chat(...)
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Rate limited')
  }
}
</script>
```

### Streaming Responses

#### Before
```javascript
const stream = await openai.chat.completions.create({
  stream: true,
  // ...
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '')
}
```

#### After
```vue
<script setup>
const { startStream, content } = useAIStream()

await startStream('Your prompt here')

watch(content, (newContent) => {
  console.log(newContent)
})
</script>
```

## Migration Checklist

### Pre-Migration

- [ ] Backup your current project
- [ ] Review breaking changes
- [ ] Test in development environment
- [ ] Update dependencies

### Configuration Migration

- [ ] Update `nuxt.config.ts`
- [ ] Move API keys to environment variables
- [ ] Update provider configurations
- [ ] Test configuration loading

### Code Migration

- [ ] Replace deprecated composables
- [ ] Update component usage
- [ ] Update error handling
- [ ] Test all AI functionality

### Testing

- [ ] Run existing tests
- [ ] Add new tests for migrated code
- [ ] Test edge cases
- [ ] Performance testing

### Deployment

- [ ] Update environment variables
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   ```typescript
   // Make sure module is properly registered
   export default defineNuxtConfig({
     modules: ['@ai-nuxt/module'], // Must be in modules array
     aiNuxt: {
       // Your configuration
     }
   })
   ```

2. **API Keys Not Working**
   ```bash
   # Check environment variables
   echo $OPENAI_API_KEY
   
   # Restart development server
   npm run dev
   ```

3. **TypeScript Errors**
   ```bash
   # Regenerate types
   npm run build
   
   # Or restart TypeScript server in your IDE
   ```

4. **Composables Not Available**
   ```vue
   <script setup>
   // Make sure to import if auto-imports aren't working
   import { useAI } from '@ai-nuxt/module'
   </script>
   ```

### Getting Help

If you encounter issues during migration:

1. Check the [troubleshooting guide](./troubleshooting.md)
2. Search [GitHub issues](https://github.com/ai-nuxt/ai-nuxt/issues)
3. Ask in [Discord community](https://discord.gg/ai-nuxt)
4. Create a [new issue](https://github.com/ai-nuxt/ai-nuxt/issues/new)

## Migration Examples

### Complete Example: Chat Application

#### Before (Custom Implementation)

```vue
<template>
  <div>
    <div v-for="message in messages" :key="message.id">
      {{ message.content }}
    </div>
    <input v-model="input" @keyup.enter="send" />
  </div>
</template>

<script setup>
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
})

const messages = ref([])
const input = ref('')

async function send() {
  const userMessage = { id: Date.now(), content: input.value }
  messages.value.push(userMessage)
  
  const response = await openai.chat.completions.create({
    messages: [{ role: 'user', content: input.value }],
    model: 'gpt-4'
  })
  
  const aiMessage = {
    id: Date.now() + 1,
    content: response.choices[0].message.content
  }
  messages.value.push(aiMessage)
  
  input.value = ''
}
</script>
```

#### After (AI Nuxt)

```vue
<template>
  <div>
    <AIChat provider="openai" model="gpt-4" />
  </div>
</template>
```

That's it! The AI Nuxt component handles all the complexity automatically.

### Advanced Example: Custom Chat with Streaming

```vue
<template>
  <div>
    <div v-for="message in messages" :key="message.id">
      <div :class="message.role">{{ message.content }}</div>
    </div>
    <input v-model="input" @keyup.enter="send" />
  </div>
</template>

<script setup>
const { messages, sendMessage } = useAIChat({
  provider: 'openai',
  model: 'gpt-4',
  streaming: true
})

const input = ref('')

async function send() {
  await sendMessage(input.value)
  input.value = ''
}
</script>
```

## Best Practices for Migration

1. **Gradual Migration**: Migrate one component at a time
2. **Test Thoroughly**: Test each migrated component
3. **Keep Backups**: Maintain backups of working code
4. **Use TypeScript**: Leverage type safety during migration
5. **Monitor Performance**: Check for performance regressions
6. **Update Documentation**: Update your project documentation

## Post-Migration

After successful migration:

1. **Remove Old Dependencies**
   ```bash
   npm uninstall langchain openai @ai-sdk/openai
   ```

2. **Clean Up Code**
   - Remove unused imports
   - Delete deprecated files
   - Update documentation

3. **Optimize Configuration**
   - Enable caching
   - Configure monitoring
   - Set up alerts

4. **Explore New Features**
   - Try multi-agent workflows
   - Implement vector search
   - Use edge deployment