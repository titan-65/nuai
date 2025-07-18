import { createPinia } from 'pinia'
import { useAIStore } from '../stores/ai'

export default defineNuxtPlugin((nuxtApp) => {
  // Create Pinia instance
  const pinia = createPinia()
  
  // Install Pinia
  nuxtApp.vueApp.use(pinia)
  
  // Initialize AI store on client side
  if (process.client) {
    const aiStore = useAIStore()
    aiStore.initialize()
  }
  
  return {
    provide: {
      pinia
    }
  }
})