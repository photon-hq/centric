import { promises as fs } from 'fs'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as cheerio from 'cheerio'

export interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
  autoUpdateEnabled?: boolean
  autoUpdateIntervalMinutes?: number
  lastScraped?: string
  totalPages?: number
}

export interface ScrapeProgress {
  current: number
  total: number
  url: string
}

export interface ScrapeSummary {
  processedPages: number
  newPages: number
  updatedPages: number
  unchangedPages: number
  discoveredUrls: number
  stalePagesRemoved: number
}

const CONFIG_FILE = path.join(process.cwd(), '..', 'config', 'scraper.config.json')
const DOCUMENTS_DIR = path.join(process.cwd(), '..', 'documents')

function isSameOriginOrSubdomain(baseUrl: string, targetUrl: string, includeSameOriginSubdomains: boolean): boolean {
  try {
    const base = new URL(baseUrl)
    const target = new URL(targetUrl)

    // Path-prefix scoping: if the base URL has a path beyond '/', only allow
    // URLs whose path starts with that same prefix (e.g. github.com/org should
    // not bleed into github.com/other-org).
    if (base.pathname !== '/') {
      const basePath = base.pathname.endsWith('/') ? base.pathname : base.pathname + '/'
      const targetPath = target.pathname.endsWith('/') ? target.pathname : target.pathname + '/'
      if (!targetPath.startsWith(basePath)) {
        return false
      }
    }

    // Exact hostname match is always allowed (same site, no subdomains involved)
    if (base.hostname === target.hostname) {
      return true
    }

    // Subdomain match only when explicitly enabled
    if (includeSameOriginSubdomains) {
      const baseParts = base.hostname.split('.')
      const targetParts = target.hostname.split('.')
      const baseRoot = baseParts.slice(-2).join('.')
      const targetRoot = targetParts.slice(-2).join('.')
      return baseRoot === targetRoot
    }

    return false
  } catch {
    return false
  }
}

export function normalizeWebsiteUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('Website URL is required')
  }

  const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`
  new URL(normalized)
  return normalized
}

function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const absoluteUrl = new URL(url, baseUrl)
    absoluteUrl.hash = ''

    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid']
    paramsToRemove.forEach(param => absoluteUrl.searchParams.delete(param))

    return absoluteUrl.href
  } catch {
    return null
  }
}

function sanitizeFilename(url: string): string {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname === '/' ? 'index' : urlObj.pathname
  return `scraped_${urlObj.hostname}${pathname}`
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200) + '.md'
}

function extractTextContent(html: string, url: string): string {
  const $ = cheerio.load(html)

  $('script, style, nav, footer, header, aside, iframe, noscript').remove()
  $('.nav, .footer, .header, .sidebar, .menu, .advertisement').remove()

  const title = $('title').text() || $('h1').first().text() || 'Untitled'

  let content = ''
  const mainContent = $('main, article, .content, .main, #content, #main').first()

  if (mainContent.length > 0) {
    content = mainContent.text()
  } else {
    content = $('body').text()
  }

  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()

  return `# ${title}\n\nSource: ${url}\n\n${content}\n`
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function extractSourceUrl(content: string): string | null {
  const match = content.match(/^Source:\s*(.+)$/m)
  return match ? match[1].trim() : null
}

async function loadExistingScrapedDocuments(): Promise<Map<string, { filepath: string; hash: string }>> {
  const map = new Map<string, { filepath: string; hash: string }>()

  if (!existsSync(DOCUMENTS_DIR)) {
    return map
  }

  const files = readdirSync(DOCUMENTS_DIR)
  for (const file of files) {
    if (!file.startsWith('scraped_') || !file.endsWith('.md')) {
      continue
    }

    const filepath = path.join(DOCUMENTS_DIR, file)
    try {
      const content = await fs.readFile(filepath, 'utf-8')
      const sourceUrl = extractSourceUrl(content)
      if (!sourceUrl) {
        continue
      }

      map.set(sourceUrl, {
        filepath,
        hash: hashContent(content)
      })
    } catch {
      continue
    }
  }

  return map
}

async function updateScrapeConfigStats(summary: ScrapeSummary): Promise<void> {
  try {
    const existingRaw = await fs.readFile(CONFIG_FILE, 'utf-8')
    const existing = JSON.parse(existingRaw)
    existing.lastScraped = new Date().toISOString()
    existing.totalPages = summary.processedPages
    existing.lastScrapeStats = summary
    await fs.writeFile(CONFIG_FILE, JSON.stringify(existing, null, 2))
  } catch {
    // ignore stats persistence errors
  }
}

// ============================================================================
// GitHub-specific scraper (uses GitHub API instead of HTML crawl)
// ============================================================================

function isGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'github.com'
  } catch {
    return false
  }
}

function parseGitHubUrl(url: string): { owner: string; repo?: string } | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length === 0) return null
    if (parts.length === 1) return { owner: parts[0] }
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

async function githubApiFetch(endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'AI-Knowledge-Base-Scraper/1.0',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(`https://api.github.com${endpoint}`, { headers })
  if (!response.ok) return null
  return response.json()
}

async function fetchAllPages(endpoint: string, token?: string): Promise<any[]> {
  const results: any[] = []
  let page = 1
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?'
    const data = await githubApiFetch(`${endpoint}${sep}per_page=100&page=${page}`, token)
    if (!data || !Array.isArray(data) || data.length === 0) break
    results.push(...data)
    if (data.length < 100) break
    page++
  }
  return results
}

async function runGitHubScrape(
  config: ScrapeConfig,
  onProgress?: (progress: ScrapeProgress) => Promise<void> | void
): Promise<ScrapeSummary> {
  const parsed = parseGitHubUrl(config.websiteUrl)
  if (!parsed) throw new Error('Invalid GitHub URL')

  const token = process.env.GITHUB_TOKEN
  const { owner, repo: singleRepo } = parsed

  await fs.mkdir(DOCUMENTS_DIR, { recursive: true })
  const existingDocsByUrl = await loadExistingScrapedDocuments()

  let processedPages = 0
  let newPages = 0
  let updatedPages = 0
  let unchangedPages = 0

  async function saveDoc(url: string, content: string) {
    const contentHash = hashContent(content)
    const existing = existingDocsByUrl.get(url)
    if (existing && existing.hash === contentHash) {
      unchangedPages++
    } else {
      const filename = existing ? path.basename(existing.filepath) : sanitizeFilename(url)
      const filepath = existing?.filepath || path.join(DOCUMENTS_DIR, filename)
      await fs.writeFile(filepath, content)
      existingDocsByUrl.set(url, { filepath, hash: contentHash })
      if (existing) updatedPages++; else newPages++
    }
    processedPages++
  }

  if (singleRepo) {
    // Single repo mode: profile + README only
    const urls = [`https://github.com/${owner}/${singleRepo}`]
    const total = 2

    if (onProgress) await onProgress({ current: 0, total, url: urls[0] })

    const repoData = await githubApiFetch(`/repos/${owner}/${singleRepo}`, token)
    if (repoData) {
      const topics = repoData.topics?.join(', ') || ''
      const content = `# ${repoData.full_name}\n\nSource: https://github.com/${owner}/${singleRepo}\n\n` +
        `**Description:** ${repoData.description || 'No description'}\n` +
        `**Language:** ${repoData.language || 'N/A'}\n` +
        `**Stars:** ${repoData.stargazers_count} | **Forks:** ${repoData.forks_count}\n` +
        `**Topics:** ${topics || 'None'}\n` +
        (repoData.homepage ? `**Homepage:** ${repoData.homepage}\n` : '') +
        `**Default Branch:** ${repoData.default_branch}\n` +
        `**License:** ${repoData.license?.name || 'None'}\n`
      await saveDoc(`https://github.com/${owner}/${singleRepo}`, content)
    }

    if (onProgress) await onProgress({ current: 1, total, url: `https://github.com/${owner}/${singleRepo}/README` })

    const readmeData = await githubApiFetch(`/repos/${owner}/${singleRepo}/readme`, token)
    if (readmeData?.content) {
      const readmeText = Buffer.from(readmeData.content, 'base64').toString('utf-8')
      const content = `# README: ${owner}/${singleRepo}\n\nSource: https://github.com/${owner}/${singleRepo}/blob/${readmeData.name}\n\n${readmeText}`
      await saveDoc(`https://github.com/${owner}/${singleRepo}/blob/${readmeData.name}`, content)
    }
  } else {
    // Org/user mode: profile + members + repos + READMEs
    const profileData = await githubApiFetch(`/orgs/${owner}`, token) ||
                        await githubApiFetch(`/users/${owner}`, token)

    const profileUrl = `https://github.com/${owner}`
    if (onProgress) await onProgress({ current: 0, total: 1, url: profileUrl })

    if (profileData) {
      const isOrg = profileData.type === 'Organization'
      const content = `# ${profileData.name || owner} (GitHub ${isOrg ? 'Organization' : 'User'})\n\n` +
        `Source: ${profileUrl}\n\n` +
        (profileData.description || profileData.bio ? `**About:** ${profileData.description || profileData.bio}\n` : '') +
        (profileData.location ? `**Location:** ${profileData.location}\n` : '') +
        (profileData.email ? `**Email:** ${profileData.email}\n` : '') +
        (profileData.blog ? `**Website:** ${profileData.blog}\n` : '') +
        (profileData.twitter_username ? `**Twitter:** @${profileData.twitter_username}\n` : '') +
        `**Public Repos:** ${profileData.public_repos}\n` +
        (isOrg ? `**Public Members:** ${profileData.public_members_url ? 'see below' : 'N/A'}\n` : '')
      await saveDoc(profileUrl, content)
    }

    // Members (orgs only)
    const membersData = await fetchAllPages(`/orgs/${owner}/members`, token)
    if (membersData.length > 0) {
      const memberLines = membersData.map((m: any) => `- [@${m.login}](https://github.com/${m.login})`)
      const content = `# Members: ${owner}\n\nSource: https://github.com/orgs/${owner}/people\n\n${memberLines.join('\n')}\n`
      await saveDoc(`https://github.com/orgs/${owner}/people`, content)
    }

    // All repos
    const endpoint = profileData?.type === 'Organization'
      ? `/orgs/${owner}/repos`
      : `/users/${owner}/repos`
    const repos = await fetchAllPages(endpoint, token)

    const total = 1 + repos.length * 2 // profile + (repo info + readme) per repo
    let current = processedPages

    for (const repoData of repos) {
      const repoUrl = `https://github.com/${owner}/${repoData.name}`
      if (onProgress) await onProgress({ current: current++, total, url: repoUrl })

      const topics = repoData.topics?.join(', ') || ''
      const repoContent = `# ${repoData.full_name}\n\nSource: ${repoUrl}\n\n` +
        `**Description:** ${repoData.description || 'No description'}\n` +
        `**Language:** ${repoData.language || 'N/A'}\n` +
        `**Stars:** ${repoData.stargazers_count} | **Forks:** ${repoData.forks_count}\n` +
        `**Topics:** ${topics || 'None'}\n` +
        (repoData.homepage ? `**Homepage:** ${repoData.homepage}\n` : '') +
        `**Default Branch:** ${repoData.default_branch}\n` +
        `**License:** ${repoData.license?.name || 'None'}\n`
      await saveDoc(repoUrl, repoContent)

      const readmeUrl = `${repoUrl}/blob/readme`
      if (onProgress) await onProgress({ current: current++, total, url: readmeUrl })

      const readmeData = await githubApiFetch(`/repos/${owner}/${repoData.name}/readme`, token)
      if (readmeData?.content) {
        const readmeText = Buffer.from(readmeData.content, 'base64').toString('utf-8')
        const content = `# README: ${owner}/${repoData.name}\n\nSource: ${repoUrl}/blob/${readmeData.name}\n\n${readmeText}`
        await saveDoc(`${repoUrl}/blob/${readmeData.name}`, content)
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  // Remove stale pages
  let stalePagesRemoved = 0
  const allVisitedUrls = new Set(existingDocsByUrl.keys())
  for (const [url, docInfo] of existingDocsByUrl.entries()) {
    if (!allVisitedUrls.has(url)) {
      try { await fs.unlink(docInfo.filepath); stalePagesRemoved++ } catch { /* ignore */ }
    }
  }

  const summary: ScrapeSummary = { processedPages, newPages, updatedPages, unchangedPages, discoveredUrls: processedPages, stalePagesRemoved }
  await updateScrapeConfigStats(summary)
  return summary
}

// ============================================================================
// Generic web scraper
// ============================================================================

export async function runScrape(
  config: ScrapeConfig,
  onProgress?: (progress: ScrapeProgress) => Promise<void> | void
): Promise<ScrapeSummary> {
  if (isGitHubUrl(config.websiteUrl)) {
    return runGitHubScrape(config, onProgress)
  }
  const normalizedConfig: ScrapeConfig = {
    ...config,
    websiteUrl: normalizeWebsiteUrl(config.websiteUrl)
  }

  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizedConfig.websiteUrl, depth: 0 }]

  let processedPages = 0
  let newPages = 0
  let updatedPages = 0
  let unchangedPages = 0
  let stalePagesRemoved = 0

  await fs.mkdir(DOCUMENTS_DIR, { recursive: true })
  const existingDocsByUrl = await loadExistingScrapedDocuments()

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!

    if (visited.has(url) || depth > normalizedConfig.maxDepth) {
      continue
    }

    visited.add(url)

    if (onProgress) {
      await onProgress({
        current: processedPages,
        total: visited.size + queue.length,
        url
      })
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AI-Knowledge-Base-Scraper/1.0'
        }
      })

      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        continue
      }

      const html = await response.text()

      if (depth < normalizedConfig.maxDepth) {
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
            isSameOriginOrSubdomain(normalizedConfig.websiteUrl, normalizedUrl, normalizedConfig.includeSameOriginSubdomains)
          ) {
            queue.push({ url: normalizedUrl, depth: depth + 1 })
          }
        }
      }

      const content = extractTextContent(html, url)
      const contentHash = hashContent(content)
      const existing = existingDocsByUrl.get(url)

      if (existing && existing.hash === contentHash) {
        unchangedPages++
      } else {
        const filename = existing
          ? path.basename(existing.filepath)
          : sanitizeFilename(url)
        const filepath = existing?.filepath || path.join(DOCUMENTS_DIR, filename)

        await fs.writeFile(filepath, content)

        if (existing) {
          updatedPages++
        } else {
          newPages++
        }

        existingDocsByUrl.set(url, { filepath, hash: contentHash })
      }

      processedPages++

      await new Promise(resolve => setTimeout(resolve, 500))
    } catch {
      continue
    }
  }

  // Remove stale pages that were scraped before but no longer exist on the site
  for (const [scrapedUrl, docInfo] of existingDocsByUrl.entries()) {
    if (!visited.has(scrapedUrl)) {
      try {
        await fs.unlink(docInfo.filepath)
        stalePagesRemoved++
        existingDocsByUrl.delete(scrapedUrl)
      } catch {
        // ignore deletion errors
      }
    }
  }

  const summary: ScrapeSummary = {
    processedPages,
    newPages,
    updatedPages,
    unchangedPages,
    discoveredUrls: visited.size,
    stalePagesRemoved
  }

  await updateScrapeConfigStats(summary)
  return summary
}
