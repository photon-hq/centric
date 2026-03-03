'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
  lastScraped?: string
  totalPages?: number
  status?: 'idle' | 'scraping' | 'complete' | 'error'
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ScrapeConfig>({
    websiteUrl: '',
    includeSameOriginSubdomains: true,
    maxDepth: 3
  })
  const [isLoading, setIsLoading] = useState(false)
  const [scrapeProgress, setScrapeProgress] = useState<{
    current: number
    total: number
    currentUrl: string
  } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setConfig(data.config)
        }
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const handleScrape = async () => {
    if (!config.websiteUrl) {
      setMessage({ type: 'error', text: 'Please enter a website URL' })
      return
    }

    setIsLoading(true)
    setMessage(null)
    setScrapeProgress({ current: 0, total: 0, currentUrl: config.websiteUrl })

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'progress') {
                  setScrapeProgress({
                    current: data.current,
                    total: data.total,
                    currentUrl: data.url
                  })
                } else if (data.type === 'complete') {
                  setMessage({
                    type: 'success',
                    text: `Successfully scraped ${data.totalPages} pages! Documents saved to documents/ folder.`
                  })
                  setScrapeProgress(null)
                  await loadConfig() // Reload config to show updated stats
                } else if (data.type === 'error') {
                  setMessage({ type: 'error', text: data.message })
                  setScrapeProgress(null)
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
      setScrapeProgress(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully' })
      } else {
        setMessage({ type: 'error', text: 'Failed to save configuration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleClearDocuments = async () => {
    if (!confirm('Are you sure you want to clear all scraped documents? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('/api/config/clear', {
        method: 'POST'
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'All scraped documents cleared' })
        await loadConfig()
      } else {
        setMessage({ type: 'error', text: 'Failed to clear documents' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-4">
            ← Back to Chat
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🔧 Knowledge Base Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Automatically scrape your website to build the AI knowledge base
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Configuration Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Website Configuration
            </h2>

            {/* Website URL Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Website URL
              </label>
              <input
                type="url"
                value={config.websiteUrl}
                onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Enter your website's main URL. The scraper will find and extract all text content.
              </p>
            </div>

            {/* Subdomain Toggle */}
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeSameOriginSubdomains}
                  onChange={(e) => setConfig({ ...config, includeSameOriginSubdomains: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Include Same-Origin Subdomains
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Also scrape subdomains like docs.example.com, platform.example.com, etc.
                  </p>
                </div>
              </label>
            </div>

            {/* Max Depth */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Crawl Depth
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.maxDepth}
                onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) || 3 })}
                className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                How many levels deep to follow links (recommended: 2-5)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleScrape}
                disabled={isLoading || !config.websiteUrl}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '🔄 Scraping...' : '🚀 Start Scraping'}
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isLoading}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                💾 Save Config
              </button>
            </div>
          </div>

          {/* Progress Card */}
          {scrapeProgress && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Scraping Progress
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Pages scraped:</span>
                  <span className="font-semibold">{scrapeProgress.current} / {scrapeProgress.total || '?'}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: scrapeProgress.total
                        ? `${(scrapeProgress.current / scrapeProgress.total) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  Current: {scrapeProgress.currentUrl}
                </div>
              </div>
            </div>
          )}

          {/* Message Display */}
          {message && (
            <div
              className={`rounded-lg p-4 ${
                message.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : message.type === 'error'
                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Stats Card */}
          {config.lastScraped && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Scraping Statistics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last Scraped</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {new Date(config.lastScraped).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Pages</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {config.totalPages || 0}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearDocuments}
                className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                🗑️ Clear All Scraped Documents
              </button>
            </div>
          )}

          {/* Instructions Card */}
          <div className="bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-blue-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              📚 How It Works
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Enter your website URL above</li>
              <li>Toggle subdomain scraping if you have docs on different subdomains</li>
              <li>Click "Start Scraping" to automatically extract content</li>
              <li>The scraper will save all text content to the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">documents/</code> folder</li>
              <li>Your AI agent will automatically use this content to answer questions</li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> The scraper respects robots.txt and rate limits. Large sites may take several minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
