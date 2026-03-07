'use client'

import { useState, useEffect, useRef } from 'react'
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
  CheckCircle,
  AlertTriangle,
  Info,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  Plug,
  Server,
  Download,
  MessageSquare,
  KeyRound,
  Hash,

} from 'lucide-react'

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
  status?: 'idle' | 'scraping' | 'complete' | 'error'
}

interface SOP {
  id: string
  title: string
  objective: string
  trigger: string
  steps: string[]
  enabled: boolean
  createdAt: string
}

interface MCPServer {
  id: string
  name: string
  url: string
  apiKey?: string
  type: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  enabled: boolean
  lastConnected?: string
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  lastUpdated: string | null
}

// Shared input style
const inp = "w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-lg text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
const inpSm = "px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-lg text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
const btnPrimary = "flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#ededed] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
const btnSecondary = "flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#222] text-[#888] text-sm font-medium rounded-lg hover:bg-[#1a1a1a] hover:text-white hover:border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
const btnGhost = "flex items-center gap-2 px-3 py-2 text-[#555] text-sm rounded-lg hover:bg-[#111] hover:text-white transition-colors"

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center text-[#888]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-[#555]">{desc}</div>
      </div>
    </div>
  )
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ScrapeConfig>({
    websiteUrl: '',
    includeSameOriginSubdomains: true,
    maxDepth: 3,
    autoUpdateEnabled: false,
    autoUpdateIntervalMinutes: 60
  })
  const [autoUpdateForm, setAutoUpdateForm] = useState({ enabled: false, intervalMinutes: 60 })
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingAutoUpdate, setIsSavingAutoUpdate] = useState(false)
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<{
    enabled: boolean
    intervalMinutes: number
    running: boolean
    lastRun: string | null
    lastResult: {
      processedPages: number
      newPages: number
      updatedPages: number
      unchangedPages: number
      discoveredUrls: number
      stalePagesRemoved: number
    } | null
  } | null>(null)
  const [scrapeProgress, setScrapeProgress] = useState<{ current: number; total: number; currentUrl: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [documents, setDocuments] = useState<Array<{ name: string; size: number; modified: string; type: 'scraped' | 'uploaded' | 'manual' }>>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<{ filename: string; content: string } | null>(null)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)
  const [isEditingDocument, setIsEditingDocument] = useState(false)
  const [editedDocumentContent, setEditedDocumentContent] = useState('')
  const [isSavingDocument, setIsSavingDocument] = useState(false)

  const [sops, setSOPs] = useState<SOP[]>([])
  const [isLoadingSOPs, setIsLoadingSOPs] = useState(false)
  const [expandedSOP, setExpandedSOP] = useState<string | null>(null)
  const [showNewSOPForm, setShowNewSOPForm] = useState(false)
  const [newSOP, setNewSOP] = useState({ title: '', objective: '', trigger: '', steps: [''] })
  const [editingSOPId, setEditingSOPId] = useState<string | null>(null)
  const [editingSOP, setEditingSOP] = useState({ title: '', objective: '', trigger: '', steps: [''] })

  const [mcpConfig, setMCPConfig] = useState<MCPConfig>({ enabled: false, servers: [], lastUpdated: null })
  const [isLoadingMCP, setIsLoadingMCP] = useState(false)
  const [showNewMCPForm, setShowNewMCPForm] = useState(false)
  const [newMCPServer, setNewMCPServer] = useState({ name: '', url: '', apiKey: '', type: 'sse' as 'stdio' | 'sse' | 'streamable-http', command: '', args: '' })

  const [slackStatus, setSlackStatus] = useState({
    slackEnabled: false, slackChannelId: '', slackPingType: 'none' as 'none' | 'here' | 'channel', botTokenSet: false, appTokenSet: false
  })
  const [slackForm, setSlackForm] = useState({ botToken: '', appToken: '', channelId: '' })
  const [isSavingSlack, setIsSavingSlack] = useState(false)
  const [isLoadingSlack, setIsLoadingSlack] = useState(false)
  const [mcpTestResults, setMCPTestResults] = useState<Record<string, { ok: boolean; toolCount?: number; error?: string } | null | undefined>>({})
  const [slackTestResult, setSlackTestResult] = useState<{ ok: boolean; team?: string; botName?: string; error?: string } | null>(null)

  const sopFileInputRef = useRef<HTMLInputElement>(null)
  const mcpFileInputRef = useRef<HTMLInputElement>(null)
  const lastObservedAutoRunRef = useRef<string | null>(null)

  useEffect(() => {
    loadConfig(); loadDocuments(); loadSOPs(); loadMCPConfig(); loadAutoUpdateStatus(); loadSlackConfig()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => { loadAutoUpdateStatus() }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const lastRun = autoUpdateStatus?.lastRun || null
    if (!lastRun) return
    if (lastObservedAutoRunRef.current !== lastRun) {
      lastObservedAutoRunRef.current = lastRun
      loadConfig(); loadDocuments()
    }
  }, [autoUpdateStatus?.lastRun])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config.websiteUrl || config.maxDepth > 0) {
        const { autoUpdateEnabled, autoUpdateIntervalMinutes, ...saveConfig } = config
        fetch('/api/config', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveConfig)
        }).catch(() => {})
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [config])

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setConfig(data.config)
          setAutoUpdateForm({ enabled: data.config.autoUpdateEnabled ?? false, intervalMinutes: data.config.autoUpdateIntervalMinutes ?? 60 })
        }
      }
    } catch {}
  }

  const loadDocuments = async () => {
    setIsLoadingDocs(true)
    try {
      const res = await fetch('/api/documents')
      if (res.ok) { const data = await res.json(); setDocuments(data.documents || []) }
    } catch {} finally { setIsLoadingDocs(false) }
  }

  const loadAutoUpdateStatus = async () => {
    try {
      const res = await fetch('/api/scrape/auto')
      if (res.ok) { const data = await res.json(); setAutoUpdateStatus(data) }
    } catch {}
  }

  const handleScrape = async () => {
    if (!config.websiteUrl) { setMessage({ type: 'error', text: 'Please enter a website URL' }); return }
    let normalizedUrl = config.websiteUrl.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
      setConfig({ ...config, websiteUrl: normalizedUrl })
    }
    setIsLoading(true); setMessage(null)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, includeSameOriginSubdomains: config.includeSameOriginSubdomains, maxDepth: config.maxDepth })
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'progress') setScrapeProgress({ current: data.current, total: data.total, currentUrl: data.url })
              else if (data.type === 'complete') { setMessage({ type: 'success', text: data.message }); setScrapeProgress(null); await loadDocuments(); await fetch('/api/reinitialize', { method: 'POST' }) }
              else if (data.type === 'error') { setMessage({ type: 'error', text: data.message }); setScrapeProgress(null) }
            } catch {}
          }
        }
      }
    } catch (e) {
      setMessage({ type: 'error', text: `Error: ${e instanceof Error ? e.message : String(e)}` })
      setScrapeProgress(null)
    } finally { setIsLoading(false) }
  }

  const handleSaveAutoUpdate = async () => {
    setIsSavingAutoUpdate(true)
    try {
      const res = await fetch('/api/scrape/auto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: autoUpdateForm.enabled, intervalMinutes: autoUpdateForm.intervalMinutes, websiteUrl: config.websiteUrl, includeSameOriginSubdomains: config.includeSameOriginSubdomains, maxDepth: config.maxDepth })
      })
      if (res.ok) { setMessage({ type: 'success', text: 'Auto-update settings saved' }); await loadAutoUpdateStatus() }
      else setMessage({ type: 'error', text: 'Failed to save auto-update settings' })
    } catch {} finally { setIsSavingAutoUpdate(false) }
  }

  const handleRunAutoUpdateNow = async () => {
    try {
      const res = await fetch('/api/scrape/auto', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run-now' }) })
      if (res.ok) { setMessage({ type: 'info', text: 'Auto-update started' }); await loadAutoUpdateStatus() }
    } catch {}
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { setUploadFiles(e.target.files) }

  const handleUpload = async () => {
    if (!uploadFiles) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      Array.from(uploadFiles).forEach(f => formData.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: data.message || 'Files uploaded' })
        setUploadFiles(null)
        await loadDocuments()
        await fetch('/api/reinitialize', { method: 'POST' })
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'Upload failed' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setIsUploading(false) }
  }

  const handleViewDocument = async (filename: string) => {
    setIsLoadingDocument(true); setIsEditingDocument(false)
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`)
      if (res.ok) {
        const data = await res.json()
        setViewingDocument({ filename, content: data.content })
        setEditedDocumentContent(data.content)
      }
    } catch {} finally { setIsLoadingDocument(false) }
  }

  const handleDeleteDocument = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      if (res.ok) { setMessage({ type: 'success', text: 'Document deleted' }); await loadDocuments(); await fetch('/api/reinitialize', { method: 'POST' }) }
    } catch {}
  }

  const handleClearDocuments = async () => {
    if (!confirm('Delete all documents?')) return
    try {
      const res = await fetch('/api/config/clear', { method: 'POST' })
      if (res.ok) { setMessage({ type: 'success', text: 'All documents cleared' }); await loadDocuments(); await fetch('/api/reinitialize', { method: 'POST' }) }
    } catch {}
  }

  const handleRefresh = async () => { await loadDocuments() }

  const handleSaveDocumentEdit = async () => {
    if (!viewingDocument) return
    setIsSavingDocument(true)
    try {
      const res = await fetch('/api/documents/update', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: viewingDocument.filename, content: editedDocumentContent })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Document saved' })
        setIsEditingDocument(false)
        setViewingDocument({ ...viewingDocument, content: editedDocumentContent })
        await loadDocuments()
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'Failed to save' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setIsSavingDocument(false) }
  }

  const loadSOPs = async () => {
    setIsLoadingSOPs(true)
    try {
      const res = await fetch('/api/sops')
      if (res.ok) { const data = await res.json(); setSOPs(data.sops || []) }
    } catch {} finally { setIsLoadingSOPs(false) }
  }

  const handleAddSOP = async () => {
    if (!newSOP.title || !newSOP.objective || !newSOP.trigger || newSOP.steps.filter(s => s.trim()).length === 0) {
      setMessage({ type: 'error', text: 'Fill in all SOP fields' }); return
    }
    try {
      const res = await fetch('/api/sops', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newSOP, steps: newSOP.steps.filter(s => s.trim()) })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'SOP added' })
        setNewSOP({ title: '', objective: '', trigger: '', steps: [''] })
        setShowNewSOPForm(false)
        await loadSOPs()
        await fetch('/api/reinitialize', { method: 'POST' })
      } else {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error || 'Failed' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const handleDeleteSOP = async (id: string) => {
    if (!confirm('Delete this SOP?')) return
    try {
      const res = await fetch('/api/sops', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (res.ok) { setMessage({ type: 'success', text: 'SOP deleted' }); await loadSOPs(); await fetch('/api/reinitialize', { method: 'POST' }) }
    } catch {}
  }

  const handleToggleSOP = async (id: string, enabled: boolean) => {
    try {
      await fetch('/api/sops', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) })
      await loadSOPs()
      await fetch('/api/reinitialize', { method: 'POST' })
    } catch {}
  }

  const handleStartEditSOP = (sop: SOP) => {
    setEditingSOPId(sop.id)
    setEditingSOP({ title: sop.title, objective: sop.objective, trigger: sop.trigger, steps: sop.steps.length > 0 ? sop.steps : [''] })
    setExpandedSOP(sop.id)
  }

  const handleCancelEditSOP = () => {
    setEditingSOPId(null)
    setEditingSOP({ title: '', objective: '', trigger: '', steps: [''] })
  }

  const handleSaveSOPEdit = async (id: string) => {
    const steps = editingSOP.steps.map(s => s.trim()).filter(Boolean)
    if (!editingSOP.title.trim() || !editingSOP.objective.trim() || !editingSOP.trigger.trim() || steps.length === 0) {
      setMessage({ type: 'error', text: 'Fill in all fields' }); return
    }
    try {
      const res = await fetch('/api/sops', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: editingSOP.title.trim(), objective: editingSOP.objective.trim(), trigger: editingSOP.trigger.trim(), steps })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'SOP updated' })
        handleCancelEditSOP()
        await loadSOPs()
        await fetch('/api/reinitialize', { method: 'POST' })
      }
    } catch {}
  }

  const handleExportSOPs = () => {
    const blob = new Blob([JSON.stringify(sops, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `sops-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const handleImportSOPs = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      let importedData = JSON.parse(text)
      const rawSOPs: any[] | null = Array.isArray(importedData) ? importedData : importedData?.title ? [importedData] : null
      if (!rawSOPs) { setMessage({ type: 'error', text: 'Invalid SOP file format' }); return }
      const isValid = rawSOPs.every((s: any) => s.title && s.objective && s.trigger && Array.isArray(s.steps))
      if (!isValid) { setMessage({ type: 'error', text: 'Invalid SOP structure' }); return }
      const importedSOPs = rawSOPs.map((sop: any) => ({ ...sop, steps: sop.steps.map((s: any) => typeof s === 'string' ? s : s.step ? s.step : String(s)) }))
      let successCount = 0, errorCount = 0, duplicateCount = 0
      for (const sop of importedSOPs) {
        const existing = sops.find(s => s.title === sop.title)
        let titleToUse = sop.title
        if (existing) {
          const identical = existing.objective === sop.objective && existing.trigger === sop.trigger && JSON.stringify(existing.steps) === JSON.stringify(sop.steps)
          if (identical) { duplicateCount++; continue }
          let n = 1; let t = `${sop.title}-duplicate-${n}`
          while (sops.find(s => s.title === t)) { n++; t = `${sop.title}-duplicate-${n}` }
          titleToUse = t
        }
        const res = await fetch('/api/sops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sop, title: titleToUse }) })
        if (res.ok) { successCount++; const d = await res.json(); setSOPs(prev => [...prev, d.sop]) } else errorCount++
      }
      await loadSOPs(); await fetch('/api/reinitialize', { method: 'POST' })
      let msg = `Imported ${successCount} SOPs`
      if (duplicateCount > 0) msg += `, skipped ${duplicateCount} identical`
      if (errorCount > 0) msg += `, ${errorCount} failed`
      setMessage({ type: errorCount > 0 ? 'info' : 'success', text: msg })
    } catch { setMessage({ type: 'error', text: 'Failed to parse file' }) }
    finally { if (sopFileInputRef.current) sopFileInputRef.current.value = '' }
  }

  const loadMCPConfig = async () => {
    setIsLoadingMCP(true)
    try {
      const res = await fetch('/api/mcp')
      if (res.ok) { const data = await res.json(); setMCPConfig(data.config || { enabled: false, servers: [], lastUpdated: null }) }
    } catch {} finally { setIsLoadingMCP(false) }
  }

  const handleToggleMCP = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/mcp', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
      if (res.ok) { setMCPConfig(prev => ({ ...prev, enabled })); setMessage({ type: 'success', text: `MCP ${enabled ? 'enabled' : 'disabled'}` }) }
    } catch {}
  }

  const handleAddMCPServer = async () => {
    if (!newMCPServer.name) { setMessage({ type: 'error', text: 'Server name required' }); return }
    if (newMCPServer.type === 'stdio' && !newMCPServer.command) { setMessage({ type: 'error', text: 'Command required for stdio' }); return }
    if ((newMCPServer.type === 'sse' || newMCPServer.type === 'streamable-http') && !newMCPServer.url) { setMessage({ type: 'error', text: 'URL required' }); return }
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMCPServer, args: newMCPServer.args ? newMCPServer.args.split(' ').filter(Boolean) : [] })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Server added' })
        setNewMCPServer({ name: '', url: '', apiKey: '', type: 'sse', command: '', args: '' })
        setShowNewMCPForm(false)
        await loadMCPConfig()
      } else { const err = await res.json(); setMessage({ type: 'error', text: err.error || 'Failed' }) }
    } catch (e) { setMessage({ type: 'error', text: `Error: ${e instanceof Error ? e.message : String(e)}` }) }
  }

  const handleToggleMCPServer = async (id: string, enabled: boolean) => {
    try {
      await fetch('/api/mcp', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serverId: id, enabled }) })
      await loadMCPConfig()
    } catch {}
  }

  const handleDeleteMCPServer = async (id: string) => {
    try {
      const res = await fetch('/api/mcp', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (res.ok) { setMessage({ type: 'success', text: 'Server removed' }); await loadMCPConfig() }
    } catch {}
  }

  const handleTestMCPServer = async (id: string, url: string) => {
    setMCPTestResults(prev => ({ ...prev, [id]: null }))
    try {
      const res = await fetch('/api/mcp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serverId: id, url }) })
      const data = await res.json()
      setMCPTestResults(prev => ({ ...prev, [id]: data }))
    } catch { setMCPTestResults(prev => ({ ...prev, [id]: { ok: false, error: 'Connection failed' } })) }
  }

  const handleExportMCP = () => {
    const blob = new Blob([JSON.stringify({ enabled: mcpConfig.enabled, servers: mcpConfig.servers, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `mcp-config-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    setMessage({ type: 'success', text: `Exported ${mcpConfig.servers.length} servers` })
  }

  const handleImportMCP = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      let importedData = JSON.parse(text)
      let importedServers: any[] = Array.isArray(importedData) ? importedData : importedData?.servers ? importedData.servers : importedData?.name && importedData?.type ? [importedData] : null
      if (!importedServers) { setMessage({ type: 'error', text: 'Invalid MCP file format' }); return }
      const isValid = importedServers.every((s: any) => s.name && s.type && (s.type === 'stdio' ? s.command : true))
      if (!isValid) { setMessage({ type: 'error', text: 'Invalid server structure' }); return }
      let successCount = 0, errorCount = 0, duplicateCount = 0
      for (const server of importedServers) {
        const existing = mcpConfig.servers.find(s => s.name === server.name)
        let nameToUse = server.name
        if (existing) {
          const s1 = { type: existing.type, url: existing.url || '', command: existing.command || '', args: JSON.stringify(existing.args || []) }
          const s2 = { type: server.type, url: server.url || '', command: server.command || '', args: JSON.stringify(server.args || []) }
          if (JSON.stringify(s1) === JSON.stringify(s2)) { duplicateCount++; continue }
          let n = 1; let t = `${server.name}-duplicate-${n}`
          while (mcpConfig.servers.find(s => s.name === t)) { n++; t = `${server.name}-duplicate-${n}` }
          nameToUse = t
        }
        const res = await fetch('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameToUse, url: server.url || '', apiKey: server.apiKey || '', type: server.type, command: server.command || '', args: server.args || [] }) })
        if (res.ok) { successCount++; const d = await res.json(); setMCPConfig(prev => ({ ...prev, servers: [...prev.servers, d.server] })) } else errorCount++
      }
      await loadMCPConfig()
      let msg = `Imported ${successCount} servers`
      if (duplicateCount > 0) msg += `, skipped ${duplicateCount} identical`
      if (errorCount > 0) msg += `, ${errorCount} failed`
      setMessage({ type: errorCount > 0 ? 'info' : 'success', text: msg })
    } catch { setMessage({ type: 'error', text: 'Failed to parse file' }) }
    finally { if (mcpFileInputRef.current) mcpFileInputRef.current.value = '' }
  }

  const loadSlackConfig = async () => {
    setIsLoadingSlack(true)
    try {
      const res = await fetch('/api/slack')
      if (res.ok) {
        const data = await res.json()
        setSlackStatus(data)
        setSlackForm(f => ({ ...f, channelId: data.slackChannelId }))
      }
    } catch {} finally { setIsLoadingSlack(false) }
  }

  const handleSaveSlack = async () => {
    setIsSavingSlack(true)
    try {
      const res = await fetch('/api/slack', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackEnabled: slackStatus.slackEnabled, slackChannelId: slackForm.channelId, slackPingType: slackStatus.slackPingType, botToken: slackForm.botToken || undefined, appToken: slackForm.appToken || undefined })
      })
      if (res.ok) { setMessage({ type: 'success', text: 'Slack configuration saved' }); setSlackForm(f => ({ ...f, botToken: '', appToken: '' })); await loadSlackConfig() }
      else setMessage({ type: 'error', text: 'Failed to save Slack config' })
    } catch { setMessage({ type: 'error', text: 'Failed to save Slack config' }) }
    finally { setIsSavingSlack(false) }
  }

  const handleTestSlack = async () => {
    try {
      const res = await fetch('/api/slack', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
      const data = await res.json()
      setSlackTestResult(data)
    } catch { setSlackTestResult({ ok: false, error: 'Connection failed' }) }
  }

  // Toggle switch component
  const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${checked ? 'bg-white' : 'bg-[#333]'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-black shadow transition duration-200 ease-in-out mt-0.5 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <nav className="border-b border-[#1a1a1a] px-6 h-14 flex items-center gap-3">
        <img src="/logo.jpg" className="w-6 h-6 rounded object-cover" alt="Photon" />
        <Link href="/" className="text-sm text-[#888] hover:text-white transition-colors flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <span className="text-[#333]">/</span>
        <span className="text-sm text-white">Knowledge Base</span>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Knowledge Base</h1>
          <p className="text-sm text-[#555]">Train your agent by connecting your website or uploading documents.</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 rounded-lg border px-4 py-3 flex items-center gap-3 text-sm ${
            message.type === 'success' ? 'border-[#00c950]/20 bg-[#00c950]/5 text-[#00c950]' :
            message.type === 'error' ? 'border-[#ff4444]/20 bg-[#ff4444]/5 text-[#ff4444]' :
            'border-blue-500/20 bg-blue-500/5 text-blue-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> :
             message.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
             <Info className="w-4 h-4 flex-shrink-0" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-current opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column */}
          <div className="lg:col-span-7 space-y-6">

            {/* Website Scraper */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
                <SectionHeader icon={<Globe className="w-4 h-4" />} title="Website Scraper" desc="Auto-crawl your documentation site" />
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs text-[#555] mb-1.5 uppercase tracking-wider">Website URL</label>
                  <input
                    type="url" value={config.websiteUrl}
                    onChange={(e) => setConfig({ ...config, websiteUrl: e.target.value })}
                    onBlur={(e) => {
                      let url = e.target.value.trim()
                      if (url && !url.match(/^https?:\/\//i)) setConfig({ ...config, websiteUrl: `https://${url}` })
                    }}
                    placeholder="example.com"
                    className={inp}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center justify-between text-xs text-[#555] mb-2 uppercase tracking-wider">
                      <span>Include Subdomains</span>
                      <Toggle checked={config.includeSameOriginSubdomains} onChange={(v) => setConfig({ ...config, includeSameOriginSubdomains: v })} disabled={isLoading} />
                    </label>
                    <p className="text-xs text-[#444]">Crawl blog., docs., etc.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-[#555] mb-2 uppercase tracking-wider">
                      Crawl Depth: <span className="text-white font-mono">{config.maxDepth}</span>
                    </label>
                    <input type="range" min="1" max="5" value={config.maxDepth}
                      onChange={(e) => setConfig({ ...config, maxDepth: parseInt(e.target.value) || 3 })}
                      className="w-full h-1 bg-[#222] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between text-[10px] text-[#444] mt-1 font-mono">
                      <span>1 fast</span><span>5 deep</span>
                    </div>
                  </div>
                </div>

                {/* Auto update */}
                <div className="rounded-lg border border-[#1a1a1a] bg-black p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">Auto Update</div>
                      <div className="text-[11px] text-[#555] mt-0.5">Crawl on a schedule</div>
                    </div>
                    <Toggle checked={autoUpdateForm.enabled} onChange={(v) => setAutoUpdateForm(f => ({ ...f, enabled: v }))} disabled={isLoading || isSavingAutoUpdate} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[#555] mb-1 uppercase tracking-wider">Interval (min)</label>
                      <input type="number" min={5} max={1440} value={autoUpdateForm.intervalMinutes}
                        onChange={(e) => setAutoUpdateForm(f => ({ ...f, intervalMinutes: Math.max(5, Number(e.target.value) || 60) }))}
                        className={`${inpSm} w-full`} disabled={isSavingAutoUpdate}
                      />
                    </div>
                    <button onClick={handleSaveAutoUpdate} disabled={isSavingAutoUpdate || !config.websiteUrl} className={btnSecondary}>
                      {isSavingAutoUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Apply
                    </button>
                    <button onClick={handleRunAutoUpdateNow} disabled={!config.websiteUrl || autoUpdateStatus?.running} className={btnSecondary}>
                      Run Now
                    </button>
                  </div>
                  {autoUpdateStatus && (
                    <p className="text-[10px] text-[#444] font-mono">
                      {autoUpdateStatus.running ? 'Running...' : autoUpdateStatus.enabled ? 'Enabled' : 'Disabled'}
                      {autoUpdateStatus.lastRun ? ` · Last: ${new Date(autoUpdateStatus.lastRun).toLocaleString()}` : ''}
                      {autoUpdateStatus.lastResult ? ` · New: ${autoUpdateStatus.lastResult.newPages}, Updated: ${autoUpdateStatus.lastResult.updatedPages}, Removed: ${autoUpdateStatus.lastResult.stalePagesRemoved}` : ''}
                    </p>
                  )}
                </div>

                {/* Scrape progress */}
                {scrapeProgress && (
                  <div className="rounded-lg border border-[#222] bg-black p-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-2xl font-mono font-bold text-white">{scrapeProgress.current}</span>
                      <span className="text-xs text-[#555] font-mono">/ {scrapeProgress.total || '?'}</span>
                      <span className="w-2 h-2 rounded-full bg-[#00c950] animate-pulse" />
                    </div>
                    <div className="w-full bg-[#111] rounded-full h-0.5 mb-2">
                      <div className="bg-white h-0.5 rounded-full transition-all" style={{ width: scrapeProgress.total ? `${(scrapeProgress.current / scrapeProgress.total) * 100}%` : '0%' }} />
                    </div>
                    <p className="text-[10px] font-mono text-[#444] truncate">{scrapeProgress.currentUrl}</p>
                  </div>
                )}

                <button onClick={handleScrape} disabled={isLoading || !config.websiteUrl} className={`w-full justify-center ${btnPrimary}`}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  {isLoading ? 'Scraping...' : 'Start Scraping'}
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1a1a1a]">
                <SectionHeader icon={<CloudUpload className="w-4 h-4" />} title="Document Upload" desc="Upload PDF, DOCX, CSV, or text files" />
              </div>
              <div className="p-6 space-y-4">
                <label htmlFor="file-upload" className="block cursor-pointer">
                  <div className={`border border-dashed rounded-lg p-8 text-center transition-colors ${uploadFiles?.length ? 'border-[#444] bg-[#111]' : 'border-[#222] hover:border-[#333] hover:bg-[#0f0f0f]'}`}>
                    {uploadFiles && uploadFiles.length > 0 ? (
                      <div className="space-y-2">
                        <Paperclip className="w-6 h-6 text-white mx-auto" />
                        <div className="text-sm font-medium text-white">{uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected</div>
                        <div className="text-xs text-[#555]">{Array.from(uploadFiles).map(f => f.name).join(', ')}</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <CloudUpload className="w-7 h-7 text-[#333] mx-auto" />
                        <div>
                          <p className="text-sm text-[#888]">Click to upload or drag & drop</p>
                          <p className="text-xs text-[#444] mt-1">PDF, DOCX, CSV, TXT, MD</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input id="file-upload" type="file" multiple onChange={handleFileSelect}
                    accept=".txt,.md,.markdown,.jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.json,.xml,.docx"
                    className="hidden" disabled={isUploading} />
                </label>
                <button onClick={handleUpload} disabled={isUploading || !uploadFiles} className={`w-full justify-center ${btnPrimary}`}>
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>
            </div>
          </div>

          {/* Right column - Documents */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden sticky top-6">
              <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
                <span className="text-xs font-medium text-white uppercase tracking-wider">Indexed Knowledge</span>
                <button onClick={handleRefresh} disabled={isLoadingDocs} className="text-[#555] hover:text-white transition-colors p-1 rounded">
                  {isLoadingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {isLoadingDocs ? (
                  <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#333] mx-auto mb-2" /><p className="text-xs text-[#444]">Loading...</p></div>
                ) : documents.length === 0 ? (
                  <div className="p-10 text-center"><FileText className="w-8 h-8 text-[#222] mx-auto mb-2" /><p className="text-xs text-[#444]">No documents indexed</p></div>
                ) : (
                  <div className="divide-y divide-[#111]">
                    {documents.map((doc) => (
                      <div key={doc.name} className="group flex items-center justify-between px-4 py-3 hover:bg-[#0f0f0f] transition-colors">
                        <button onClick={() => handleViewDocument(doc.name)} className="flex-1 min-w-0 text-left mr-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${doc.type === 'scraped' ? 'bg-blue-500/10 text-blue-400' : 'bg-[#1a1a1a] text-[#555]'}`}>
                              {doc.type === 'scraped' ? <Globe className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-white truncate font-mono">{doc.name.replace(/^uploaded_/, '').replace(/^scraped_/, '')}</p>
                              <p className="text-[10px] text-[#444] mt-0.5">{(doc.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                        </button>
                        <button onClick={() => handleDeleteDocument(doc.name)} className="w-6 h-6 flex items-center justify-center rounded text-[#333] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {documents.length > 0 && (
                <div className="px-4 py-3 border-t border-[#111]">
                  <button onClick={handleClearDocuments} className="w-full text-xs text-[#ff4444]/50 hover:text-[#ff4444] transition-colors py-1.5 rounded hover:bg-[#ff4444]/5">
                    Clear all documents
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SOPs */}
        <div className="mt-8 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
            <SectionHeader icon={<ClipboardList className="w-4 h-4" />} title="Standard Operating Procedures" desc="Define workflows and agent behavior" />
            <div className="flex items-center gap-2">
              <button onClick={handleExportSOPs} disabled={sops.length === 0} className={btnSecondary}>
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <button onClick={() => sopFileInputRef.current?.click()} className={btnSecondary}>
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
              <input ref={sopFileInputRef} type="file" accept=".json" onChange={handleImportSOPs} className="hidden" />
              <button onClick={() => setShowNewSOPForm(!showNewSOPForm)} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" /> Add SOP
              </button>
            </div>
          </div>

          {showNewSOPForm && (
            <div className="p-6 border-b border-[#1a1a1a] bg-black space-y-4">
              <input type="text" value={newSOP.title} onChange={(e) => setNewSOP({ ...newSOP, title: e.target.value })} placeholder="Title (e.g., Order Tracking SOP)" className={inp} />
              <input type="text" value={newSOP.objective} onChange={(e) => setNewSOP({ ...newSOP, objective: e.target.value })} placeholder="Objective ,  what is the goal?" className={inp} />
              <input type="text" value={newSOP.trigger} onChange={(e) => setNewSOP({ ...newSOP, trigger: e.target.value })} placeholder="Trigger ,  when should this activate?" className={inp} />
              <div>
                <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-2">Steps</label>
                {newSOP.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[#444] font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                    <input type="text" value={step}
                      onChange={(e) => { const steps = [...newSOP.steps]; steps[i] = e.target.value; setNewSOP({ ...newSOP, steps }) }}
                      placeholder={`Step ${i + 1}`} className={`${inpSm} flex-1`}
                    />
                    {newSOP.steps.length > 1 && (
                      <button onClick={() => setNewSOP({ ...newSOP, steps: newSOP.steps.filter((_, j) => j !== i) })} className="text-[#444] hover:text-[#ff4444] transition-colors flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setNewSOP({ ...newSOP, steps: [...newSOP.steps, ''] })} className="text-xs text-[#555] hover:text-white transition-colors flex items-center gap-1 mt-1">
                  <Plus className="w-3 h-3" /> Add step
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddSOP} className={btnPrimary}>Save SOP</button>
                <button onClick={() => { setShowNewSOPForm(false); setNewSOP({ title: '', objective: '', trigger: '', steps: [''] }) }} className={btnGhost}>Cancel</button>
              </div>
            </div>
          )}

          <div className="max-h-[500px] overflow-y-auto">
            {isLoadingSOPs ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#333] mx-auto mb-2" /><p className="text-xs text-[#444]">Loading SOPs...</p></div>
            ) : sops.length === 0 ? (
              <div className="p-10 text-center"><ClipboardList className="w-8 h-8 text-[#222] mx-auto mb-2" /><p className="text-xs text-[#444]">No SOPs configured</p></div>
            ) : (
              <div className="divide-y divide-[#111]">
                {sops.map((sop) => (
                  <div key={sop.id} className="group">
                    <div className="flex items-center justify-between px-6 py-3.5 hover:bg-[#0f0f0f] transition-colors cursor-pointer" onClick={() => setExpandedSOP(expandedSOP === sop.id ? null : sop.id)}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleSOP(sop.id, !sop.enabled) }}
                          className={`w-8 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${sop.enabled ? 'bg-white' : 'bg-[#333]'}`}>
                          <div className={`w-4 h-4 rounded-full bg-black transition-transform ${sop.enabled ? 'translate-x-3' : 'translate-x-0'}`} />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white truncate">{sop.title}</p>
                            {('isDefault' in sop) && (sop as any).isDefault && <span className="text-[10px] bg-[#1a1a1a] text-[#555] px-1.5 py-0.5 rounded font-mono">default</span>}
                          </div>
                          <p className="text-xs text-[#444] truncate mt-0.5">{sop.objective}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); handleStartEditSOP(sop) }} className="w-7 h-7 flex items-center justify-center rounded text-[#333] hover:text-[#888] opacity-0 group-hover:opacity-100 transition-all"><FileEdit className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSOP(sop.id) }} className="w-7 h-7 flex items-center justify-center rounded text-[#333] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        {expandedSOP === sop.id ? <ChevronUp className="w-3.5 h-3.5 text-[#333]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#333]" />}
                      </div>
                    </div>

                    {expandedSOP === sop.id && (
                      <div className="px-6 pb-5 bg-black">
                        <div className="pl-11 space-y-3">
                          {editingSOPId === sop.id ? (
                            <>
                              <div><label className="block text-[10px] text-[#444] uppercase tracking-wider mb-1">Title</label><input type="text" value={editingSOP.title} onChange={(e) => setEditingSOP({ ...editingSOP, title: e.target.value })} className={inp} /></div>
                              <div><label className="block text-[10px] text-[#444] uppercase tracking-wider mb-1">Objective</label><textarea value={editingSOP.objective} onChange={(e) => setEditingSOP({ ...editingSOP, objective: e.target.value })} rows={2} className={`${inp} resize-y`} /></div>
                              <div><label className="block text-[10px] text-[#444] uppercase tracking-wider mb-1">Trigger</label><textarea value={editingSOP.trigger} onChange={(e) => setEditingSOP({ ...editingSOP, trigger: e.target.value })} rows={2} className={`${inp} resize-y`} /></div>
                              <div>
                                <label className="block text-[10px] text-[#444] uppercase tracking-wider mb-2">Steps</label>
                                {editingSOP.steps.map((step, idx) => (
                                  <div key={idx} className="flex gap-2 mb-2">
                                    <span className="w-6 h-8 bg-[#111] border border-[#222] rounded flex items-center justify-center text-[10px] font-mono text-[#444] flex-shrink-0">{idx + 1}</span>
                                    <textarea value={step} onChange={(e) => { const steps = [...editingSOP.steps]; steps[idx] = e.target.value; setEditingSOP({ ...editingSOP, steps }) }} rows={2} className={`${inp} flex-1 resize-y`} />
                                    {editingSOP.steps.length > 1 && <button onClick={() => setEditingSOP({ ...editingSOP, steps: editingSOP.steps.filter((_, i) => i !== idx) })} className="w-8 h-8 flex items-center justify-center rounded text-[#444] hover:text-[#ff4444] transition-colors"><X className="w-3.5 h-3.5" /></button>}
                                  </div>
                                ))}
                                <button onClick={() => setEditingSOP({ ...editingSOP, steps: [...editingSOP.steps, ''] })} className="text-xs text-[#555] hover:text-white transition-colors flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Add step
                                </button>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => handleSaveSOPEdit(sop.id)} className={btnPrimary}>Save Changes</button>
                                <button onClick={handleCancelEditSOP} className={btnGhost}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div><p className="text-[10px] text-[#444] uppercase tracking-wider mb-1">Trigger</p><p className="text-sm text-[#888]">{sop.trigger}</p></div>
                              <div>
                                <p className="text-[10px] text-[#444] uppercase tracking-wider mb-2">Steps</p>
                                <ol className="space-y-2">
                                  {sop.steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-[#888]">
                                      <span className="w-5 h-5 bg-[#111] border border-[#222] rounded-full flex items-center justify-center text-[10px] font-mono text-[#444] flex-shrink-0 mt-0.5">{idx + 1}</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MCP Connector */}
        <div className="mt-8 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
            <SectionHeader icon={<Plug className="w-4 h-4" />} title="MCP Connector" desc="Connect external tools and services" />
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggleMCP(!mcpConfig.enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${mcpConfig.enabled ? 'bg-[#00c950]/10 border-[#00c950]/20 text-[#00c950]' : 'bg-[#111] border-[#222] text-[#555] hover:border-[#333]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mcpConfig.enabled ? 'bg-[#00c950] animate-pulse' : 'bg-[#333]'}`} />
                {mcpConfig.enabled ? 'Active' : 'Disabled'}
              </button>
              <button onClick={handleExportMCP} disabled={mcpConfig.servers.length === 0} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Export</button>
              <button onClick={() => mcpFileInputRef.current?.click()} className={btnSecondary}><Upload className="w-3.5 h-3.5" /> Import</button>
              <input ref={mcpFileInputRef} type="file" accept=".json" onChange={handleImportMCP} className="hidden" />
              <button onClick={() => setShowNewMCPForm(!showNewMCPForm)} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Server</button>
            </div>
          </div>

          {showNewMCPForm && (
            <div className="p-6 border-b border-[#1a1a1a] bg-black space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Server Name</label>
                  <input type="text" value={newMCPServer.name} onChange={(e) => setNewMCPServer({ ...newMCPServer, name: e.target.value })} placeholder="e.g., Zendesk, Stripe" className={inp} />
                </div>
                <div>
                  <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Transport</label>
                  <select value={newMCPServer.type} onChange={(e) => setNewMCPServer({ ...newMCPServer, type: e.target.value as any })} className={`${inp} bg-[#0a0a0a]`}>
                    <option value="sse">SSE</option>
                    <option value="streamable-http">Streamable HTTP</option>
                    <option value="stdio">Stdio</option>
                  </select>
                </div>
              </div>
              {newMCPServer.type === 'stdio' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Command</label><input type="text" value={newMCPServer.command} onChange={(e) => setNewMCPServer({ ...newMCPServer, command: e.target.value })} placeholder="npx, uvx" className={inp} /></div>
                  <div><label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Args (space-separated)</label><input type="text" value={newMCPServer.args} onChange={(e) => setNewMCPServer({ ...newMCPServer, args: e.target.value })} placeholder="-y @modelcontextprotocol/server-github" className={inp} /></div>
                </div>
              ) : (
                <div><label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Server URL</label><input type="url" value={newMCPServer.url} onChange={(e) => setNewMCPServer({ ...newMCPServer, url: e.target.value })} placeholder="https://api.example.com/mcp" className={inp} /></div>
              )}
              <div><label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">API Key (optional)</label><input type="password" value={newMCPServer.apiKey} onChange={(e) => setNewMCPServer({ ...newMCPServer, apiKey: e.target.value })} placeholder="Optional auth key" className={inp} /></div>
              <div className="flex gap-2">
                <button onClick={handleAddMCPServer} className={btnPrimary}>Add Server</button>
                <button onClick={() => { setShowNewMCPForm(false); setNewMCPServer({ name: '', url: '', apiKey: '', type: 'sse', command: '', args: '' }) }} className={btnGhost}>Cancel</button>
              </div>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto">
            {isLoadingMCP ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#333] mx-auto mb-2" /><p className="text-xs text-[#444]">Loading...</p></div>
            ) : mcpConfig.servers.length === 0 ? (
              <div className="p-10 text-center"><Server className="w-8 h-8 text-[#222] mx-auto mb-2" /><p className="text-xs text-[#444]">No MCP servers configured</p></div>
            ) : (
              <div className="divide-y divide-[#111]">
                {mcpConfig.servers.map((server) => (
                  <div key={server.id} className="group flex items-center justify-between px-6 py-3.5 hover:bg-[#0f0f0f] transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button type="button" onClick={() => handleToggleMCPServer(server.id, !server.enabled)} className={`w-8 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${server.enabled ? 'bg-white' : 'bg-[#333]'}`}>
                        <div className={`w-4 h-4 rounded-full bg-black transition-transform ${server.enabled ? 'translate-x-3' : 'translate-x-0'}`} />
                      </button>
                      <div className="w-7 h-7 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0">
                        <Server className="w-3.5 h-3.5 text-[#555]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{server.name}</p>
                        <p className="text-[10px] font-mono text-[#444] truncate mt-0.5">{server.type === 'stdio' ? `${server.command} ${server.args?.join(' ')}` : server.url}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${server.type === 'sse' ? 'border-blue-500/20 text-blue-400 bg-blue-500/5' : server.type === 'streamable-http' ? 'border-amber-500/20 text-amber-400 bg-amber-500/5' : 'border-[#222] text-[#555] bg-[#111]'}`}>
                        {server.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {server.type !== 'stdio' && server.url && (
                        <button onClick={() => handleTestMCPServer(server.id, server.url)} className="text-[10px] px-2 py-1 rounded text-[#444] hover:text-[#888] hover:bg-[#111] opacity-0 group-hover:opacity-100 transition-all">
                          {mcpTestResults[server.id] === null ? '...' : 'Test'}
                        </button>
                      )}
                      {mcpTestResults[server.id] != null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${mcpTestResults[server.id]?.ok ? 'bg-[#00c950]/10 text-[#00c950]' : 'bg-[#ff4444]/10 text-[#ff4444]'}`}>
                          {mcpTestResults[server.id]?.ok ? `${mcpTestResults[server.id]?.toolCount} tools` : mcpTestResults[server.id]?.error?.slice(0, 25)}
                        </span>
                      )}
                      <button onClick={() => handleDeleteMCPServer(server.id)} className="w-7 h-7 flex items-center justify-center rounded text-[#333] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {mcpConfig.lastUpdated && (
            <div className="px-6 py-2.5 border-t border-[#111]">
              <p className="text-[10px] font-mono text-[#333]">Updated {new Date(mcpConfig.lastUpdated).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Slack Integration */}
        <div className="mt-8 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
            <SectionHeader icon={<MessageSquare className="w-4 h-4" />} title="Slack Integration" desc="Route human handoffs to a Slack channel" />
            <button onClick={() => setSlackStatus(s => ({ ...s, slackEnabled: !s.slackEnabled }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${slackStatus.slackEnabled ? 'bg-[#00c950]/10 border-[#00c950]/20 text-[#00c950]' : 'bg-[#111] border-[#222] text-[#555] hover:border-[#333]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${slackStatus.slackEnabled ? 'bg-[#00c950] animate-pulse' : 'bg-[#333]'}`} />
              {slackStatus.slackEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="p-6">
            {isLoadingSlack ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#333] mx-auto" /></div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Bot Token <span className="normal-case text-[#333]">xoxb-...</span></label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444]" />
                      <input type="password" value={slackForm.botToken} onChange={(e) => setSlackForm(f => ({ ...f, botToken: e.target.value }))}
                        placeholder={slackStatus.botTokenSet ? '••••••••••••••••' : 'xoxb-...'} className={`${inp} pl-9`} />
                    </div>
                    {slackStatus.botTokenSet && <p className="mt-1 text-[10px] text-[#00c950] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Token set</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">App Token <span className="normal-case text-[#333]">xapp-...</span></label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444]" />
                      <input type="password" value={slackForm.appToken} onChange={(e) => setSlackForm(f => ({ ...f, appToken: e.target.value }))}
                        placeholder={slackStatus.appTokenSet ? '••••••••••••••••' : 'xapp-...'} className={`${inp} pl-9`} />
                    </div>
                    {slackStatus.appTokenSet && <p className="mt-1 text-[10px] text-[#00c950] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Token set</p>}
                    <p className="mt-1 text-[10px] text-[#333]">Needs <code className="bg-[#111] px-1 rounded font-mono">connections:write</code> scope</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Channel ID</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444]" />
                    <input type="text" value={slackForm.channelId} onChange={(e) => setSlackForm(f => ({ ...f, channelId: e.target.value }))}
                      placeholder="C0123456789" className={`${inp} pl-9 font-mono`} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-[#555] uppercase tracking-wider mb-2">Handoff Ping</label>
                  <div className="flex gap-2">
                    {(['none', 'here', 'channel'] as const).map((opt) => (
                      <button key={opt} onClick={() => setSlackStatus(s => ({ ...s, slackPingType: opt }))}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${slackStatus.slackPingType === opt ? 'bg-white text-black border-white' : 'bg-[#111] text-[#555] border-[#222] hover:border-[#333] hover:text-[#888]'}`}>
                        {opt === 'none' ? 'No ping' : opt === 'here' ? '@here' : '@everyone'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#1a1a1a] bg-black p-3">
                  <p className="text-[10px] text-[#555] uppercase tracking-wider mb-2">Required bot scopes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['chat:write', 'channels:history', 'groups:history'].map(scope => (
                      <code key={scope} className="bg-[#111] border border-[#222] px-2 py-0.5 rounded text-[10px] font-mono text-[#888]">{scope}</code>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button onClick={handleTestSlack} className={btnSecondary}>Test Connection</button>
                    {slackTestResult && (
                      <span className={`text-[10px] font-mono px-2 py-1 rounded ${slackTestResult.ok ? 'bg-[#00c950]/10 text-[#00c950]' : 'bg-[#ff4444]/10 text-[#ff4444]'}`}>
                        {slackTestResult.ok ? `${slackTestResult.team} / @${slackTestResult.botName}` : slackTestResult.error}
                      </span>
                    )}
                  </div>
                  <button onClick={handleSaveSlack} disabled={isSavingSlack} className={btnPrimary}>
                    {isSavingSlack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSavingSlack ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[#111] flex items-center justify-between">
          <p className="text-xs text-[#333]">
            Built by{' '}
            <a href="https://anmolsingh.dev" target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-white transition-colors">Anmol</a>
            {' '}x{' '}
            <a href="https://photon.codes" target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-white transition-colors">Photon</a>
          </p>
          <a href="https://github.com/photon-hq/centric" target="_blank" rel="noopener noreferrer" className="text-xs text-[#333] hover:text-white transition-colors">GitHub</a>
        </footer>
      </div>

      {/* Document Viewer Modal */}
      {(viewingDocument || isLoadingDocument) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingDocument(null)}>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#555]" />
                <h2 className="text-sm font-medium text-white font-mono">
                  {viewingDocument?.filename.replace(/^uploaded_/, '').replace(/^scraped_/, '') || 'Loading...'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingDocument && viewingDocument && (
                  <button onClick={() => setIsEditingDocument(true)} className={btnSecondary}>
                    <FileEdit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                <button onClick={() => { setViewingDocument(null); setIsEditingDocument(false) }} className="w-7 h-7 flex items-center justify-center rounded text-[#555] hover:text-white hover:bg-[#111] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingDocument ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-[#333]" /></div>
              ) : isEditingDocument && viewingDocument ? (
                <textarea value={editedDocumentContent} onChange={(e) => setEditedDocumentContent(e.target.value)}
                  className="w-full h-full min-h-[400px] p-4 font-mono text-xs bg-black border border-[#222] rounded-lg text-[#ededed] focus:outline-none focus:border-[#444] resize-none" />
              ) : viewingDocument ? (
                <pre className="whitespace-pre-wrap font-mono text-xs bg-black p-4 rounded-lg border border-[#1a1a1a] leading-relaxed text-[#888]">
                  {viewingDocument.content}
                </pre>
              ) : null}
            </div>
            <div className="px-5 py-3.5 border-t border-[#1a1a1a] flex justify-end gap-2">
              {isEditingDocument ? (
                <>
                  <button onClick={() => { setIsEditingDocument(false); setEditedDocumentContent(viewingDocument?.content || '') }} className={btnGhost}>Cancel</button>
                  <button onClick={handleSaveDocumentEdit} disabled={isSavingDocument} className={btnPrimary}>
                    {isSavingDocument ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSavingDocument ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button onClick={() => setViewingDocument(null)} className={btnSecondary}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
