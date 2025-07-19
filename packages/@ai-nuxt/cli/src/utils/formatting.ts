/**
 * Formatting utilities for AI Nuxt CLI
 */

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

/**
 * Format timestamp to human readable string
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleString()
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  if (diffMs < 60000) { // Less than 1 minute
    return 'just now'
  }
  
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }
  
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
  }
  
  const diffYears = Math.floor(diffMonths / 12)
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, total: number, decimals = 1): string {
  if (total === 0) return '0%'
  const percentage = (value / total) * 100
  return `${percentage.toFixed(decimals)}%`
}

/**
 * Truncate string with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
}

/**
 * Convert camelCase to PascalCase
 */
export function camelToPascal(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Convert PascalCase to camelCase
 */
export function pascalToCamel(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

/**
 * Pluralize word
 */
export function pluralize(word: string, count: number): string {
  if (count === 1) return word
  
  // Simple pluralization rules
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies'
  } else if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
    return word + 'es'
  } else {
    return word + 's'
  }
}

/**
 * Format list with proper conjunctions
 */
export function formatList(items: string[], conjunction = 'and'): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  
  const lastItem = items[items.length - 1]
  const otherItems = items.slice(0, -1)
  
  return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`
}

/**
 * Format command for display
 */
export function formatCommand(command: string, args: string[] = []): string {
  const fullCommand = [command, ...args].join(' ')
  return `\`${fullCommand}\``
}

/**
 * Format code block
 */
export function formatCodeBlock(code: string, language = ''): string {
  return `\`\`\`${language}\n${code}\n\`\`\``
}

/**
 * Format table row
 */
export function formatTableRow(columns: string[], widths: number[]): string {
  return columns
    .map((col, i) => col.padEnd(widths[i] || 0))
    .join(' | ')
}

/**
 * Create table separator
 */
export function createTableSeparator(widths: number[]): string {
  return widths
    .map(width => '-'.repeat(width))
    .join('-|-')
}