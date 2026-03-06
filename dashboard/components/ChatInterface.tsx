'use client'

import { useState, useRef, useEffect } from 'react'
import { COMPANY_CONFIG } from '@/config/company'
import {
  ShoppingBag,
  DollarSign,
  Rocket,
  Gift,
  Send,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Search,
  Wrench
} from 'lucide-react'

import PhotonLogo from './PhotonLogo'

interface ToolCallRecord {
  name: string
  args: Record<string, any>
  result: string
  isKbSearch: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolCalls?: ToolCallRecord[]
}

function ToolCallBadge({ call }: { call: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false)

  const label = call.isKbSearch
    ? `search_knowledge_base("${call.args.query ?? ''}")`
    : `${call.name}(${Object.entries(call.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})`

  let resultPreview = call.result
  try {
    const parsed = JSON.parse(call.result)
    resultPreview = JSON.stringify(parsed, null, 2)
  } catch { /* already a string */ }

  return (
    <div className="text-[10px] font-mono rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors ${
          call.isKbSearch
            ? 'text-indigo-600 hover:bg-indigo-50'
            : 'text-amber-700 hover:bg-amber-50'
        }`}
      >
        {call.isKbSearch
          ? <Search className="w-2.5 h-2.5 shrink-0" />
          : <Wrench className="w-2.5 h-2.5 shrink-0" />}
        <span className="truncate flex-1">{label}</span>
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-50" />
          : <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-50" />}
      </button>
      {expanded && (
        <pre className="px-2.5 py-2 text-gray-600 whitespace-pre-wrap break-all border-t border-gray-200 bg-white max-h-48 overflow-y-auto leading-relaxed">
          {resultPreview}
        </pre>
      )}
    </div>
  )
}

const DEFAULT_TEST_PHONE = '+1 (555) 000-0001'

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [senderPhone, setSenderPhone] = useState(DEFAULT_TEST_PHONE)
  const [isHandoffActive, setIsHandoffActive] = useState(false)
  const sessionId = useRef(crypto.randomUUID())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Poll for human replies while handoff is active
  useEffect(() => {
    if (!isHandoffActive) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/poll?sessionId=${sessionId.current}`)
        const data = await res.json()
        if (data.messages?.length) {
          setMessages(prev => [...prev, ...data.messages.map((text: string) => ({
            role: 'assistant' as const,
            content: text,
            timestamp: new Date()
          }))])
        }
        if (data.handoffResolved) setIsHandoffActive(false)
      } catch { /* best-effort */ }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [isHandoffActive])
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isUserNearBottomRef = useRef<boolean>(true)
  const shouldScrollRef = useRef<boolean>(false)

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (shouldScrollRef.current || isUserNearBottomRef.current) {
      scrollToBottom()
    }
    shouldScrollRef.current = false
  }, [messages])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      isUserNearBottomRef.current = scrollHeight - (scrollTop + clientHeight) < 100
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    // initialize
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    shouldScrollRef.current = true
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId.current,
        },
        body: JSON.stringify({ message: input, senderPhone }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: data.toolCalls ?? []
      }

      setMessages(prev => [...prev, assistantMessage])

      if (data.handoffActive) setIsHandoffActive(true)
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[600px] shadow-sm">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center p-1.5">
              <PhotonLogo />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{COMPANY_CONFIG.name} Assistant</h2>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">From:</span>
              <input
                type="text"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
            <button
              onClick={() => { setMessages([]); setIsHandoffActive(false); sessionId.current = crypto.randomUUID() }}
              className="text-xs text-gray-400 hover:text-black transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Tool call badges ,  only for assistant messages */}
            {message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0 && (
              <div className="w-full max-w-[85%] mb-1.5 space-y-1">
                {message.toolCalls.map((call, i) => (
                  <ToolCallBadge key={i} call={call} />
                ))}
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                message.role === 'user'
                  ? 'bg-black text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={`text-[10px] mt-2 opacity-50 ${
                message.role === 'user' ? 'text-gray-300' : 'text-gray-400'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { label: "Services", icon: <ShoppingBag className="w-3 h-3" />, prompt: "What services do you offer?" },
            { label: "Pricing", icon: <DollarSign className="w-3 h-3" />, prompt: "How much does your service cost?" },
            { label: "Get Started", icon: <Rocket className="w-3 h-3" />, prompt: "Can you help me get started?" },
            { label: "Offers", icon: <Gift className="w-3 h-3" />, prompt: "Do you have any special offers?" }
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickPrompt(action.prompt)}
              className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:bg-gray-100 hover:border-gray-300 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-100">
        <div className="flex space-x-2 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 pl-4 pr-12 py-3 bg-gray-50 border-none rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-200 placeholder-gray-400 text-gray-800 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1.5 bottom-1.5 bg-black text-white rounded-lg px-3 text-xs font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  )
}
