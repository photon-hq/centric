import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'

interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
}

const CONFIG_FILE = path.join(process.cwd(), '..', 'config', 'scraper.config.json')
const DOCUMENTS_DIR = path.join(process.cwd(), '..', 'documents')

// Helper to check if URL is same origin or subdomain
function isSameOriginOrSubdomain(baseUrl: string, targetUrl: string, includeSameOriginSubdomains: boolean): boolean {
  try {
    const base = new URL(baseUrl)
    const target = new URL(targetUrl)

    if (base.hostname === target.hostname) {
      return true
    }

    if (includeSameOriginSubdomains) {
      // Check if target is a subdomain of base
      const baseParts = base.hostname.split('.')
      const targetParts = target.hostname.split('.')

      // Get root domain (last 2 parts, e.g., example.com)
      const baseRoot = baseParts.slice(-2).join('.')
      const targetRoot = targetParts.slice(-2).join('.')

      return baseRoot === targetRoot
    }

    return false
  } catch {
    return false
  }
}

// Helper to normalize URL
function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    // Handle relative URLs
    const absoluteUrl = new URL(url, baseUrl)
    
    // Remove fragments
    absoluteUrl.hash = ''
    
    // Remove common tracking parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid']
    paramsToRemove.forEach(param => absoluteUrl.searchParams.delete(param))
    
    return absoluteUrl.href
  } catch {
    return null
  }
}

// Helper to sanitize filename
function sanitizeFilename(url: string): string {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname === '/' ? 'index' : urlObj.pathname
  return `scraped_${urlObj.hostname}${pathname}`
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200) + '.md'
}

// Helper to extract text content from HTML
function extractTextContent(html: string, url: string): string {
  const $ = cheerio.load(html)
  
  // Remove script, style, nav, footer, and other non-content elements
  $('script, style, nav, footer, header, aside, iframe, noscript').remove()
  $('.nav, .footer, .header, .sidebar, .menu, .advertisement').remove()
  
  // Get title
  const title = $('title').text() || $('h1').first().text() || 'Untitled'
  
  // Get main content
  let content = ''
  const mainContent = $('main, article, .content, .main, #content, #main').first()
  
  if (mainContent.length > 0) {
    content = mainContent.text()
  } else {
    content = $('body').text()
  }
  
  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
  
  // Format as markdown
  return `# ${title}\n\nSource: ${url}\n\n${content}\n`
}

// Main scraping function
async function scrapeWebsite(
  config: ScrapeConfig,
  encoder: TextEncoder,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [{ url: config.websiteUrl, depth: 0 }]
  let scrapedCount = 0

  // Ensure documents directory exists
  await fs.mkdir(DOCUMENTS_DIR, { recursive: true })

  // Send progress update helper
  const sendProgress = async (data: any) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!

    if (visited.has(url) || depth > config.maxDepth) {
      continue
    }

    visited.add(url)

    try {
      await sendProgress({
        type: 'progress',
        current: scrapedCount,
        total: visited.size + queue.length,
        url
      })

      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AI-Knowledge-Base-Scraper/1.0'
        }
      })

      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        continue
      }

      const html = await response.text()

      // Extract text content
      const content = extractTextContent(html, url)

      // Save to file
      const filename = sanitizeFilename(url)
      const filepath = path.join(DOCUMENTS_DIR, filename)
      await fs.writeFile(filepath, content)

      scrapedCount++

      // Extract links if we haven't reached max depth
      if (depth < config.maxDepth) {
        const $ = cheerio.load(html)
        const links = $('a[href]')
          .map((_, el) => $(el).attr('href'))
          .get()

        for (const link of links) {
          const normalizedUrl = normalizeUrl(link, url)
          
          if (
            normalizedUrl &&
            !visited.has(normalizedUrl) &&
            !queue.some(item => item.url === normalizedUrl) &&
            isSameOriginOrSubdomain(config.websiteUrl, normalizedUrl, config.includeSameOriginSubdomains)
          ) {
            queue.push({ url: normalizedUrl, depth: depth + 1 })
          }
        }
      }

      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error(`Error scraping ${url}:`, error)
      // Continue with other URLs
    }
  }

  // Update config with scraping stats
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf-8')
    const savedConfig = JSON.parse(configContent)
    savedConfig.lastScraped = new Date().toISOString()
    savedConfig.totalPages = scrapedCount
    await fs.writeFile(CONFIG_FILE, JSON.stringify(savedConfig, null, 2))
  } catch (error) {
    console.error('Error updating config:', error)
  }

  await sendProgress({
    type: 'complete',
    totalPages: scrapedCount
  })
}

export async function POST(request: NextRequest) {
  const config: ScrapeConfig = await request.json()

  // Validate config
  if (!config.websiteUrl) {
    return new Response(
      JSON.stringify({ error: 'Website URL is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate URL format
  try {
    new URL(config.websiteUrl)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Create a ReadableStream for Server-Sent Events
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const writer = controller

      try {
        await scrapeWebsite(config, encoder, writer as any)
      } catch (error) {
        await writer.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error occurred'
            })}\n\n`
          )
        )
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
