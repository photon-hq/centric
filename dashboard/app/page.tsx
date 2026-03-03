import ChatInterface from '@/components/ChatInterface'
import { COMPANY_CONFIG } from '@/config/company'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <Link 
              href="/config"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              🔧 Configure Knowledge Base
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🤖 {COMPANY_CONFIG.name} Support Agent
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {COMPANY_CONFIG.description}
          </p>
        </div>

        {/* Chat Interface */}
        <div className="max-w-4xl mx-auto">
          <ChatInterface />
        </div>

        {/* Info Cards */}
        <div className="max-w-4xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <div className="text-2xl mb-2">📚</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              RAG Knowledge Base
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Searches tax documentation with semantic embeddings
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <div className="text-2xl mb-2">🛍️</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Product Catalog
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              8 services with fixed and negotiable pricing
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Smart Negotiation
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Handles price negotiations within configured ranges
            </p>
          </div>
        </div>

        {/* Quick Test Prompts */}
        <div className="max-w-4xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            💡 Try asking:
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• "What documents do I need to file my taxes?"</li>
            <li>• "How much does individual tax filing cost?"</li>
            <li>• "That's too expensive, can you do better?"</li>
            <li>• "When is the tax deadline?"</li>
            <li>• "Do you help with business taxes?"</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
