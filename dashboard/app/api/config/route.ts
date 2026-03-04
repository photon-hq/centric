import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), '..', 'config', 'scraper.config.json')

interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
  autoUpdateEnabled?: boolean
  autoUpdateIntervalMinutes?: number
  lastScraped?: string
  totalPages?: number
  lastScrapeStats?: {
    processedPages: number
    newPages: number
    updatedPages: number
    unchangedPages: number
    discoveredUrls: number
  }
}

// GET - Load configuration
export async function GET() {
  try {
    const fileContent = await fs.readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(fileContent)
    
    // Extract only the actual config values (ignore comment fields starting with /**)
    const cleanConfig: ScrapeConfig = {
      websiteUrl: config.websiteUrl || '',
      includeSameOriginSubdomains: config.includeSameOriginSubdomains ?? true,
      maxDepth: config.maxDepth || 3,
      autoUpdateEnabled: config.autoUpdateEnabled ?? false,
      autoUpdateIntervalMinutes: config.autoUpdateIntervalMinutes || 60,
      lastScraped: config.lastScraped,
      totalPages: config.totalPages,
      lastScrapeStats: config.lastScrapeStats
    }
    
    return NextResponse.json({ config: cleanConfig })
  } catch (error) {
    // If file doesn't exist, return default config
    return NextResponse.json({
      config: {
        websiteUrl: '',
        includeSameOriginSubdomains: true,
        maxDepth: 3,
        autoUpdateEnabled: false,
        autoUpdateIntervalMinutes: 60
      }
    })
  }
}

// POST - Save configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received config:', body)
    
    const config: ScrapeConfig = body
    
    // Validate config structure (but allow empty URL for initial setup)
    if (typeof config.websiteUrl !== 'string') {
      console.error('Invalid websiteUrl type:', typeof config.websiteUrl, config.websiteUrl)
      return NextResponse.json(
        { error: `Invalid websiteUrl: expected string, got ${typeof config.websiteUrl}` },
        { status: 400 }
      )
    }
    
    if (typeof config.includeSameOriginSubdomains !== 'boolean') {
      console.error('Invalid includeSameOriginSubdomains type:', typeof config.includeSameOriginSubdomains)
      return NextResponse.json(
        { error: `Invalid includeSameOriginSubdomains: expected boolean, got ${typeof config.includeSameOriginSubdomains}` },
        { status: 400 }
      )
    }
    
    if (typeof config.maxDepth !== 'number') {
      console.error('Invalid maxDepth type:', typeof config.maxDepth, config.maxDepth)
      return NextResponse.json(
        { error: `Invalid maxDepth: expected number, got ${typeof config.maxDepth}` },
        { status: 400 }
      )
    }

    // Normalize URL - add https:// if no protocol specified (and URL is not empty)
    let normalizedUrl = config.websiteUrl.trim()
    if (normalizedUrl && !normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE)
    await fs.mkdir(configDir, { recursive: true })

    // Read existing config to preserve comments/structure if it exists
    let existingContent: any = {}
    try {
      const existing = await fs.readFile(CONFIG_FILE, 'utf-8')
      existingContent = JSON.parse(existing)
    } catch {
      // File doesn't exist yet, that's fine
    }

    // Merge with new config - only update the actual config fields
    const updatedConfig = {
      ...existingContent,
      websiteUrl: normalizedUrl,
      includeSameOriginSubdomains: config.includeSameOriginSubdomains,
      maxDepth: config.maxDepth,
      autoUpdateEnabled: config.autoUpdateEnabled ?? existingContent.autoUpdateEnabled ?? false,
      autoUpdateIntervalMinutes: config.autoUpdateIntervalMinutes ?? existingContent.autoUpdateIntervalMinutes ?? 60
    }
    
    // Only add these if they're defined
    if (config.lastScraped) updatedConfig.lastScraped = config.lastScraped
    if (config.totalPages !== undefined) updatedConfig.totalPages = config.totalPages
    if (config.lastScrapeStats) updatedConfig.lastScrapeStats = config.lastScrapeStats

    // Save config
    await fs.writeFile(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2))
    console.log('Config saved successfully')

    return NextResponse.json({ success: true, config: updatedConfig })
  } catch (error) {
    console.error('Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
