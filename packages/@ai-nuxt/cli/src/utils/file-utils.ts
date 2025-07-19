import fs from 'fs-extra'
import path from 'path'

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath)
}

/**
 * Read JSON file safely
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Write JSON file safely
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

/**
 * Copy file with error handling
 */
export async function copyFile(src: string, dest: string): Promise<boolean> {
  try {
    await fs.copy(src, dest)
    return true
  } catch {
    return false
  }
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase()
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath))
}

/**
 * Check if path is safe (no directory traversal)
 */
export function isSafePath(filePath: string, basePath: string): boolean {
  const resolvedPath = path.resolve(basePath, filePath)
  const resolvedBase = path.resolve(basePath)
  return resolvedPath.startsWith(resolvedBase)
}

/**
 * Get relative path from base
 */
export function getRelativePath(filePath: string, basePath: string): string {
  return path.relative(basePath, filePath)
}

/**
 * Find files matching pattern
 */
export async function findFiles(
  directory: string,
  pattern: RegExp,
  recursive = true
): Promise<string[]> {
  const files: string[] = []
  
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory() && recursive) {
        await scan(fullPath)
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath)
      }
    }
  }
  
  await scan(directory)
  return files
}

/**
 * Get directory size
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0
  
  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath)
        size += stat.size
      }
    }
  }
  
  await scan(dirPath)
  return size
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}