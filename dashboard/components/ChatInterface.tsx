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
  Wrench,

} from 'lucide-react'

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
    <div className="text-[10px] font-mono rounded-md overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a]">
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors ${
          call.isKbSearch
            ? 'text-blue-400 hover:bg-blue-950/30'
            : 'text-amber-400 hover:bg-amber-950/30'
        }`}
      >
        {call.isKbSearch
          ? <Search className="w-2.5 h-2.5 shrink-0" />
          : <Wrench className="w-2.5 h-2.5 shrink-0" />}
        <span className="truncate flex-1">{label}</span>
        {expanded
          ? <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-40" />
          : <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-40" />}
      </button>
      {expanded && (
        <pre className="px-2.5 py-2 text-[#888] whitespace-pre-wrap break-all border-t border-[#1a1a1a] bg-black max-h-48 overflow-y-auto leading-relaxed">
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
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isUserNearBottomRef = useRef<boolean>(true)
  const shouldScrollRef = useRef<boolean>(false)

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

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (shouldScrollRef.current || isUserNearBottomRef.current) scrollToBottom()
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
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    shouldScrollRef.current = true
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId.current },
        body: JSON.stringify({ message: input, senderPhone }),
      })
      const data = await res.json()
      if (data.response) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          toolCalls: data.toolCalls ?? []
        }])
      }
      if (data.handoffActive) setIsHandoffActive(true)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Technical error. Please try again.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const resetChat = () => {
    setMessages([])
    setIsHandoffActive(false)
    sessionId.current = crypto.randomUUID()
  }

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden flex flex-col h-[580px]">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between bg-black">
        <div className="flex items-center gap-2.5">
          <img src="/logo.jpg" className="w-7 h-7 rounded-md object-cover" alt="Photon" />
          <div>
            <div className="text-xs font-medium text-white">{COMPANY_CONFIG.name} Assistant</div>
            <div className="text-[10px] text-[#00c950] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c950]" />
              Online
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#555]">From</span>
            <input
              type="text"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              className="text-[10px] text-[#888] font-mono bg-[#111] border border-[#222] rounded px-2 py-1 w-32 focus:outline-none focus:border-[#444] transition-colors"
            />
          </div>
          <button
            onClick={resetChat}
            className="text-[10px] text-[#555] hover:text-white transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <img src="/logo.jpg" className="w-10 h-10 rounded-xl object-cover mx-auto mb-3 opacity-30" alt="Photon" />
              <p className="text-sm text-[#555]">Send a message to test your agent</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            {message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0 && (
              <div className="w-full max-w-[85%] mb-1.5 space-y-1">
                {message.toolCalls.map((call, i) => (
                  <ToolCallBadge key={i} call={call} />
                ))}
              </div>
            )}
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              message.role === 'user'
                ? 'bg-white text-black rounded-br-sm'
                : 'bg-[#111] text-[#ededed] border border-[#1a1a1a] rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={`text-[10px] mt-1.5 font-mono ${
                message.role === 'user' ? 'text-[#999]' : 'text-[#444]'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-xl rounded-bl-sm px-4 py-3.5">
              <div className="flex space-x-1.5">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {isHandoffActive && (
          <div className="flex justify-center">
            <div className="text-xs text-[#f5a623] bg-[#f5a623]/10 border border-[#f5a623]/20 rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f5a623] animate-pulse" />
              Waiting for human agent...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 py-2.5 border-t border-[#111] bg-[#0a0a0a]">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { label: 'Services', icon: <ShoppingBag className="w-3 h-3" />, prompt: 'What services do you offer?' },
            { label: 'Pricing', icon: <DollarSign className="w-3 h-3" />, prompt: 'How much does your service cost?' },
            { label: 'Get Started', icon: <Rocket className="w-3 h-3" />, prompt: 'Can you help me get started?' },
            { label: 'Offers', icon: <Gift className="w-3 h-3" />, prompt: 'Do you have any special offers?' },
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => setInput(action.prompt)}
              className="text-[11px] bg-[#111] border border-[#222] text-[#888] rounded-full px-3 py-1.5 hover:bg-[#1a1a1a] hover:text-white hover:border-[#333] transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#111] bg-black">
        <div className="flex gap-2 items-center bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 focus-within:border-[#444] transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#444] focus:outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-7 h-7 bg-white text-black rounded-md flex items-center justify-center hover:bg-[#ededed] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
