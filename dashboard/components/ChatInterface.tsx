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
  Bot
} from 'lucide-react'

import PhotonLogo from './PhotonLogo'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          history: messages.slice(-10) // Send last 10 messages for context
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
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
          <button
            onClick={() => setMessages([{
              role: 'assistant',
              content: COMPANY_CONFIG.greeting,
              timestamp: new Date()
            }])}
            className="text-xs text-gray-400 hover:text-black transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
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
