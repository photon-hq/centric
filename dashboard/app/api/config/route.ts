import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), '..', 'config', 'scraper.config.json')

interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
  lastScraped?: string
  totalPages?: number
}

// GET - Load configuration
export async function GET() {
  try {
    const fileContent = await fs.readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(fileContent)
    return NextResponse.json({ config })
  } catch (error) {
    // If file doesn't exist, return default config
    return NextResponse.json({
      config: {
        websiteUrl: '',
        includeSameOriginSubdomains: true,
        maxDepth: 3
      }
    })
  }
}

// POST - Save configuration
export async function POST(request: NextRequest) {
  try {
    const config: ScrapeConfig = await request.json()
    
    // Validate config
    if (!config.websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      )
    }

    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE)
    await fs.mkdir(configDir, { recursive: true })

    // Save config
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving config:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
