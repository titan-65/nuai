# AICompletion Component

The `AICompletion` component provides a comprehensive interface for AI text completion with streaming support, model selection, and advanced configuration options.

## Features

- **Streaming Support**: Real-time text generation with streaming responses
- **Model Selection**: Choose from available AI models
- **Parameter Control**: Adjust temperature, max tokens, and other parameters
- **Markdown Rendering**: Optional markdown rendering for formatted output
- **Result Management**: Copy, insert, and clear completion results
- **Error Handling**: Built-in error display and retry functionality
- **Customizable UI**: Extensive styling and layout options

## Basic Usage

```vue
<template>
  <AICompletion
    v-model="prompt"
    v-model:result="result"
    @complete="handleComplete"
  />
</template>

<script setup>
import { ref } from 'vue'

const prompt = ref('')
const result = ref('')

const handleComplete = (text, metadata) => {
  console.log('Completion received:', text)
  console.log('Metadata:', metadata)
}
</script>
```

## Props

### Content Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `''` | The input prompt text (v-model) |
| `prompt` | `string` | `''` | Alternative way to set the prompt |
| `result` | `string` | `''` | The completion result (v-model:result) |

### AI Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `provider` | `string` | `undefined` | AI provider to use |
| `model` | `string` | `undefined` | Specific model to use |
| `models` | `string[]` | `[]` | Available models for selection |
| `temperature` | `number` | `0.7` | Sampling temperature (0-2) |
| `maxTokens` | `number` | `256` | Maximum tokens to generate |
| `minTokens` | `number` | `10` | Minimum tokens for slider |
| `maxTokensLimit` | `number` | `1000` | Maximum limit for tokens slider |
| `stream` | `boolean` | `true` | Enable streaming responses |

### UI Configuration Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'AI Completion'` | Component title |
| `placeholder` | `string` | `'Enter your prompt here...'` | Textarea placeholder |
| `resultTitle` | `string` | `'Completion'` | Result section title |
| `loadingText` | `string` | `'Generating...'` | Loading indicator text |
| `submitButtonText` | `string` | `'Generate'` | Submit button text |
| `promptRows` | `number` | `3` | Textarea rows |
| `disabled` | `boolean` | `false` | Disable the component |
| `renderAsMarkdown` | `boolean` | `false` | Render result as markdown |

### Display Options Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showHeader` | `boolean` | `true` | Show component header |
| `showModelSelector` | `boolean` | `true` | Show model selection dropdown |
| `showOptions` | `boolean` | `true` | Show parameter controls |
| `showMetadata` | `boolean` | `true` | Show completion metadata |
| `showCopyButton` | `boolean` | `true` | Show copy result button |
| `showInsertButton` | `boolean` | `true` | Show insert result button |
| `showClearButton` | `boolean` | `true` | Show clear result button |
| `showRetryButton` | `boolean` | `true` | Show retry button on error |

### Behavior Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `submitOnEnter` | `boolean` | `false` | Submit on Enter key press |
| `clearOnSubmit` | `boolean` | `false` | Clear prompt after submission |
| `focusOnMount` | `boolean` | `true` | Focus textarea on mount |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | Emitted when prompt changes |
| `update:result` | `string` | Emitted when result changes |
| `submit` | `string` | Emitted when form is submitted |
| `complete` | `string, object` | Emitted when completion finishes |
| `cancel` | - | Emitted when completion is cancelled |
| `error` | `string` | Emitted when an error occurs |
| `retry` | - | Emitted when retry button is clicked |
| `copy` | `string` | Emitted when result is copied |
| `clear` | - | Emitted when result is cleared |

## Exposed Methods

The component exposes several methods that can be called via template refs:

```vue
<template>
  <AICompletion ref="completionRef" />
  <button @click="focusCompletion">Focus</button>
</template>

<script setup>
import { ref } from 'vue'

const completionRef = ref()

const focusCompletion = () => {
  completionRef.value.focus()
}
</script>
```

### Available Methods

- `focus()` - Focus the textarea
- `submit()` - Trigger completion
- `cancel()` - Cancel ongoing completion
- `clear()` - Clear the result
- `copyResult()` - Copy result to clipboard
- `insertResult()` - Insert result into prompt

## Advanced Examples

### Custom Configuration

```vue
<template>
  <AICompletion
    v-model="prompt"
    v-model:result="result"
    :provider="provider"
    :models="availableModels"
    :temperature="0.9"
    :max-tokens="500"
    :stream="true"
    :render-as-markdown="true"
    title="Creative Writing Assistant"
    placeholder="Describe what you'd like me to write..."
    result-title="Generated Content"
    submit-button-text="Create"
    @submit="handleSubmit"
    @complete="handleComplete"
    @error="handleError"
  />
</template>

<script setup>
import { ref } from 'vue'

const prompt = ref('')
const result = ref('')
const provider = ref('openai')
const availableModels = ref(['gpt-4', 'gpt-3.5-turbo'])

const handleSubmit = (prompt) => {
  console.log('Submitting:', prompt)
}

const handleComplete = (text, metadata) => {
  console.log('Generated:', text)
  console.log('Used model:', metadata.model)
  console.log('Tokens:', metadata.tokens)
  console.log('Time:', metadata.time, 'ms')
}

const handleError = (error) => {
  console.error('Completion error:', error)
}
</script>
```

### Minimal Interface

```vue
<template>
  <AICompletion
    v-model="prompt"
    v-model:result="result"
    :show-header="false"
    :show-model-selector="false"
    :show-options="false"
    :show-metadata="false"
    placeholder="Enter your text here..."
    submit-button-text="Complete"
  />
</template>
```

### Code Generation Mode

```vue
<template>
  <AICompletion
    v-model="codePrompt"
    v-model:result="generatedCode"
    title="Code Generator"
    placeholder="Describe the code you want to generate..."
    result-title="Generated Code"
    :render-as-markdown="false"
    :temperature="0.2"
    :max-tokens="1000"
    @complete="handleCodeComplete"
  />
</template>

<script setup>
import { ref } from 'vue'

const codePrompt = ref('')
const generatedCode = ref('')

const handleCodeComplete = (code, metadata) => {
  // Process generated code
  console.log('Generated code:', code)
}
</script>
```

### With Custom Styling

```vue
<template>
  <AICompletion
    v-model="prompt"
    v-model:result="result"
    class="custom-completion"
  />
</template>

<style>
.custom-completion {
  --ai-primary-color: #8b5cf6;
  --ai-background-color: #f8fafc;
  --ai-border-color: #e2e8f0;
}

.custom-completion .ai-completion__header {
  background: var(--ai-primary-color);
  color: white;
}

.custom-completion .ai-completion__button--submit {
  background: var(--ai-primary-color);
}
</style>
```

## Styling

The component uses CSS custom properties for easy theming:

```css
.ai-completion {
  --ai-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --ai-primary-color: #3b82f6;
  --ai-success-color: #16a34a;
  --ai-error-color: #dc2626;
  --ai-warning-color: #ca8a04;
  --ai-background-color: white;
  --ai-surface-color: #f8fafc;
  --ai-border-color: #e2e8f0;
  --ai-text-color: #1e293b;
  --ai-text-muted: #64748b;
  --ai-border-radius: 8px;
  --ai-spacing: 1rem;
}
```

## Accessibility

The component includes several accessibility features:

- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader friendly
- High contrast support

## Performance

- Efficient streaming with async generators
- Debounced input handling
- Lazy loading of heavy dependencies
- Optimized re-renders with Vue 3 reactivity

## Browser Support

- Modern browsers with ES2020 support
- Chrome 80+
- Firefox 72+
- Safari 13.1+
- Edge 80+

## Related Components

- [`AIChat`](./AIChat.md) - Full chat interface
- [`AIInput`](./AIInput.md) - Simple AI input component
- [`AIPromptBuilder`](./AIPromptBuilder.md) - Advanced prompt construction