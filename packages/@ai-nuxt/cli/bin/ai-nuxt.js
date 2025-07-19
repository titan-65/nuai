#!/usr/bin/env node

const { runCLI } = require('../dist/index.cjs')

// Run the CLI
runCLI().catch((err) => {
  console.error('\n\n🔴 Error:', err.message || err)
  process.exit(1)
})