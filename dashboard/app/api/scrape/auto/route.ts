import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { runScrape, type ScrapeConfig, type ScrapeSummary } from '../../../../lib/scrape-engine'
import { bumpKnowledgeVersion } from '../../../../lib/knowledge-version'

const CONFIG_FILE = path.join(process.cwd(), '..', 'config', 'scraper.config.json')

let autoUpdateTimer: NodeJS.Timeout | null = null
let autoUpdateRunning = false
let autoUpdateLastRun: string | null = null
let autoUpdateLastResult: ScrapeSummary | null = null

interface AutoUpdateStatus {
  enabled: boolean
  intervalMinutes: number
  running: boolean
  lastRun: string | null
  lastResult: ScrapeSummary | null
}

interface PersistedScrapeConfig extends ScrapeConfig {
  autoUpdateEnabled?: boolean
  autoUpdateIntervalMinutes?: number
}

async function loadConfig(): Promise<PersistedScrapeConfig> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      websiteUrl: parsed.websiteUrl || '',
      includeSameOriginSubdomains: parsed.includeSameOriginSubdomains ?? true,
      maxDepth: parsed.maxDepth || 3,
      autoUpdateEnabled: parsed.autoUpdateEnabled ?? false,
      autoUpdateIntervalMinutes: parsed.autoUpdateIntervalMinutes || 60
    }
  } catch {
    return {
      websiteUrl: '',
      includeSameOriginSubdomains: true,
      maxDepth: 3,
      autoUpdateEnabled: false,
      autoUpdateIntervalMinutes: 60
    }
  }
}

async function saveAutoConfig(enabled: boolean, intervalMinutes: number): Promise<void> {
  let existing: Record<string, unknown> = {}
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    existing = JSON.parse(raw)
  } catch {
    existing = {}
  }

  const nextConfig = {
    ...existing,
    autoUpdateEnabled: enabled,
    autoUpdateIntervalMinutes: intervalMinutes
  }

  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(nextConfig, null, 2))
}

function stopAutoUpdate(): void {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer)
    autoUpdateTimer = null
  }
}

async function runAutoUpdateOnce(): Promise<void> {
  if (autoUpdateRunning) {
    return
  }

  const config = await loadConfig()
  if (!config.autoUpdateEnabled || !config.websiteUrl) {
    return
  }

  autoUpdateRunning = true
  try {
    const summary = await runScrape(config)
    autoUpdateLastRun = new Date().toISOString()
    autoUpdateLastResult = summary

    if (summary.newPages > 0 || summary.updatedPages > 0) {
      await bumpKnowledgeVersion()
    }
  } finally {
    autoUpdateRunning = false
  }
}

function startAutoUpdate(intervalMinutes: number): void {
  stopAutoUpdate()
  autoUpdateTimer = setInterval(() => {
    runAutoUpdateOnce().catch((error) => {
      console.error('Auto update run failed:', error)
    })
  }, intervalMinutes * 60 * 1000)
}

async function ensureSchedulerFromConfig(): Promise<void> {
  const config = await loadConfig()
  if (config.autoUpdateEnabled && !autoUpdateTimer) {
    startAutoUpdate(config.autoUpdateIntervalMinutes || 60)
  }
}

export async function GET() {
  await ensureSchedulerFromConfig()
  const config = await loadConfig()
  const status: AutoUpdateStatus = {
    enabled: config.autoUpdateEnabled ?? false,
    intervalMinutes: config.autoUpdateIntervalMinutes || 60,
    running: autoUpdateRunning,
    lastRun: autoUpdateLastRun,
    lastResult: autoUpdateLastResult
  }

  return NextResponse.json(status)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action as 'configure' | 'run-now' | 'stop'

    if (action === 'run-now') {
      await runAutoUpdateOnce()
      return NextResponse.json({ success: true, message: 'Auto update run completed' })
    }

    if (action === 'stop') {
      stopAutoUpdate()
      await saveAutoConfig(false, body.intervalMinutes || 60)
      return NextResponse.json({ success: true, message: 'Auto update stopped' })
    }

    const enabled = Boolean(body.enabled)
    const parsed = Number(body.intervalMinutes)
    const intervalMinutes = Number.isFinite(parsed) ? Math.max(5, Math.min(1440, parsed)) : 60

    await saveAutoConfig(enabled, intervalMinutes)

    if (enabled) {
      startAutoUpdate(intervalMinutes)
      runAutoUpdateOnce().catch((error) => {
        console.error('Initial auto update run failed:', error)
      })
    } else {
      stopAutoUpdate()
    }

    return NextResponse.json({
      success: true,
      enabled,
      intervalMinutes,
      running: autoUpdateRunning
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to configure auto update',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
