/**
 * Validation utilities for AI Nuxt CLI
 */

/**
 * Validate project name
 */
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Project name is required' }
  }
  
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { 
      valid: false, 
      error: 'Project name can only contain lowercase letters, numbers, and hyphens' 
    }
  }
  
  if (name.startsWith('-') || name.endsWith('-')) {
    return { 
      valid: false, 
      error: 'Project name cannot start or end with a hyphen' 
    }
  }
  
  if (name.length > 50) {
    return { 
      valid: false, 
      error: 'Project name must be 50 characters or less' 
    }
  }
  
  return { valid: true }
}

/**
 * Validate component name
 */
export function validateComponentName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Component name is required' }
  }
  
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return { 
      valid: false, 
      error: 'Component name should be in PascalCase (e.g., MyComponent)' 
    }
  }
  
  if (name.length > 50) {
    return { 
      valid: false, 
      error: 'Component name must be 50 characters or less' 
    }
  }
  
  return { valid: true }
}

/**
 * Validate agent name
 */
export function validateAgentName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Agent name is required' }
  }
  
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return { 
      valid: false, 
      error: 'Agent name should be in PascalCase (e.g., MyAgent)' 
    }
  }
  
  if (name.length > 50) {
    return { 
      valid: false, 
      error: 'Agent name must be 50 characters or less' 
    }
  }
  
  return { valid: true }
}

/**
 * Validate prompt name
 */
export function validatePromptName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Prompt name is required' }
  }
  
  if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    return { 
      valid: false, 
      error: 'Prompt name should be in camelCase (e.g., myPrompt)' 
    }
  }
  
  if (name.length > 50) {
    return { 
      valid: false, 
      error: 'Prompt name must be 50 characters or less' 
    }
  }
  
  return { valid: true }
}

/**
 * Validate email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  return { valid: true }
}

/**
 * Validate URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL is required' }
  }
  
  try {
    new URL(url)
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string, provider: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' }
  }
  
  switch (provider.toLowerCase()) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API key should start with "sk-"' }
      }
      break
    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API key should start with "sk-ant-"' }
      }
      break
  }
  
  if (apiKey.length < 10) {
    return { valid: false, error: 'API key is too short' }
  }
  
  return { valid: true }
}

/**
 * Validate port number
 */
export function validatePort(port: string | number): { valid: boolean; error?: string } {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port
  
  if (isNaN(portNum)) {
    return { valid: false, error: 'Port must be a number' }
  }
  
  if (portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' }
  }
  
  if (portNum < 1024 && process.platform !== 'win32') {
    return { 
      valid: false, 
      error: 'Ports below 1024 require administrator privileges on Unix systems' 
    }
  }
  
  return { valid: true }
}

/**
 * Validate file path
 */
export function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  if (!filePath || filePath.trim().length === 0) {
    return { valid: false, error: 'File path is required' }
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"|?*]/
  if (invalidChars.test(filePath)) {
    return { valid: false, error: 'File path contains invalid characters' }
  }
  
  // Check for directory traversal
  if (filePath.includes('..')) {
    return { valid: false, error: 'File path cannot contain ".."' }
  }
  
  return { valid: true }
}

/**
 * Validate JSON string
 */
export function validateJson(jsonString: string): { valid: boolean; error?: string; data?: any } {
  if (!jsonString || jsonString.trim().length === 0) {
    return { valid: false, error: 'JSON string is required' }
  }
  
  try {
    const data = JSON.parse(jsonString)
    return { valid: true, data }
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' }
  }
}