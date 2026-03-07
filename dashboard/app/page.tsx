'use client'

import ChatInterface from '@/components/ChatInterface'
import { COMPANY_CONFIG } from '@/config/company'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  BookOpen,
  ShoppingBag,
  MessageSquare,
  AlertTriangle,
  Settings,
  Smartphone,
  CheckCircle,
  ArrowRight,
  Activity,

} from 'lucide-react'

export default function Home() {
  const [iMessageStatus, setIMessageStatus] = useState<'running' | 'stopped' | 'loading'>('stopped')
  const [isToggling, setIsToggling] = useState(false)
  const [uptime, setUptime] = useState(0)
  const [setupComplete, setSetupComplete] = useState(true)
  const [setupMessage, setSetupMessage] = useState('')
  const [documentCount, setDocumentCount] = useState(0)
  const [lastScraped, setLastScraped] = useState<string | null>(null)
  const [statusInterval, setStatusInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    checkSetupStatus()
    checkStatus()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => { checkSetupStatus() }, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (statusInterval) { clearInterval(statusInterval); setStatusInterval(null) }
    if (iMessageStatus === 'running') {
      const interval = setInterval(checkStatus, 3000)
      setStatusInterval(interval)
      return () => { clearInterval(interval) }
    }
  }, [iMessageStatus])

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status')
      const data = await res.json()
      setSetupComplete(data.complete)
      setSetupMessage(data.message)
      setDocumentCount(data.documentCount)
      setLastScraped(data.lastScraped || null)
    } catch {}
  }

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/imessage')
      const data = await res.json()
      setIMessageStatus(data.status)
      setUptime(data.uptime || 0)
    } catch {}
  }

  const toggleIMessage = async () => {
    setIsToggling(true)
    try {
      const action = iMessageStatus === 'running' ? 'stop' : 'start'
      const res = await fetch('/api/imessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (res.ok) {
        await checkStatus()
      } else {
        const error = await res.json()
        alert(`Failed to ${action} iMessage agent: ${error.details || error.error}`)
      }
    } catch {
      alert('Failed to control iMessage agent.')
    } finally {
      setIsToggling(false)
    }
  }

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h ${m % 60}m`
    if (m > 0) return `${m}m ${s % 60}s`
    return `${s}s`
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <nav className="border-b border-[#1a1a1a] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" className="w-6 h-6 rounded object-cover" alt="Photon" />
          <span className="text-sm font-medium text-white">{COMPANY_CONFIG.name}</span>
          <span className="text-[#333]">/</span>
          <span className="text-sm text-[#888]">Support Agent</span>
        </div>
        <div className="flex items-center gap-4">
          {setupComplete && documentCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#888]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c950]" />
              {documentCount} docs indexed
              {lastScraped ? ` · ${new Date(lastScraped).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>
          )}
          <Link
            href="/config"
            className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-[#111] border border-transparent hover:border-[#222]"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Setup Warning */}
        {!setupComplete && (
          <div className="mb-8 rounded-lg border border-[#f5a623]/20 bg-[#f5a623]/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-[#f5a623] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#f5a623]">Setup required</p>
                <p className="text-xs text-[#888] mt-0.5 mb-3">{setupMessage}</p>
                <Link
                  href="/config"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#f5a623]/20 hover:bg-[#f5a623]/30 border border-[#f5a623]/30 rounded-md px-3 py-1.5 transition-colors"
                >
                  Go to setup <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
            <p className="text-sm text-[#888] mt-1 max-w-md">{COMPANY_CONFIG.description}</p>
          </div>

          {/* iMessage control */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={toggleIMessage}
              disabled={isToggling || iMessageStatus === 'loading' || !setupComplete}
              title={!setupComplete ? 'Complete setup first' : ''}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-md text-sm font-medium transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                iMessageStatus === 'running'
                  ? 'bg-[#ff4444]/10 border-[#ff4444]/30 text-[#ff4444] hover:bg-[#ff4444]/15'
                  : 'bg-white border-white text-black hover:bg-[#ededed]'
              }`}
            >
              {isToggling ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Processing</span>
                </>
              ) : iMessageStatus === 'running' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4444] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff4444]" />
                  </span>
                  <div className="text-left">
                    <div className="leading-none">Stop Agent</div>
                    <div className="text-[10px] opacity-60 mt-0.5 font-normal">{formatUptime(uptime)}</div>
                  </div>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Launch iMessage Agent</span>
                </>
              )}
            </button>

            {iMessageStatus === 'running' && (
              <div className="flex items-center gap-1.5 text-xs text-[#00c950]">
                <Activity className="w-3 h-3" />
                <span>Agent active</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#555] uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${iMessageStatus === 'running' ? 'bg-[#00c950]' : 'bg-[#333]'}`} />
              <span className="text-sm font-medium text-white capitalize">{iMessageStatus}</span>
            </div>
          </div>
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#555] uppercase tracking-wider mb-1">Knowledge</div>
            <div className="text-sm font-medium text-white">{documentCount} <span className="text-[#555] font-normal">documents</span></div>
          </div>
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#555] uppercase tracking-wider mb-1">Setup</div>
            <div className="flex items-center gap-2">
              {setupComplete
                ? <><CheckCircle className="w-3.5 h-3.5 text-[#00c950]" /><span className="text-sm font-medium text-white">Ready</span></>
                : <><AlertTriangle className="w-3.5 h-3.5 text-[#f5a623]" /><span className="text-sm font-medium text-[#f5a623]">Incomplete</span></>
              }
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-white">Playground</h2>
            <span className="text-xs text-[#555] bg-[#111] border border-[#222] px-2 py-0.5 rounded-full">Test your agent</span>
          </div>
          <ChatInterface />
        </div>

        {/* Features */}
        <div className="border-t border-[#111] pt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: <BookOpen className="w-4 h-4" />, title: 'RAG Knowledge Base', desc: 'Semantic search over your docs with vector embeddings for context-aware answers.' },
            { icon: <ShoppingBag className="w-4 h-4" />, title: 'Product Catalog', desc: 'Integrated service catalog with fixed and negotiable pricing support.' },
            { icon: <MessageSquare className="w-4 h-4" />, title: 'Smart Negotiation', desc: 'Autonomous price negotiation within your configured safety bounds.' },
          ].map((f, i) => (
            <div key={i}>
              <div className="w-7 h-7 rounded-md bg-[#111] border border-[#222] flex items-center justify-center text-[#888] mb-3">
                {f.icon}
              </div>
              <div className="text-sm font-medium text-white mb-1">{f.title}</div>
              <div className="text-xs text-[#555] leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[#111] flex items-center justify-between">
          <p className="text-xs text-[#333]">
            Built by{' '}
            <a href="https://anmolsingh.dev" target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-white transition-colors">Anmol</a>
            {' '}x{' '}
            <a href="https://photon.codes" target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-white transition-colors">Photon</a>
          </p>
          <a
            href="https://github.com/photon-hq/centric"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#333] hover:text-white transition-colors"
          >
            GitHub
          </a>
        </footer>
      </div>
    </main>
  )
}
