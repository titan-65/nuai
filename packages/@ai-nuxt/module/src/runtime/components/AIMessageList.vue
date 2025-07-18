<template>
  <div 
    ref="containerRef"
    class="ai-message-list"
    :class="{
      'ai-message-list--loading': isLoading,
      'ai-message-list--empty': isEmpty
    }"
    :style="{ height }"
  >
    <!-- Empty State -->
    <div v-if="isEmpty && !isLoading" class="ai-message-list__empty">
      <slot name="empty">
        <div class="ai-message-list__empty-content">
          <div class="ai-message-list__empty-icon">💬</div>
          <p class="ai-message-list__empty-text">{{ emptyMessage }}</p>
        </div>
      </slot>
    </div>

    <!-- Messages -->
    <div v-else class="ai-message-list__messages">
      <!-- Date Separators and Messages -->
      <template v-for="(item, index) in messagesWithSeparators" :key="item.id || `separator-${index}`">
        <!-- Date Separator -->
        <div v-if="item.type === 'separator'" class="ai-message-list__date-separator">
          <span class="ai-message-list__date-separator-text">{{ item.date }}</span>
        </div>

        <!-- Message -->
        <div
          v-else
          class="ai-message-list__message"
          :class="[
            `ai-message-list__message--${item.role}`,
            {
              'ai-message-list__message--streaming': item.isStreaming,
              'ai-message-list__message--error': item.error,
              'ai-message-list__message--selected': selectedMessageId === item.id
            }
          ]"
          @click="handleMessageClick(item)"
        >
          <!-- Avatar -->
          <div class="ai-message-list__avatar">
            <slot :name="`avatar-${item.role}`" :message="item">
              <div 
                class="ai-message-list__avatar-default"
                :class="`ai-message-list__avatar-default--${item.role}`"
              >
                {{ getDefaultAvatar(item.role) }}
              </div>
            </slot>
          </div>

          <!-- Message Content -->
          <div class="ai-message-list__content">
            <!-- Header -->
            <div class="ai-message-list__header">
              <span class="ai-message-list__role">{{ formatRole(item.role) }}</span>
              <span class="ai-message-list__timestamp">{{ formatTimestamp(item.timestamp) }}</span>
              
              <!-- Actions -->
              <div v-if="showActions" class="ai-message-list__actions">
                <button
                  v-if="item.role === 'assistant' && allowCopy"
                  @click.stop="copyMessage(item)"
                  class="ai-message-list__action-button"
                  :title="copyButtonTitle"
                  type="button"
                >
                  📋
                </button>
                
                <button
                  v-if="allowRegenerate && item.role === 'assistant'"
                  @click.stop="regenerateMessage(item)"
                  class="ai-message-list__action-button"
                  :title="regenerateButtonTitle"
                  type="button"
                >
                  🔄
                </button>
                
                <button
                  v-if="allowDelete"
                  @click.stop="deleteMessage(item)"
                  class="ai-message-list__action-button ai-message-list__action-button--danger"
                  :title="deleteButtonTitle"
                  type="button"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Message Text -->
            <div class="ai-message-list__text">
              <slot name="message" :message="item">
                <div v-if="renderAsMarkdown && item.role === 'assistant'" v-html="renderMarkdown(item.content)"></div>
                <div v-else class="ai-message-list__text-content">{{ item.content }}</div>
              </slot>
              
              <!-- Streaming Cursor -->
              <span v-if="item.isStreaming" class="ai-message-list__cursor">|</span>
            </div>

            <!-- Metadata -->
            <div v-if="showMetadata && item.metadata" class="ai-message-list__metadata">
              <div class="ai-message-list__metadata-grid">
                <span v-if="item.metadata.tokens" class="ai-message-list__metadata-item">
                  <strong>Tokens:</strong> {{ item.metadata.tokens }}
                </span>
                <span v-if="item.metadata.model" class="ai-message-list__metadata-item">
                  <strong>Model:</strong> {{ item.metadata.model }}
                </span>
                <span v-if="item.metadata.provider" class="ai-message-list__metadata-item">
                  <strong>Provider:</strong> {{ item.metadata.provider }}
                </span>
                <span v-if="item.metadata.cost" class="ai-message-list__metadata-item">
                  <strong>Cost:</strong> ${{ item.metadata.cost.toFixed(4) }}
                </span>
              </div>
            </div>

            <!-- Error Display -->
            <div v-if="item.error" class="ai-message-list__error">
              <span class="ai-message-list__error-icon">⚠️</span>
              <span class="ai-message-list__error-text">{{ item.error }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Loading Indicator -->
      <div v-if="isLoading" class="ai-message-list__loading">
        <div class="ai-message-list__avatar">
          <div class="ai-message-list__avatar-default ai-message-list__avatar-default--assistant">
            🤖
          </div>
        </div>
        <div class="ai-message-list__content">
          <div class="ai-message-list__loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="ai-message-list__loading-text">{{ loadingMessage }}</span>
        </div>
      </div>
    </div>

    <!-- Scroll to Bottom Button -->
    <button
      v-if="showScrollButton"
      @click="scrollToBottom"
      class="ai-message-list__scroll-button"
      :title="scrollButtonTitle"
      type="button"
    >
      ⬇️
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Message } from '@ai-nuxt/core'

export interface AIMessageListProps {
  // Data
  messages: Message[]
  currentMessage?: string
  isLoading?: boolean
  
  // Display options
  height?: string
  emptyMessage?: string
  loadingMessage?: string
  showMetadata?: boolean
  showActions?: boolean
  showDateSeparators?: boolean
  renderAsMarkdown?: boolean
  
  // Interaction options
  allowCopy?: boolean
  allowRegenerate?: boolean
  allowDelete?: boolean
  allowSelection?: boolean
  selectedMessageId?: string
  
  // Auto-scroll options
  autoScroll?: boolean
  scrollThreshold?: number
  
  // Button titles
  copyButtonTitle?: string
  regenerateButtonTitle?: string
  deleteButtonTitle?: string
  scrollButtonTitle?: string
}

const props = withDefaults(defineProps<AIMessageListProps>(), {
  messages: () => [],
  currentMessage: '',
  isLoading: false,
  height: '400px',
  emptyMessage: 'No messages yet. Start a conversation!',
  loadingMessage: 'AI is thinking...',
  showMetadata: true,
  showActions: true,
  showDateSeparators: true,
  renderAsMarkdown: false,
  allowCopy: true,
  allowRegenerate: true,
  allowDelete: false,
  allowSelection: false,
  autoScroll: true,
  scrollThreshold: 100,
  copyButtonTitle: 'Copy message',
  regenerateButtonTitle: 'Regenerate response',
  deleteButtonTitle: 'Delete message',
  scrollButtonTitle: 'Scroll to bottom'
})

// Emits
const emit = defineEmits<{
  copy: [message: Message]
  regenerate: [message: Message]
  delete: [message: Message]
  select: [message: Message | null]
  scroll: [position: { top: number; bottom: number }]
}>()

// Refs
const containerRef = ref<HTMLElement>()
const showScrollButton = ref(false)

// Computed
const isEmpty = computed(() => props.messages.length === 0 && !props.currentMessage)

const messagesWithSeparators = computed(() => {
  if (!props.showDateSeparators) {
    return props.messages
  }

  const result: Array<Message | { type: 'separator'; date: string; id: string }> = []
  let lastDate = ''

  for (const message of props.messages) {
    const messageDate = formatDate(message.timestamp)
    
    if (messageDate !== lastDate) {
      result.push({
        type: 'separator',
        date: messageDate,
        id: `separator-${messageDate}`
      })
      lastDate = messageDate
    }
    
    result.push(message)
  }

  // Add current streaming message if exists
  if (props.currentMessage && props.isLoading) {
    const today = formatDate(new Date())
    if (today !== lastDate) {
      result.push({
        type: 'separator',
        date: today,
        id: `separator-${today}`
      })
    }
    
    result.push({
      id: 'current-streaming',
      role: 'assistant' as const,
      content: props.currentMessage,
      timestamp: new Date(),
      isStreaming: true
    })
  }

  return result
})

// Methods
const formatRole = (role: string): string => {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

const formatTimestamp = (timestamp: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(timestamp)
}

const formatDate = (date: Date): string => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (isSameDay(date, today)) {
    return 'Today'
  } else if (isSameDay(date, yesterday)) {
    return 'Yesterday'
  } else {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    }).format(date)
  }
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear()
}

const getDefaultAvatar = (role: string): string => {
  switch (role) {
    case 'user': return '👤'
    case 'assistant': return '🤖'
    case 'system': return '⚙️'
    default: return '💬'
  }
}

const renderMarkdown = (content: string): string => {
  // Simple markdown rendering - in a real app, use a proper markdown library
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

const scrollToBottom = async () => {
  await nextTick()
  if (containerRef.value) {
    const container = containerRef.value
    container.scrollTop = container.scrollHeight
  }
}

const checkScrollPosition = () => {
  if (!containerRef.value) return
  
  const container = containerRef.value
  const { scrollTop, scrollHeight, clientHeight } = container
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  
  showScrollButton.value = distanceFromBottom > props.scrollThreshold
  
  emit('scroll', {
    top: scrollTop,
    bottom: distanceFromBottom
  })
}

const handleMessageClick = (message: Message) => {
  if (props.allowSelection) {
    const newSelection = props.selectedMessageId === message.id ? null : message
    emit('select', newSelection)
  }
}

const copyMessage = async (message: Message) => {
  try {
    await navigator.clipboard.writeText(message.content)
    emit('copy', message)
  } catch (error) {
    console.error('Failed to copy message:', error)
  }
}

const regenerateMessage = (message: Message) => {
  emit('regenerate', message)
}

const deleteMessage = (message: Message) => {
  emit('delete', message)
}

// Watchers
watch(() => props.messages.length, () => {
  if (props.autoScroll) {
    nextTick(() => scrollToBottom())
  }
}, { flush: 'post' })

watch(() => props.currentMessage, () => {
  if (props.autoScroll && props.currentMessage) {
    nextTick(() => scrollToBottom())
  }
}, { flush: 'post' })

// Lifecycle
onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', checkScrollPosition)
    scrollToBottom()
  }
})

onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', checkScrollPosition)
  }
})

// Expose methods
defineExpose({
  scrollToBottom,
  scrollToTop: () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
  },
  scrollToMessage: (messageId: string) => {
    const messageElement = containerRef.value?.querySelector(`[data-message-id="${messageId}"]`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
})
</script>

<style scoped>
.ai-message-list {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-message-list--loading {
  opacity: 0.9;
}

/* Empty State */
.ai-message-list__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
}

.ai-message-list__empty-content {
  text-align: center;
  color: #64748b;
}

.ai-message-list__empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.ai-message-list__empty-text {
  margin: 0;
  font-size: 1.1rem;
}

/* Messages Container */
.ai-message-list__messages {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Date Separator */
.ai-message-list__date-separator {
  display: flex;
  align-items: center;
  margin: 0.5rem 0;
}

.ai-message-list__date-separator::before,
.ai-message-list__date-separator::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.ai-message-list__date-separator-text {
  padding: 0 1rem;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

/* Message */
.ai-message-list__message {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.5rem;
  border-radius: 8px;
}

.ai-message-list__message:hover {
  background: #f8fafc;
}

.ai-message-list__message--selected {
  background: #eff6ff;
  border: 1px solid #3b82f6;
}

.ai-message-list__message--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.ai-message-list__message--assistant {
  align-self: flex-start;
}

.ai-message-list__message--streaming {
  opacity: 0.8;
}

.ai-message-list__message--error {
  border-left: 3px solid #ef4444;
}

/* Avatar */
.ai-message-list__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
}

.ai-message-list__avatar-default {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: white;
}

.ai-message-list__avatar-default--user {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.ai-message-list__avatar-default--assistant {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.ai-message-list__avatar-default--system {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

/* Content */
.ai-message-list__content {
  flex: 1;
  min-width: 0;
}

.ai-message-list__message--user .ai-message-list__content {
  text-align: right;
}

/* Header */
.ai-message-list__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
}

.ai-message-list__message--user .ai-message-list__header {
  flex-direction: row-reverse;
}

.ai-message-list__role {
  font-weight: 600;
}

.ai-message-list__timestamp {
  opacity: 0.8;
}

.ai-message-list__actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.ai-message-list__message:hover .ai-message-list__actions {
  opacity: 1;
}

.ai-message-list__action-button {
  padding: 0.25rem;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background-color 0.2s ease;
}

.ai-message-list__action-button:hover {
  background: #e2e8f0;
}

.ai-message-list__action-button--danger:hover {
  background: #fecaca;
}

/* Text */
.ai-message-list__text {
  background: #f1f5f9;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  line-height: 1.5;
  word-wrap: break-word;
  position: relative;
}

.ai-message-list__message--user .ai-message-list__text {
  background: #3b82f6;
  color: white;
}

.ai-message-list__text-content {
  white-space: pre-wrap;
}

.ai-message-list__cursor {
  animation: blink 1s infinite;
  margin-left: 2px;
}

/* Metadata */
.ai-message-list__metadata {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.ai-message-list__metadata-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.ai-message-list__metadata-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Error */
.ai-message-list__error {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #dc2626;
}

/* Loading */
.ai-message-list__loading {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  opacity: 0.8;
}

.ai-message-list__loading-dots {
  display: flex;
  gap: 4px;
  margin-bottom: 0.5rem;
}

.ai-message-list__loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: bounce 1.4s infinite ease-in-out both;
}

.ai-message-list__loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.ai-message-list__loading-dots span:nth-child(2) { animation-delay: -0.16s; }

.ai-message-list__loading-text {
  font-size: 0.875rem;
  color: #64748b;
}

/* Scroll Button */
.ai-message-list__scroll-button {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  z-index: 10;
}

.ai-message-list__scroll-button:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Animations */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .ai-message-list__message {
    max-width: 95%;
  }
  
  .ai-message-list__metadata-grid {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .ai-message-list__actions {
    position: absolute;
    top: -2rem;
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .ai-message-list {
    background: #1e293b;
    color: #e2e8f0;
  }
  
  .ai-message-list__text {
    background: #334155;
    color: #e2e8f0;
  }
  
  .ai-message-list__message--user .ai-message-list__text {
    background: #3b82f6;
    color: white;
  }
  
  .ai-message-list__message:hover {
    background: #334155;
  }
}
</style>