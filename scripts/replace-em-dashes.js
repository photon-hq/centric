#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

const root = process.cwd()
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.html', '.css', '.scss', '.py', '.java'])

// Target em-dash (, , U+2014) and en-dash (, , U+2013)
const EM_DASH = '\u2014'  // , 
const EN_DASH = '\u2013'  // , 
const REPLACEMENT = ', '  // comma + space

let totalFixed = 0

async function walk(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'build') continue
        await walk(full)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (!exts.has(ext)) continue
        try {
          let content = await fs.readFile(full, 'utf8')
          // Check for either em-dash or en-dash
          if (content.includes(EM_DASH) || content.includes(EN_DASH)) {
            const before = content
            const replaced = content.replace(/\u2014|\u2013/g, REPLACEMENT)
            await fs.writeFile(full, replaced, 'utf8')
            const count = (before.match(/\u2014|\u2013/g) || []).length
            console.log(`✓ Fixed ${count} dash(es) in: ${path.relative(root, full)}`)
            totalFixed += count
          }
        } catch (e) {
          if (e && !e.message.includes('EACCES')) {
            console.warn(`⚠️  Skipped: ${path.relative(root, full)} (${e.message})`)
          }
        }
      }
    }
  } catch (e) {
    console.warn(`⚠️  Skipped directory: ${path.relative(root, dir)}`)
  }
}

walk(root).then(() => {
  if (totalFixed === 0) {
    console.log('✓ No em-dashes or en-dashes found')
  } else {
    console.log(`✓ Replaced ${totalFixed} dash character(s) across codebase`)
  }
}).catch(err => {
  console.error('❌ Error running replace-em-dashes:', err)
  process.exit(1)
})
