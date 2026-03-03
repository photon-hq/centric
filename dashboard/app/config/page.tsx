'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Globe, 
  FileText, 
  CloudUpload, 
  Paperclip, 
  Trash2, 
  RefreshCw, 
  Save, 
  Upload, 
  FileEdit, 
  X, 
  ArrowLeft, 
  Loader2, 
  FileUp,
  CheckCircle,
  AlertTriangle,
  Info,
  Layout
} from 'lucide-react'

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
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [documents, setDocuments] = useState<Array<{
    name: string
    size: number
    modified: string
    type: 'scraped' | 'uploaded' | 'manual'
  }>>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  useEffect(() => {
    loadConfig()
    loadDocuments()
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

  const loadDocuments = async () => {
    setIsLoadingDocs(true)
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setIsLoadingDocs(false)
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFiles(e.target.files)
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) {
      setMessage({ type: 'error', text: 'Please select files to upload' })
      return
    }

    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      Array.from(uploadFiles).forEach(file => {
        formData.append('file', file)
      })

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: result.message
        })
        setUploadFiles(null)
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        // Reload documents list
        await loadDocuments()
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to upload files' })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: `${filename} deleted successfully` })
        await loadDocuments()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to delete document' })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  const handleRefresh = async () => {
    try {
      await Promise.all([loadConfig(), loadDocuments()])
    } catch (error) {
      console.error('Error refreshing:', error)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-black font-sans selection:bg-black selection:text-white">
      <div className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <div>
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-black transition-colors flex items-center gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-black">
              Knowledge Base
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl leading-relaxed">
              Manage your AI agent's intelligence. Connect your website or upload documents to train the assistant.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
               <div className="text-sm font-medium text-gray-900">Training Status</div>
               <div className="flex items-center gap-2 mt-1">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div>
                 <span className="text-xs text-gray-500">Active & Ready</span>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column - Configuration */}
          <div className="lg:col-span-7 space-y-8">
            {/* Website Scraper Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-8">
                <div>
                   <h2 className="text-xl font-semibold mb-1">Website Scraper</h2>
                   <p className="text-sm text-gray-500">Auto-crawl your documentation site</p>
                </div>
              </div>

              {/* Website URL Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Website URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={config.websiteUrl}
                    onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })}
                    placeholder="https://docs.example.com"
                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Subdomain Toggle */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={config.includeSameOriginSubdomains}
                        onChange={(e) => setConfig({ ...config, includeSameOriginSubdomains: e.target.checked })}
                        className="sr-only peer"
                        disabled={isLoading}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-900 group-hover:text-black">Include Subdomains</span>
                      <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">Scrape related sites like blog. or docs.</span>
                    </div>
                  </label>
                </div>

                {/* Max Depth */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Crawl Depth: <span className="text-black">{config.maxDepth}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={config.maxDepth}
                    onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) || 3 })}
                    className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    disabled={isLoading}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 (Fast)</span>
                    <span>5 (Deep)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 border-t border-gray-50 pt-6">
                <button
                  onClick={handleScrape}
                  disabled={isLoading || !config.websiteUrl}
                  className="flex-1 bg-black text-white font-medium py-3 px-6 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isLoading ? 'Processing...' : 'Start Scraping'}
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isLoading}
                  className="px-6 py-3 bg-white border border-gray-200 text-black font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Config
                </button>
              </div>
            </div>

            {/* File Upload Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="flex items-start justify-between mb-8">
                <div>
                   <h2 className="text-xl font-semibold mb-1">Document Upload</h2>
                   <p className="text-sm text-gray-500">Upload PDF, DOCX, CSV, or Text files</p>
                </div>
              </div>
              
              <div className="mb-6">
                <label 
                  htmlFor="file-upload"
                  className="block w-full cursor-pointer group"
                >
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center group-hover:border-black group-hover:bg-gray-50 transition-all duration-300">
                    {uploadFiles && uploadFiles.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex justify-center mb-2">
                          <Paperclip className="w-8 h-8 text-black" />
                        </div>
                        <div className="font-medium text-lg">
                          {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected
                        </div>
                        <div className="text-sm text-gray-500 max-w-xs mx-auto">
                          {Array.from(uploadFiles).map(f => f.name).join(', ')}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-2xl group-hover:scale-110 transition-transform">
                          <CloudUpload className="w-8 h-8 text-gray-400 group-hover:text-black" />
                        </div>
                        <div>
                          <p className="font-medium text-lg text-gray-900">Click to upload documents</p>
                          <p className="text-sm text-gray-500 mt-1">or drag and drop files here</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                           {['PDF', 'DOCX', 'CSV', 'TXT', 'MD'].map(ext => (
                             <span key={ext} className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 border border-gray-200">{ext}</span>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    accept=".txt,.md,.markdown,.jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.json,.xml,.docx"
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={isUploading || !uploadFiles}
                className="w-full bg-black text-white font-medium py-3.5 px-6 rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? 'Uploading & Processing...' : 'Upload Files'}
              </button>
            </div>
            
            {/* Message Display */}
            {message && (
              <div
                className={`rounded-xl p-4 flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-900 border border-green-100'
                    : message.type === 'error'
                    ? 'bg-red-50 text-red-900 border border-red-100'
                    : 'bg-blue-50 text-blue-900 border border-blue-100'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : message.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : (
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            )}
          </div>

          {/* Right Column - Status & Documents */}
          <div className="lg:col-span-5 space-y-8">
            {/* Scraping Progress */}
            {scrapeProgress && (
              <div className="bg-black text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <h3 className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-wider">
                  Scraping Status
                </h3>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-4xl font-bold">{scrapeProgress.current}</span>
                      <span className="text-gray-500 text-lg"> / {scrapeProgress.total || '?'}</span>
                    </div>
                    <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-300"
                      style={{
                        width: scrapeProgress.total
                          ? `${(scrapeProgress.current / scrapeProgress.total) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 font-mono truncate">
                    {scrapeProgress.currentUrl}
                  </div>
                </div>
              </div>
            )}

            {/* Documents List */}
            <div className="bg-white border border-gray-200 rounded-2xl p-0 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-semibold text-gray-900">
                  Indexed Knowledge
                </h3>
                <button
                  onClick={handleRefresh}
                  disabled={isLoadingDocs}
                  className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                  title="Refresh List"
                >
                  {isLoadingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>

              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {isLoadingDocs ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400 text-sm">Loading indices...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="flex justify-center mb-3">
                      <FileText className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-gray-400 text-sm">No documents found.</p>
                    <p className="text-xs text-gray-300 mt-1">Start by scraping or uploading.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {documents.map((doc) => (
                      <div
                        key={doc.name}
                        className="group flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border
                              ${doc.type === 'scraped' 
                                ? 'bg-blue-50 border-blue-100 text-blue-600' 
                                : doc.name.endsWith('.pdf')
                                  ? 'bg-red-50 border-red-100 text-red-600'
                                  : doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                    ? 'bg-purple-50 border-purple-100 text-purple-600'
                                    : 'bg-gray-50 border-gray-100 text-gray-600'
                              }
                            `}>
                              {doc.type === 'scraped' ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate group-hover:text-black">
                                {doc.name.replace(/^uploaded_/, '').replace(/^scraped_/, '')}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {doc.name.split('.').pop()}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {(doc.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.name)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          title={`Delete ${doc.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {documents.length > 0 && (
                 <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={handleClearDocuments}
                    className="w-full py-2 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                  >
                    Clear All Documents
                  </button>
                 </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="mt-24 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-400">
            Built with ❤️ by{' '}
            <a 
              href="https://anmolsingh.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline"
            >
              Anmol
            </a>{' '}
            x{' '}
            <a 
              href="https://photon.codes" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline"
            >
              Photon
            </a>
          </p>
        </footer>
      </div>
    </main>
  )
}
