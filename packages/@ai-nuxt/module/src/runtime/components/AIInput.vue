<template>
  <div 
    class="ai-input"
    :class="{
      'ai-input--disabled': disabled,
      'ai-input--loading': isLoading,
      'ai-input--error': !!error
    }"
  >
    <!-- Input Container -->
    <div class="ai-input__container">
      <!-- Textarea -->
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        class="ai-input__textarea"
        :placeholder="placeholder"
        :disabled="disabled || isLoading"
        :rows="computedRows"
        :maxlength="maxLength"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @focus="handleFocus"
        @blur="handleBlur"
      ></textarea>

      <!-- Character Counter -->
      <div 
        v-if="showCharacterCount" 
        class="ai-input__character-count"
        :class="{
          'ai-input__character-count--warning': isNearLimit,
          'ai-input__character-count--error': isOverLimit
        }"
      >
        {{ characterCount }}{{ maxLength ? `/${maxLength}` : '' }}
      </div>

      <!-- Action Buttons -->
      <div class="ai-input__actions">
        <!-- Attachment Button -->
        <button
          v-if="allowAttachments"
          @click="handleAttachment"
          class="ai-input__action-button"
          :disabled="disabled"
          :title="attachmentButtonTitle"
          type="button"
        >
          📎
        </button>

        <!-- Voice Input Button -->
        <button
          v-if="allowVoiceInput"
          @click="toggleVoiceInput"
          class="ai-input__action-button"
          :class="{ 'ai-input__action-button--active': isRecording }"
          :disabled="disabled"
          :title="voiceButtonTitle"
          type="button"
        >
          {{ isRecording ? '🔴' : '🎤' }}
        </button>

        <!-- Send/Cancel Button -->
        <button
          @click="handleSubmit"
          class="ai-input__submit-button"
          :class="{
            'ai-input__submit-button--cancel': isLoading,
            'ai-input__submit-button--disabled': !canSubmit
          }"
          :disabled="!canSubmit && !isLoading"
          :title="submitButtonTitle"
          type="button"
        >
          <span class="ai-input__submit-icon">
            {{ isLoading ? '⏹️' : '📤' }}
          </span>
          <span class="ai-input__submit-text">
            {{ isLoading ? cancelText : submitText }}
          </span>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="showFooter" class="ai-input__footer">
      <!-- Validation Messages -->
      <div v-if="validationMessages.length > 0" class="ai-input__validation">
        <div 
          v-for="(message, index) in validationMessages" 
          :key="index"
          class="ai-input__validation-message"
          :class="`ai-input__validation-message--${message.type}`"
        >
          <span class="ai-input__validation-icon">
            {{ message.type === 'error' ? '⚠️' : 'ℹ️' }}
          </span>
          {{ message.text }}
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="ai-input__error">
        <span class="ai-input__error-icon">❌</span>
        <span class="ai-input__error-text">{{ error }}</span>
        <button
          v-if="showRetry"
          @click="handleRetry"
          class="ai-input__retry-button"
          type="button"
        >
          Retry
        </button>
      </div>

      <!-- Suggestions -->
      <div v-if="suggestions.length > 0" class="ai-input__suggestions">
        <div class="ai-input__suggestions-label">Suggestions:</div>
        <div class="ai-input__suggestions-list">
          <button
            v-for="(suggestion, index) in suggestions"
            :key="index"
            @click="applySuggestion(suggestion)"
            class="ai-input__suggestion-button"
            type="button"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <!-- Shortcuts Help -->
      <div v-if="showShortcuts" class="ai-input__shortcuts">
        <span class="ai-input__shortcuts-text">
          {{ submitOnEnter ? 'Enter to send, Shift+Enter for new line' : 'Ctrl+Enter to send' }}
        </span>
      </div>
    </div>

    <!-- File Input (Hidden) -->
    <input
      v-if="allowAttachments"
      ref="fileInputRef"
      type="file"
      class="ai-input__file-input"
      :accept="acceptedFileTypes"
      :multiple="allowMultipleFiles"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info'
  text: string
}

export interface AIInputProps {
  // Value
  modelValue?: string
  
  // Behavior
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string
  
  // Validation
  maxLength?: number
  minLength?: number
  required?: boolean
  customValidation?: (value: string) => ValidationMessage[]
  
  // UI Options
  autoResize?: boolean
  minRows?: number
  maxRows?: number
  showCharacterCount?: boolean
  showFooter?: boolean
  showShortcuts?: boolean
  showRetry?: boolean
  
  // Submit Options
  submitOnEnter?: boolean
  submitText?: string
  cancelText?: string
  
  // Features
  allowAttachments?: boolean
  allowVoiceInput?: boolean
  allowMultipleFiles?: boolean
  acceptedFileTypes?: string
  suggestions?: string[]
  
  // Button titles
  submitButtonTitle?: string
  attachmentButtonTitle?: string
  voiceButtonTitle?: string
}

const props = withDefaults(defineProps<AIInputProps>(), {
  modelValue: '',
  placeholder: 'Type your message...',
  disabled: false,
  isLoading: false,
  error: '',
  maxLength: 4000,
  minLength: 0,
  required: false,
  autoResize: true,
  minRows: 1,
  maxRows: 6,
  showCharacterCount: true,
  showFooter: true,
  showShortcuts: true,
  showRetry: true,
  submitOnEnter: true,
  submitText: 'Send',
  cancelText: 'Cancel',
  allowAttachments: false,
  allowVoiceInput: false,
  allowMultipleFiles: false,
  acceptedFileTypes: 'image/*,text/*,.pdf,.doc,.docx',
  suggestions: () => [],
  submitButtonTitle: 'Send message',
  attachmentButtonTitle: 'Attach file',
  voiceButtonTitle: 'Voice input'
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [value: string]
  cancel: []
  retry: []
  focus: []
  blur: []
  attachment: [files: FileList]
  voiceStart: []
  voiceEnd: [transcript: string]
  voiceError: [error: string]
}>()

// Refs
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const inputValue = ref(props.modelValue)
const isFocused = ref(false)
const isRecording = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)

// Computed
const characterCount = computed(() => inputValue.value.length)

const isNearLimit = computed(() => {
  if (!props.maxLength) return false
  return characterCount.value > props.maxLength * 0.8
})

const isOverLimit = computed(() => {
  if (!props.maxLength) return false
  return characterCount.value > props.maxLength
})

const computedRows = computed(() => {
  if (!props.autoResize) return props.minRows
  
  const lines = inputValue.value.split('\n').length
  return Math.min(Math.max(lines, props.minRows), props.maxRows)
})

const validationMessages = computed((): ValidationMessage[] => {
  const messages: ValidationMessage[] = []
  
  // Required validation
  if (props.required && !inputValue.value.trim()) {
    messages.push({
      type: 'error',
      text: 'This field is required'
    })
  }
  
  // Length validations
  if (props.minLength && inputValue.value.length < props.minLength) {
    messages.push({
      type: 'error',
      text: `Minimum ${props.minLength} characters required`
    })
  }
  
  if (props.maxLength && inputValue.value.length > props.maxLength) {
    messages.push({
      type: 'error',
      text: `Maximum ${props.maxLength} characters allowed`
    })
  }
  
  // Custom validation
  if (props.customValidation) {
    messages.push(...props.customValidation(inputValue.value))
  }
  
  return messages
})

const hasErrors = computed(() => {
  return validationMessages.value.some(msg => msg.type === 'error') || !!props.error
})

const canSubmit = computed(() => {
  return inputValue.value.trim().length > 0 && 
         !hasErrors.value && 
         !props.disabled
})

const submitButtonTitle = computed(() => {
  if (props.isLoading) return 'Cancel current operation'
  if (!canSubmit.value) return 'Enter a message to send'
  return props.submitButtonTitle
})

// Methods
const handleInput = () => {
  emit('update:modelValue', inputValue.value)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.submitOnEnter && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  } else if (!props.submitOnEnter && event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    handleSubmit()
  }
}

const handlePaste = (event: ClipboardEvent) => {
  // Handle file paste
  const items = event.clipboardData?.items
  if (items && props.allowAttachments) {
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const fileList = new DataTransfer()
          fileList.items.add(file)
          emit('attachment', fileList.files)
        }
      }
    }
  }
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
}

const handleSubmit = () => {
  if (props.isLoading) {
    emit('cancel')
  } else if (canSubmit.value) {
    emit('submit', inputValue.value.trim())
    if (!props.isLoading) {
      inputValue.value = ''
      emit('update:modelValue', '')
    }
  }
}

const handleRetry = () => {
  emit('retry')
}

const handleAttachment = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('attachment', target.files)
    // Reset file input
    target.value = ''
  }
}

const applySuggestion = (suggestion: string) => {
  inputValue.value = suggestion
  emit('update:modelValue', suggestion)
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const toggleVoiceInput = async () => {
  if (isRecording.value) {
    stopVoiceInput()
  } else {
    await startVoiceInput()
  }
}

const startVoiceInput = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    
    const audioChunks: Blob[] = []
    
    mediaRecorder.value.ondataavailable = (event) => {
      audioChunks.push(event.data)
    }
    
    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      
      // Here you would typically send the audio to a speech-to-text service
      // For now, we'll just emit a placeholder transcript
      const transcript = 'Voice input not implemented yet'
      emit('voiceEnd', transcript)
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop())
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    emit('voiceStart')
    
  } catch (error) {
    console.error('Voice input error:', error)
    emit('voiceError', 'Failed to access microphone')
  }
}

const stopVoiceInput = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
  }
}

const focus = () => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const clear = () => {
  inputValue.value = ''
  emit('update:modelValue', '')
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (newValue !== inputValue.value) {
    inputValue.value = newValue
  }
})

// Lifecycle
onMounted(() => {
  if (props.modelValue) {
    inputValue.value = props.modelValue
  }
})

onUnmounted(() => {
  if (isRecording.value) {
    stopVoiceInput()
  }
})

// Expose methods
defineExpose({
  focus,
  clear,
  blur: () => textareaRef.value?.blur()
})
</script>

<style scoped>
.ai-input {
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: all 0.2s ease;
}

.ai-input:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.ai-input--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.ai-input--loading {
  opacity: 0.8;
}

.ai-input--error {
  border-color: #ef4444;
}

.ai-input--error:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Container */
.ai-input__container {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0.75rem;
}

/* Textarea */
.ai-input__textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.875rem;
  line-height: 1.5;
  font-family: inherit;
  background: transparent;
  min-height: 1.5rem;
}

.ai-input__textarea::placeholder {
  color: #9ca3af;
}

.ai-input__textarea:disabled {
  color: #6b7280;
}

/* Character Count */
.ai-input__character-count {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.ai-input__character-count--warning {
  color: #d97706;
  border-color: #fbbf24;
}

.ai-input__character-count--error {
  color: #dc2626;
  border-color: #f87171;
}

/* Actions */
.ai-input__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ai-input__action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.ai-input__action-button:hover:not(:disabled) {
  background: #e5e7eb;
  color: #374151;
}

.ai-input__action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-input__action-button--active {
  background: #ef4444;
  color: white;
}

.ai-input__action-button--active:hover {
  background: #dc2626;
}

/* Submit Button */
.ai-input__submit-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-input__submit-button:hover:not(:disabled) {
  background: #2563eb;
}

.ai-input__submit-button--cancel {
  background: #ef4444;
}

.ai-input__submit-button--cancel:hover {
  background: #dc2626;
}

.ai-input__submit-button--disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.ai-input__submit-icon {
  font-size: 1rem;
}

/* Footer */
.ai-input__footer {
  border-top: 1px solid #e5e7eb;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0 0 8px 8px;
}

/* Validation */
.ai-input__validation {
  margin-bottom: 0.5rem;
}

.ai-input__validation-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.ai-input__validation-message--error {
  color: #dc2626;
}

.ai-input__validation-message--warning {
  color: #d97706;
}

.ai-input__validation-message--info {
  color: #2563eb;
}

/* Error */
.ai-input__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #dc2626;
}

.ai-input__retry-button {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.ai-input__retry-button:hover {
  background: #b91c1c;
}

/* Suggestions */
.ai-input__suggestions {
  margin-bottom: 0.5rem;
}

.ai-input__suggestions-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.ai-input__suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ai-input__suggestion-button {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-input__suggestion-button:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

/* Shortcuts */
.ai-input__shortcuts {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

/* File Input */
.ai-input__file-input {
  display: none;
}

/* Responsive */
@media (max-width: 640px) {
  .ai-input__container {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .ai-input__actions {
    justify-content: flex-end;
  }
  
  .ai-input__submit-button {
    width: 100%;
    justify-content: center;
  }
  
  .ai-input__character-count {
    position: static;
    align-self: flex-end;
    margin-top: 0.5rem;
  }
  
  .ai-input__suggestions-list {
    flex-direction: column;
  }
  
  .ai-input__suggestion-button {
    width: 100%;
    text-align: left;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .ai-input {
    background: #1f2937;
    border-color: #374151;
    color: #e5e7eb;
  }
  
  .ai-input__textarea {
    color: #e5e7eb;
  }
  
  .ai-input__textarea::placeholder {
    color: #9ca3af;
  }
  
  .ai-input__footer {
    background: #111827;
    border-color: #374151;
  }
  
  .ai-input__character-count {
    background: #1f2937;
    border-color: #374151;
    color: #9ca3af;
  }
  
  .ai-input__action-button {
    background: #374151;
    color: #9ca3af;
  }
  
  .ai-input__action-button:hover:not(:disabled) {
    background: #4b5563;
    color: #e5e7eb;
  }
}
</style>