import { promises as fs } from 'fs'
import path from 'path'

const VERSION_FILE = path.join(process.cwd(), '..', 'config', 'kb-version.json')

interface KnowledgeVersion {
  version: string
  updatedAt: string
}

export async function readKnowledgeVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(VERSION_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as KnowledgeVersion
    return parsed.version || '0'
  } catch {
    return '0'
  }
}

export async function bumpKnowledgeVersion(): Promise<string> {
  const now = new Date().toISOString()
  const payload: KnowledgeVersion = {
    version: now,
    updatedAt: now
  }

  await fs.mkdir(path.dirname(VERSION_FILE), { recursive: true })
  await fs.writeFile(VERSION_FILE, JSON.stringify(payload, null, 2))
  return payload.version
}
