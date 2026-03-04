'use client'

import ChatInterface from '@/components/ChatInterface'
import { COMPANY_CONFIG } from '@/config/company'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  ShoppingBag, 
  MessageSquare, 
  Lightbulb, 
  AlertTriangle, 
  Settings, 
  Smartphone, 
  CheckCircle,
  Play,
  Square,
  ArrowRight
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

  // Check setup status on mount
  useEffect(() => {
    checkSetupStatus()
    // Check initial iMessage status once
    checkStatus()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      checkSetupStatus()
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  // Poll for status only when iMessage is running
  useEffect(() => {
    // Clear any existing interval
    if (statusInterval) {
      clearInterval(statusInterval)
      setStatusInterval(null)
    }

    // Only start polling if iMessage is running
    if (iMessageStatus === 'running') {
      const interval = setInterval(checkStatus, 3000) // Check every 3 seconds
      setStatusInterval(interval)
      
      return () => {
        clearInterval(interval)
      }
    }
  }, [iMessageStatus])

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/status')
      const data = await response.json()
      setSetupComplete(data.complete)
      setSetupMessage(data.message)
      setDocumentCount(data.documentCount)
      setLastScraped(data.lastScraped || null)
    } catch (error) {
      console.error('Failed to check setup status:', error)
    }
  }

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/imessage')
      const data = await response.json()
      setIMessageStatus(data.status)
      setUptime(data.uptime || 0)
    } catch (error) {
      console.error('Failed to check iMessage status:', error)
    }
  }

  const toggleIMessage = async () => {
    setIsToggling(true)
    try {
      const action = iMessageStatus === 'running' ? 'stop' : 'start'
      const response = await fetch('/api/imessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      
      if (response.ok) {
        await checkStatus()
      } else {
        const error = await response.json()
        alert(`Failed to ${action} iMessage agent: ${error.details || error.error}`)
      }
    } catch (error) {
      console.error('Failed to toggle iMessage agent:', error)
      alert('Failed to control iMessage agent. Check console for details.')
    } finally {
      setIsToggling(false)
    }
  }

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <main className="min-h-screen bg-white text-black font-sans">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Setup Warning Banner */}
        {!setupComplete && (
          <div className="mb-8 border border-yellow-200 bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">
                  Setup Required
                </h3>
                <p className="text-sm text-yellow-800 mb-2">
                  {setupMessage}
                </p>
                <Link 
                  href="/config"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-md text-sm font-medium transition-colors"
                >
                  Go to Setup <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-12">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                {COMPANY_CONFIG.name} Support
              </h1>
              <p className="text-gray-500 max-w-lg">
                {COMPANY_CONFIG.description}
              </p>
              {setupComplete && documentCount > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3" />
                  {documentCount} documents indexed{lastScraped ? ` • Updated ${new Date(lastScraped).toLocaleTimeString()}` : ''}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-3">
              {/* iMessage Control Button */}
              <button
                onClick={toggleIMessage}
                disabled={isToggling || iMessageStatus === 'loading' || !setupComplete}
                title={!setupComplete ? 'Complete setup first' : ''}
                className={`flex items-center gap-3 px-5 py-2.5 rounded-md text-sm font-medium transition-all border ${
                  iMessageStatus === 'running'
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border-black bg-black text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isToggling ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span>Processing...</span>
                  </>
                ) : iMessageStatus === 'running' ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <div className="text-left">
                      <div className="leading-none">Stop Agent</div>
                      <div className="text-[10px] opacity-75 mt-0.5 font-normal">Running: {formatUptime(uptime)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Launch iMessage Agent</span>
                  </>
                )}
              </button>
              
              <Link 
                href="/config"
                className="text-sm text-gray-500 hover:text-black transition-colors flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                <span>Configure Knowledge Base</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="mb-16">
          <ChatInterface />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-gray-100 pt-12">
          <div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mb-4 text-black">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              RAG Knowledge Base
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Searches documentation with semantic embeddings to provide accurate, context-aware answers.
            </p>
          </div>
          
          <div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mb-4 text-black">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Product Catalog
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Integrated service catalog with support for fixed and negotiable pricing models.
            </p>
          </div>
          
          <div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center mb-4 text-black">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Smart Negotiation
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Autonomous price negotiation capabilities within your pre-configured safety ranges.
            </p>
          </div>
        </div>

        {/* Quick Test Prompts */}
        <div className="mt-12 bg-gray-50 rounded-xl p-8">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Example Queries
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "What services do you offer?",
              "How much does your service cost?",
              "Can you tell me about your products?",
              "What documentation do you need?",
              "How does your support work?"
            ].map((query, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                {query}
              </div>
            ))}
          </div>
        </div>
        {/* Footer */}
        <footer className="mt-16 py-8 border-t border-gray-100 text-center text-sm text-gray-500">
          <p>
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
            </a>{' '}
            |{' '} View on {' '}
            <a
              href="https://github.com/photon-hq/centric"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  )
}
