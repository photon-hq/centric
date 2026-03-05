#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'

const root = process.cwd()
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.html', '.css', '.scss', '.py', '.java'])

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      await walk(full)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!exts.has(ext)) continue
      try {
        let content = await fs.readFile(full, 'utf8')
        if (content.includes('\u2014') || content.includes('\u2013')) {
          const replaced = content.replace(/\u2014|\u2013/g, ', ')
          await fs.writeFile(full, replaced, 'utf8')
          console.log(`Fixed dashes in: ${path.relative(root, full)}`)
        }
      } catch (e) {
        // ignore read/write errors
      }
    }
  }
}

walk(root).catch(err => {
  console.error('Error running replace-em-dashes:', err)
  process.exit(1)
})
