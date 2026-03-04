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
  FileUp,
  CheckCircle,
  AlertTriangle,
  Info,
  Layout,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  Plug,
  Server,
  ToggleLeft,
  ToggleRight,
  Download,
  FileDown
} from 'lucide-react'

interface ScrapeConfig {
  websiteUrl: string
  includeSameOriginSubdomains: boolean
  maxDepth: number
  lastScraped?: string
  totalPages?: number
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
  const [viewingDocument, setViewingDocument] = useState<{
    filename: string
    content: string
  } | null>(null)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)
  const [isEditingDocument, setIsEditingDocument] = useState(false)
  const [editedDocumentContent, setEditedDocumentContent] = useState('')
  const [isSavingDocument, setIsSavingDocument] = useState(false)
  
  // SOP State
  const [sops, setSOPs] = useState<SOP[]>([])
  const [isLoadingSOPs, setIsLoadingSOPs] = useState(false)
  const [expandedSOP, setExpandedSOP] = useState<string | null>(null)
  const [showNewSOPForm, setShowNewSOPForm] = useState(false)
  const [newSOP, setNewSOP] = useState({
    title: '',
    objective: '',
    trigger: '',
    steps: ['']
  })
  const [editingSOPId, setEditingSOPId] = useState<string | null>(null)
  const [editingSOP, setEditingSOP] = useState({
    title: '',
    objective: '',
    trigger: '',
    steps: ['']
  })
  
  // MCP State
  const [mcpConfig, setMCPConfig] = useState<MCPConfig>({
    enabled: false,
    servers: [],
    lastUpdated: null
  })
  const [isLoadingMCP, setIsLoadingMCP] = useState(false)
  const [showNewMCPForm, setShowNewMCPForm] = useState(false)
  const [newMCPServer, setNewMCPServer] = useState({
    name: '',
    url: '',
    apiKey: '',
    type: 'sse' as 'stdio' | 'sse' | 'streamable-http',
    command: '',
    args: ''
  })

  // File input refs for import
  const sopFileInputRef = useRef<HTMLInputElement>(null)
  const mcpFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConfig()
    loadDocuments()
    loadSOPs()
    loadMCPConfig()
  }, [])

  // Auto-save config with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (config.websiteUrl || config.maxDepth > 0) {
        // Auto-save config
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        }).catch(error => console.error('Auto-save failed:', error))
      }
    }, 1000) // Wait 1 second after last change before saving

    return () => clearTimeout(timer)
  }, [config])

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

    // Normalize URL - add https:// if no protocol specified
    let normalizedUrl = config.websiteUrl.trim()
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`
      setConfig({ ...config, websiteUrl: normalizedUrl })
    }

    setIsLoading(true)
    setMessage(null)
    setScrapeProgress({ current: 0, total: 0, currentUrl: normalizedUrl })

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, websiteUrl: normalizedUrl })
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
                  // Refresh knowledge base
                  await fetch('/api/reinitialize', { method: 'POST' })
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
        // Refresh knowledge base
        await fetch('/api/reinitialize', { method: 'POST' })
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
        // Refresh knowledge base
        await fetch('/api/reinitialize', { method: 'POST' })
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

  const handleViewDocument = async (filename: string) => {
    setIsLoadingDocument(true)
    setViewingDocument(null)
    setIsEditingDocument(false)
    
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(filename)}`)
      if (response.ok) {
        const data = await response.json()
        setViewingDocument(data)
        setEditedDocumentContent(data.content)
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to load document' })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      setIsLoadingDocument(false)
    }
  }

  const handleSaveDocumentEdit = async () => {
    if (!viewingDocument) return
    
    setIsSavingDocument(true)
    try {
      const response = await fetch('/api/documents/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: viewingDocument.filename,
          content: editedDocumentContent
        })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Document saved successfully' })
        setIsEditingDocument(false)
        setViewingDocument({
          ...viewingDocument,
          content: editedDocumentContent
        })
        await loadDocuments()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to save document' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setIsSavingDocument(false)
    }
  }

  // SOP Functions
  const loadSOPs = async () => {
    setIsLoadingSOPs(true)
    try {
      const response = await fetch('/api/sops')
      if (response.ok) {
        const data = await response.json()
        setSOPs(data.sops || [])
      }
    } catch (error) {
      console.error('Error loading SOPs:', error)
    } finally {
      setIsLoadingSOPs(false)
    }
  }

  const handleAddSOP = async () => {
    if (!newSOP.title || !newSOP.objective || !newSOP.trigger || newSOP.steps.filter(s => s.trim()).length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all SOP fields' })
      return
    }

    try {
      const response = await fetch('/api/sops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSOP,
          steps: newSOP.steps.filter(s => s.trim())
        })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'SOP added successfully' })
        setNewSOP({ title: '', objective: '', trigger: '', steps: [''] })
        setShowNewSOPForm(false)
        await loadSOPs()
        // Reinitialize knowledge base
        await fetch('/api/reinitialize', { method: 'POST' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to add SOP' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleDeleteSOP = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SOP?')) return

    try {
      const response = await fetch('/api/sops', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'SOP deleted successfully' })
        await loadSOPs()
        await fetch('/api/reinitialize', { method: 'POST' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to delete SOP' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleToggleSOP = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/sops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      })

      if (response.ok) {
        await loadSOPs()
        await fetch('/api/reinitialize', { method: 'POST' })
      }
    } catch (error) {
      console.error('Error toggling SOP:', error)
    }
  }

  const handleStartEditSOP = (sop: SOP) => {
    setEditingSOPId(sop.id)
    setEditingSOP({
      title: sop.title,
      objective: sop.objective,
      trigger: sop.trigger,
      steps: sop.steps.length > 0 ? sop.steps : ['']
    })
    setExpandedSOP(sop.id)
  }

  const handleCancelEditSOP = () => {
    setEditingSOPId(null)
    setEditingSOP({
      title: '',
      objective: '',
      trigger: '',
      steps: ['']
    })
  }

  const handleSaveSOPEdit = async (id: string) => {
    const steps = editingSOP.steps.map(step => step.trim()).filter(Boolean)

    if (!editingSOP.title.trim() || !editingSOP.objective.trim() || !editingSOP.trigger.trim() || steps.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all SOP fields before saving' })
      return
    }

    try {
      const response = await fetch('/api/sops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editingSOP.title.trim(),
          objective: editingSOP.objective.trim(),
          trigger: editingSOP.trigger.trim(),
          steps
        })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'SOP updated successfully' })
        handleCancelEditSOP()
        await loadSOPs()
        await fetch('/api/reinitialize', { method: 'POST' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to update SOP' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  // MCP Functions
  const loadMCPConfig = async () => {
    setIsLoadingMCP(true)
    try {
      const response = await fetch('/api/mcp')
      if (response.ok) {
        const data = await response.json()
        setMCPConfig(data.config || { enabled: false, servers: [], lastUpdated: null })
      }
    } catch (error) {
      console.error('Error loading MCP config:', error)
    } finally {
      setIsLoadingMCP(false)
    }
  }

  const handleToggleMCP = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/mcp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })

      if (response.ok) {
        setMCPConfig(prev => ({ ...prev, enabled }))
        setMessage({ type: 'success', text: `MCP ${enabled ? 'enabled' : 'disabled'}` })
      }
    } catch (error) {
      console.error('Error toggling MCP:', error)
    }
  }

  const handleAddMCPServer = async () => {
    if (!newMCPServer.name) {
      setMessage({ type: 'error', text: 'Server name is required' })
      return
    }

    if (newMCPServer.type === 'stdio' && !newMCPServer.command) {
      setMessage({ type: 'error', text: 'Command is required for stdio transport' })
      return
    }

    if ((newMCPServer.type === 'sse' || newMCPServer.type === 'streamable-http') && !newMCPServer.url) {
      setMessage({ type: 'error', text: 'URL is required for SSE/HTTP transport' })
      return
    }

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMCPServer,
          args: newMCPServer.args ? newMCPServer.args.split(' ').filter(a => a) : []
        })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'MCP server added successfully' })
        setNewMCPServer({ name: '', url: '', apiKey: '', type: 'sse', command: '', args: '' })
        setShowNewMCPForm(false)
        await loadMCPConfig()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to add MCP server' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleDeleteMCPServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove this MCP server?')) return

    try {
      const response = await fetch('/api/mcp', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'MCP server removed' })
        await loadMCPConfig()
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to remove MCP server' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleToggleMCPServer = async (serverId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/mcp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, enabled })
      })

      if (response.ok) {
        await loadMCPConfig()
      }
    } catch (error) {
      console.error('Error toggling MCP server:', error)
    }
  }

  // SOP Import/Export Functions
  const handleExportSOPs = () => {
    const dataStr = JSON.stringify(sops, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sops-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setMessage({ type: 'success', text: `Exported ${sops.length} SOPs` })
  }

  const handleImportSOPs = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      let importedData = JSON.parse(text)

      // Support both single SOP object and array of SOPs
      let importedSOPs: any[] = []
      if (Array.isArray(importedData)) {
        importedSOPs = importedData
      } else if (importedData && typeof importedData === 'object' && importedData.title) {
        // Single SOP object
        importedSOPs = [importedData]
      } else {
        setMessage({ type: 'error', text: 'Invalid SOP file format. Expected a single SOP object or array of SOPs.' })
        return
      }

      // Validate SOP structure
      const isValid = importedSOPs.every(sop => 
        sop.title && sop.objective && sop.trigger && Array.isArray(sop.steps)
      )

      if (!isValid) {
        setMessage({ type: 'error', text: 'Invalid SOP structure. Each SOP must have title, objective, trigger, and steps.' })
        return
      }

      // Normalize steps - handle both string arrays and object arrays with 'step' property
      importedSOPs = importedSOPs.map(sop => ({
        ...sop,
        steps: sop.steps.map((step: any) => {
          if (typeof step === 'string') {
            return step
          } else if (typeof step === 'object' && step.step) {
            return step.step
          } else {
            return String(step)
          }
        })
      }))

      // Helper to check if two SOPs are identical
      const areSopsIdentical = (sop1: any, sop2: any) => {
        return sop1.objective === sop2.objective &&
               sop1.trigger === sop2.trigger &&
               JSON.stringify(sop1.steps) === JSON.stringify(sop2.steps)
      }

      // Helper to find next available duplicate name
      const getUniqueSopTitle = (baseTitle: string, existingSOPs: SOP[]) => {
        const existingTitles = existingSOPs.map(s => s.title)
        if (!existingTitles.includes(baseTitle)) {
          return baseTitle
        }

        let duplicateNum = 1
        let newTitle = `${baseTitle}-duplicate-${duplicateNum}`
        while (existingTitles.includes(newTitle)) {
          duplicateNum++
          newTitle = `${baseTitle}-duplicate-${duplicateNum}`
        }
        return newTitle
      }

      // Import each SOP
      let successCount = 0
      let errorCount = 0
      let duplicateCount = 0

      for (const sop of importedSOPs) {
        try {
          // Check if SOP with same title exists
          const existingSOP = sops.find(s => s.title === sop.title)
          
          let titleToUse = sop.title

          if (existingSOP) {
            // Check if content is identical
            if (areSopsIdentical(sop, existingSOP)) {
              // Skip identical SOPs
              duplicateCount++
              continue
            } else {
              // Different content, create with duplicate suffix
              titleToUse = getUniqueSopTitle(sop.title, sops)
            }
          }

          const response = await fetch('/api/sops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: titleToUse,
              objective: sop.objective,
              trigger: sop.trigger,
              steps: sop.steps
            })
          })

          if (response.ok) {
            successCount++
            // Update local sops list for subsequent duplicate checks
            const newSop = await response.json()
            setSOPs(prev => [...prev, newSop.sop])
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
          console.error('Error importing SOP:', error)
        }
      }

      await loadSOPs()
      await fetch('/api/reinitialize', { method: 'POST' })
      
      let message = `Imported ${successCount} SOPs`
      if (duplicateCount > 0) {
        message += `, skipped ${duplicateCount} identical`
      }
      if (errorCount > 0) {
        message += `, ${errorCount} failed`
      }
      
      setMessage({ 
        type: errorCount > 0 ? 'info' : 'success', 
        text: message 
      })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to parse JSON file' })
      console.error('Import error:', error)
    } finally {
      // Reset file input
      if (sopFileInputRef.current) {
        sopFileInputRef.current.value = ''
      }
    }
  }

  // MCP Import/Export Functions
  const handleExportMCP = () => {
    const exportData = {
      enabled: mcpConfig.enabled,
      servers: mcpConfig.servers,
      exportedAt: new Date().toISOString()
    }
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mcp-config-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setMessage({ type: 'success', text: `Exported MCP config with ${mcpConfig.servers.length} servers` })
  }

  const handleImportMCP = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      let importedData = JSON.parse(text)

      // Support both single server object and config with servers array
      let importedServers: any[] = []
      
      if (Array.isArray(importedData)) {
        // Direct array of servers
        importedServers = importedData
      } else if (importedData.servers && Array.isArray(importedData.servers)) {
        // Config object with servers array
        importedServers = importedData.servers
      } else if (importedData && typeof importedData === 'object' && importedData.name && importedData.type) {
        // Single server object
        importedServers = [importedData]
      } else {
        setMessage({ type: 'error', text: 'Invalid MCP file format. Expected a server object, array of servers, or config with servers array.' })
        return
      }

      // Validate server structure
      const isValid = importedServers.every((server: any) => 
        server.name && server.type && 
        (server.type === 'stdio' ? server.command : true)
      )

      if (!isValid) {
        setMessage({ type: 'error', text: 'Invalid server structure. Each server must have name, type, and command (for stdio) or url (for SSE/HTTP).' })
        return
      }

      // Helper to check if two servers are identical
      const areServersIdentical = (server1: any, server2: any) => {
        const s1 = {
          type: server1.type,
          url: server1.url || '',
          apiKey: server1.apiKey || '',
          command: server1.command || '',
          args: JSON.stringify(server1.args || [])
        }
        const s2 = {
          type: server2.type,
          url: server2.url || '',
          apiKey: server2.apiKey || '',
          command: server2.command || '',
          args: JSON.stringify(server2.args || [])
        }
        return JSON.stringify(s1) === JSON.stringify(s2)
      }

      // Helper to find next available duplicate name
      const getUniqueServerName = (baseName: string, existingServers: MCPServer[]) => {
        const existingNames = existingServers.map(s => s.name)
        if (!existingNames.includes(baseName)) {
          return baseName
        }

        let duplicateNum = 1
        let newName = `${baseName}-duplicate-${duplicateNum}`
        while (existingNames.includes(newName)) {
          duplicateNum++
          newName = `${baseName}-duplicate-${duplicateNum}`
        }
        return newName
      }

      // Import each server
      let successCount = 0
      let errorCount = 0
      let duplicateCount = 0

      for (const server of importedServers) {
        try {
          // Check if server with same name exists
          const existingServer = mcpConfig.servers.find(s => s.name === server.name)
          
          let nameToUse = server.name

          if (existingServer) {
            // Check if content is identical
            if (areServersIdentical(server, existingServer)) {
              // Skip identical servers
              duplicateCount++
              continue
            } else {
              // Different content, create with duplicate suffix
              nameToUse = getUniqueServerName(server.name, mcpConfig.servers)
            }
          }

          const response = await fetch('/api/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: nameToUse,
              url: server.url || '',
              apiKey: server.apiKey || '',
              type: server.type,
              command: server.command || '',
              args: server.args || []
            })
          })

          if (response.ok) {
            successCount++
            // Update local config for subsequent duplicate checks
            const newServer = await response.json()
            setMCPConfig(prev => ({
              ...prev,
              servers: [...prev.servers, newServer.server]
            }))
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
          console.error('Error importing MCP server:', error)
        }
      }

      await loadMCPConfig()
      
      let message = `Imported ${successCount} MCP servers`
      if (duplicateCount > 0) {
        message += `, skipped ${duplicateCount} identical`
      }
      if (errorCount > 0) {
        message += `, ${errorCount} failed`
      }
      
      setMessage({ 
        type: errorCount > 0 ? 'info' : 'success', 
        text: message 
      })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to parse JSON file' })
      console.error('Import error:', error)
    } finally {
      // Reset file input
      if (mcpFileInputRef.current) {
        mcpFileInputRef.current.value = ''
      }
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
                    onBlur={(e) => {
                      // Normalize URL on blur - add https:// if no protocol
                      let url = e.target.value.trim()
                      if (url && !url.match(/^https?:\/\//i)) {
                        url = `https://${url}`
                        setConfig({ ...config, websiteUrl: url })
                      }
                    }}
                    placeholder="example.com or https://example.com"
                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    disabled={isLoading}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  💡 You can enter just the domain - we'll add https:// automatically
                </p>
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
                        <button
                          onClick={() => handleViewDocument(doc.name)}
                          className="flex-1 min-w-0 mr-4 text-left"
                        >
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
                        </button>
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

        {/* SOPs Section */}
        <div className="mt-12">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Standard Operating Procedures</h3>
                  <p className="text-xs text-gray-500">Define workflows and agent behavior</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSOPs}
                  disabled={sops.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export all SOPs as JSON"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => sopFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all"
                  title="Import SOPs from JSON"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <input
                  ref={sopFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportSOPs}
                  className="hidden"
                />
                <button
                  onClick={() => setShowNewSOPForm(!showNewSOPForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add SOP
                </button>
              </div>
            </div>

            {/* New SOP Form */}
            {showNewSOPForm && (
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Title</label>
                    <input
                      type="text"
                      value={newSOP.title}
                      onChange={(e) => setNewSOP({ ...newSOP, title: e.target.value })}
                      placeholder="e.g., Order Tracking SOP"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Objective</label>
                    <input
                      type="text"
                      value={newSOP.objective}
                      onChange={(e) => setNewSOP({ ...newSOP, objective: e.target.value })}
                      placeholder="What is the goal of this SOP?"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Trigger</label>
                    <input
                      type="text"
                      value={newSOP.trigger}
                      onChange={(e) => setNewSOP({ ...newSOP, trigger: e.target.value })}
                      placeholder="When should this SOP be activated?"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Steps</label>
                    {newSOP.steps.map((step, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-400 w-6">{index + 1}.</span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => {
                            const steps = [...newSOP.steps]
                            steps[index] = e.target.value
                            setNewSOP({ ...newSOP, steps })
                          }}
                          placeholder={`Step ${index + 1}`}
                          className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm"
                        />
                        {newSOP.steps.length > 1 && (
                          <button
                            onClick={() => {
                              const steps = newSOP.steps.filter((_, i) => i !== index)
                              setNewSOP({ ...newSOP, steps })
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setNewSOP({ ...newSOP, steps: [...newSOP.steps, ''] })}
                      className="text-sm text-gray-500 hover:text-black flex items-center gap-1 mt-2"
                    >
                      <Plus className="w-3 h-3" /> Add step
                    </button>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleAddSOP}
                      className="flex-1 bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-800 transition-all"
                    >
                      Save SOP
                    </button>
                    <button
                      onClick={() => {
                        setShowNewSOPForm(false)
                        setNewSOP({ title: '', objective: '', trigger: '', steps: [''] })
                      }}
                      className="px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SOPs List */}
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              {isLoadingSOPs ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-400 text-sm">Loading SOPs...</p>
                </div>
              ) : sops.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex justify-center mb-3">
                    <ClipboardList className="w-10 h-10 text-gray-200" />
                  </div>
                  <p className="text-gray-400 text-sm">No SOPs configured.</p>
                  <p className="text-xs text-gray-300 mt-1">Add your first SOP to define agent behavior.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {sops.map((sop) => (
                    <div key={sop.id} className="group">
                      <div
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedSOP(expandedSOP === sop.id ? null : sop.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleSOP(sop.id, !sop.enabled)
                            }}
                            className={`w-10 h-6 rounded-full transition-all p-1 ${
                              sop.enabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                              sop.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900 truncate">{sop.title}</p>
                              {('isDefault' in sop) && (sop as any).isDefault && (
                                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full font-medium">Default</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{sop.objective}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEditSOP(sop)
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                            title="Edit SOP"
                          >
                            <FileEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSOP(sop.id)
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedSOP === sop.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {expandedSOP === sop.id && (
                        <div className="px-4 pb-4 bg-gray-50/50">
                          <div className="ml-13 pl-10 space-y-3">
                            {editingSOPId === sop.id ? (
                              <>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Title</p>
                                  <input
                                    type="text"
                                    value={editingSOP.title}
                                    onChange={(e) => setEditingSOP({ ...editingSOP, title: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Objective</p>
                                  <textarea
                                    value={editingSOP.objective}
                                    onChange={(e) => setEditingSOP({ ...editingSOP, objective: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Trigger</p>
                                  <textarea
                                    value={editingSOP.trigger}
                                    onChange={(e) => setEditingSOP({ ...editingSOP, trigger: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                  />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Steps</p>
                                  <div className="space-y-2">
                                    {editingSOP.steps.map((step, idx) => (
                                      <div key={idx} className="flex gap-2">
                                        <span className="w-8 h-9 bg-gray-200 rounded-lg flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                                          {idx + 1}
                                        </span>
                                        <textarea
                                          value={step}
                                          onChange={(e) => {
                                            const steps = [...editingSOP.steps]
                                            steps[idx] = e.target.value
                                            setEditingSOP({ ...editingSOP, steps })
                                          }}
                                          rows={2}
                                          className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                        />
                                        {editingSOP.steps.length > 1 && (
                                          <button
                                            onClick={() => {
                                              const steps = editingSOP.steps.filter((_, i) => i !== idx)
                                              setEditingSOP({ ...editingSOP, steps })
                                            }}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            title="Remove step"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => setEditingSOP({ ...editingSOP, steps: [...editingSOP.steps, ''] })}
                                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    + Add Step
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => handleSaveSOPEdit(sop.id)}
                                    className="px-3 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all"
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    onClick={handleCancelEditSOP}
                                    className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-sm transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Trigger</p>
                                  <p className="text-sm text-gray-700">{sop.trigger}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Steps</p>
                                  <ol className="space-y-2">
                                    {sop.steps.map((step, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0 mt-0.5">
                                          {idx + 1}
                                        </span>
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
        </div>

        {/* MCP Connector Section */}
        <div className="mt-12">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Plug className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">MCP Connector</h3>
                  <p className="text-xs text-gray-500">Connect external tools and services</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleMCP(!mcpConfig.enabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mcpConfig.enabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {mcpConfig.enabled ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      Active
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      Disabled
                    </>
                  )}
                </button>
                <button
                  onClick={handleExportMCP}
                  disabled={mcpConfig.servers.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export MCP configuration as JSON"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => mcpFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all"
                  title="Import MCP servers from JSON"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
                <input
                  ref={mcpFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportMCP}
                  className="hidden"
                />
                <button
                  onClick={() => setShowNewMCPForm(!showNewMCPForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Server
                </button>
              </div>
            </div>

            {/* New MCP Server Form */}
            {showNewMCPForm && (
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Server Name</label>
                      <input
                        type="text"
                        value={newMCPServer.name}
                        onChange={(e) => setNewMCPServer({ ...newMCPServer, name: e.target.value })}
                        placeholder="e.g., Zendesk, Stripe"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Transport Type</label>
                      <select
                        value={newMCPServer.type}
                        onChange={(e) => setNewMCPServer({ ...newMCPServer, type: e.target.value as 'stdio' | 'sse' | 'streamable-http' })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      >
                        <option value="sse">SSE (Server-Sent Events)</option>
                        <option value="streamable-http">Streamable HTTP</option>
                        <option value="stdio">Stdio (Local Process)</option>
                      </select>
                    </div>
                  </div>
                  
                  {newMCPServer.type === 'stdio' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Command</label>
                        <input
                          type="text"
                          value={newMCPServer.command}
                          onChange={(e) => setNewMCPServer({ ...newMCPServer, command: e.target.value })}
                          placeholder="e.g., npx, uvx"
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">Arguments (space-separated)</label>
                        <input
                          type="text"
                          value={newMCPServer.args}
                          onChange={(e) => setNewMCPServer({ ...newMCPServer, args: e.target.value })}
                          placeholder="e.g., -y @modelcontextprotocol/server-github"
                          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700">Server URL</label>
                      <input
                        type="url"
                        value={newMCPServer.url}
                        onChange={(e) => setNewMCPServer({ ...newMCPServer, url: e.target.value })}
                        placeholder="https://api.example.com/mcp"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">API Key (optional)</label>
                    <input
                      type="password"
                      value={newMCPServer.apiKey}
                      onChange={(e) => setNewMCPServer({ ...newMCPServer, apiKey: e.target.value })}
                      placeholder="Optional authentication key"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleAddMCPServer}
                      className="flex-1 bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-800 transition-all"
                    >
                      Add Server
                    </button>
                    <button
                      onClick={() => {
                        setShowNewMCPForm(false)
                        setNewMCPServer({ name: '', url: '', apiKey: '', type: 'sse', command: '', args: '' })
                      }}
                      className="px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MCP Servers List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {isLoadingMCP ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-400 text-sm">Loading MCP servers...</p>
                </div>
              ) : mcpConfig.servers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex justify-center mb-3">
                    <Server className="w-10 h-10 text-gray-200" />
                  </div>
                  <p className="text-gray-400 text-sm">No MCP servers configured.</p>
                  <p className="text-xs text-gray-300 mt-1">Connect to external tools like CRMs, ticketing systems, and APIs.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {mcpConfig.servers.map((server) => (
                    <div
                      key={server.id}
                      className="group flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleMCPServer(server.id, !server.enabled)}
                          className={`w-10 h-6 rounded-full transition-all p-1 ${
                            server.enabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                            server.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Server className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{server.name}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {server.type === 'stdio' ? `${server.command} ${server.args?.join(' ')}` : server.url}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          server.type === 'sse' 
                            ? 'bg-blue-100 text-blue-700' 
                            : server.type === 'streamable-http'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {server.type.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteMCPServer(server.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {mcpConfig.lastUpdated && (
              <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  Last updated: {new Date(mcpConfig.lastUpdated).toLocaleString()}
                </p>
              </div>
            )}
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

      {/* Document Viewer Modal */}
      {(viewingDocument || isLoadingDocument) && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setViewingDocument(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {viewingDocument?.filename.replace(/^uploaded_/, '').replace(/^scraped_/, '') || 'Loading...'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingDocument && viewingDocument && (
                  <button
                    onClick={() => setIsEditingDocument(true)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all flex items-center gap-1"
                    title="Edit document"
                  >
                    <FileEdit className="w-4 h-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setViewingDocument(null)
                    setIsEditingDocument(false)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingDocument ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                </div>
              ) : isEditingDocument && viewingDocument ? (
                <textarea
                  value={editedDocumentContent}
                  onChange={(e) => setEditedDocumentContent(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black resize-none"
                  placeholder="Edit document content..."
                />
              ) : viewingDocument ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-50 p-6 rounded-lg border border-gray-200 leading-relaxed text-gray-800">
                    {viewingDocument.content}
                  </pre>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              {isEditingDocument && (
                <>
                  <button
                    onClick={() => {
                      setIsEditingDocument(false)
                      setEditedDocumentContent(viewingDocument?.content || '')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDocumentEdit}
                    disabled={isSavingDocument}
                    className="px-4 py-2 text-sm font-medium bg-black text-white hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-all flex items-center gap-2"
                  >
                    {isSavingDocument ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isSavingDocument ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
              {!isEditingDocument && (
                <button
                  onClick={() => setViewingDocument(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
