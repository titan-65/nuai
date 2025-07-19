#!/usr/bin/env node

/**
 * Bundle size monitoring script for CI/CD
 * Checks bundle sizes and fails if they exceed thresholds
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Bundle size thresholds (in bytes)
const THRESHOLDS = {
  '@ai-nuxt/core': {
    main: 100 * 1024, // 100KB
    providers: 50 * 1024, // 50KB per provider
    cache: 25 * 1024, // 25KB
    'vector-store': 40 * 1024, // 40KB
    agents: 60 * 1024, // 60KB
    monitoring: 30 * 1024, // 30KB
    security: 20 * 1024, // 20KB
    compliance: 15 * 1024, // 15KB
    testing: 35 * 1024, // 35KB
    performance: 20 * 1024 // 20KB
  },
  '@ai-nuxt/module': {
    main: 50 * 1024 // 50KB
  },
  '@ai-nuxt/cli': {
    main: 200 * 1024 // 200KB (CLI can be larger)
  }
}

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getFileSize(filePath) {
  try {
    if (!existsSync(filePath)) {
      return 0
    }
    const stats = readFileSync(filePath)
    return stats.length
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}`)
    return 0
  }
}

function checkPackageBundles(packageName, packagePath) {
  console.log(`\n${colors.blue}📦 Checking ${packageName}${colors.reset}`)
  
  const distPath = join(packagePath, 'dist')
  const thresholds = THRESHOLDS[packageName] || {}
  
  let hasViolations = false
  const results = []

  // Check each bundle type
  for (const [bundleName, threshold] of Object.entries(thresholds)) {
    const bundlePath = bundleName === 'main' 
      ? join(distPath, 'index.mjs')
      : join(distPath, `${bundleName}/index.mjs`)
    
    const size = getFileSize(bundlePath)
    const isViolation = size > threshold
    
    if (isViolation) {
      hasViolations = true
    }
    
    const status = isViolation ? 
      `${colors.red}❌ EXCEEDED${colors.reset}` : 
      `${colors.green}✅ OK${colors.reset}`
    
    const sizeInfo = `${formatBytes(size)} / ${formatBytes(threshold)}`
    const percentage = threshold > 0 ? ((size / threshold) * 100).toFixed(1) : '0'
    
    console.log(`  ${bundleName.padEnd(15)} ${status} ${sizeInfo} (${percentage}%)`)
    
    results.push({
      bundle: bundleName,
      size,
      threshold,
      isViolation,
      percentage: parseFloat(percentage)
    })
  }
  
  return { hasViolations, results }
}

function generateReport(allResults) {
  console.log(`\n${colors.blue}📊 Bundle Size Report${colors.reset}`)
  console.log('=' .repeat(60))
  
  let totalSize = 0
  let totalThreshold = 0
  let violationCount = 0
  
  for (const [packageName, { results }] of Object.entries(allResults)) {
    console.log(`\n${packageName}:`)
    
    for (const result of results) {
      totalSize += result.size
      totalThreshold += result.threshold
      
      if (result.isViolation) {
        violationCount++
        console.log(`  ${colors.red}⚠️  ${result.bundle}: ${formatBytes(result.size)} (${result.percentage}% of limit)${colors.reset}`)
      }
    }
  }
  
  console.log(`\nTotal bundle size: ${formatBytes(totalSize)}`)
  console.log(`Total threshold: ${formatBytes(totalThreshold)}`)
  console.log(`Overall usage: ${((totalSize / totalThreshold) * 100).toFixed(1)}%`)
  
  if (violationCount > 0) {
    console.log(`\n${colors.red}❌ ${violationCount} bundle(s) exceeded size limits${colors.reset}`)
    
    console.log(`\n${colors.yellow}💡 Optimization suggestions:${colors.reset}`)
    console.log('  • Enable tree-shaking in your bundler configuration')
    console.log('  • Use dynamic imports for large features')
    console.log('  • Consider splitting large providers into separate chunks')
    console.log('  • Remove unused dependencies and features')
    console.log('  • Use the useAIPerformance composable to analyze bundle composition')
    
    return false
  } else {
    console.log(`\n${colors.green}✅ All bundles are within size limits${colors.reset}`)
    return true
  }
}

function main() {
  console.log(`${colors.blue}🔍 AI Nuxt Bundle Size Check${colors.reset}`)
  console.log('Checking bundle sizes against defined thresholds...\n')
  
  const packagesDir = join(__dirname, '..', 'packages', '@ai-nuxt')
  const allResults = {}
  let hasAnyViolations = false
  
  // Check each package
  for (const packageName of Object.keys(THRESHOLDS)) {
    const packagePath = join(packagesDir, packageName.replace('@ai-nuxt/', ''))
    
    if (!existsSync(packagePath)) {
      console.warn(`Warning: Package ${packageName} not found at ${packagePath}`)
      continue
    }
    
    const { hasViolations, results } = checkPackageBundles(packageName, packagePath)
    allResults[packageName] = { hasViolations, results }
    
    if (hasViolations) {
      hasAnyViolations = true
    }
  }
  
  // Generate final report
  const success = generateReport(allResults)
  
  // Exit with appropriate code
  if (!success) {
    console.log(`\n${colors.red}Bundle size check failed. Please optimize your bundles.${colors.reset}`)
    process.exit(1)
  } else {
    console.log(`\n${colors.green}Bundle size check passed!${colors.reset}`)
    process.exit(0)
  }
}

// Run the check
main()