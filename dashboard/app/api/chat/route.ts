import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { DocumentVectorStore } from '../../../lib/vector-store'
import { ProductCatalog, type Product, type NegotiableProduct } from '../../../lib/product-catalog'
import { COMPANY_CONFIG } from '../../../config/company'
import { generateSystemPrompt, generateContextPrompt, generateNegotiationResponse, generatePurchaseResponse, generateFixedPriceResponse, generateErrorResponse } from '../../../config/prompts'
import * as path from 'path'
import * as fsSync from 'fs'

// Load environment variables from parent project folder (../.env.local or ../.env)
function loadParentEnvSync() {
  const candidates = [
    path.join(process.cwd(), '..', '.env.local'),
    path.join(process.cwd(), '..', '.env')
  ]

  for (const p of candidates) {
    if (fsSync.existsSync(p)) {
      try {
        const data = fsSync.readFileSync(p, 'utf8')
        data.split(/\r?\n/).forEach(line => {
          const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/)
          if (!m) return
          let key = m[1]
          let val = m[2] || ''
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (process.env[key] === undefined) {
            process.env[key] = val
          }
        })
        console.log(`Loaded environment variables from ${p}`)
        break
      } catch (e) {
        // ignore and try next
      }
    }
  }
}

loadParentEnvSync()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Initialize components (singleton pattern)
let vectorStore: DocumentVectorStore | null = null
let productCatalog: ProductCatalog | null = null
let isInitialized = false

async function initialize() {
  if (isInitialized) return

  const documentsPath = path.join(process.cwd(), 'documents')
  
  vectorStore = new DocumentVectorStore(documentsPath, openai)
  await vectorStore.initialize()
  
  productCatalog = new ProductCatalog()
  
  isInitialized = true
  console.log(`✅ Agent initialized with ${vectorStore.getDocumentCount()} documents for ${COMPANY_CONFIG.name}`)
}

// Generate system prompt from company configuration
const SYSTEM_PROMPT = generateSystemPrompt(COMPANY_CONFIG)

// Conversation state (in-memory for demo, could use Redis/DB for production)
interface ConversationState {
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  currentNegotiation?: {
    productId: string
    currentOffer: number
  }
}

const conversations = new Map<string, ConversationState>()

function getConversation(sessionId: string): ConversationState {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, {
      messageHistory: []
    })
  }
  return conversations.get(sessionId)!
}

async function getRelevantContext(query: string): Promise<string> {
  if (!vectorStore) return "No context available"
  
  const results = await vectorStore.search(query, 3)
  
  if (results.length === 0) {
    return "No specific documentation found for this query."
  }
  
  return results.map((r, i) => 
    `[Document ${i + 1}] ${r.content} (Relevance: ${(r.similarity * 100).toFixed(1)}%)`
  ).join('\n\n')
}

function detectProductInquiry(message: string): Product | null {
  if (!productCatalog) return null
  
  const products = productCatalog.getAllProducts()
  
  for (const product of products) {
    const keywords = [product.name.toLowerCase(), product.id, ...product.keywords]
    if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
      return product
    }
  }
  
  return null
}

function detectPriceNegotiation(message: string): boolean {
  const negotiationPhrases = [
    'too expensive', 'too much', 'discount', 'cheaper', 'lower price',
    'budget', 'afford', 'better price', 'deal', 'negotiate',
    'can you do better', 'is that the best', 'reduce the price'
  ]
  
  return negotiationPhrases.some(phrase => 
    message.toLowerCase().includes(phrase)
  )
}

function detectPurchaseIntent(message: string): boolean {
  const purchaseKeywords = [
    'buy', 'purchase', 'get it', 'sign up', 'enroll', 'yes please',
    'i\'ll take it', 'sounds good', 'let\'s do it', 'proceed'
  ]
  
  return purchaseKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  )
}

async function handleNegotiation(
  conversation: ConversationState,
  message: string,
  product: NegotiableProduct
): Promise<string> {
  if (!conversation.currentNegotiation) {
    conversation.currentNegotiation = {
      productId: product.id,
      currentOffer: product.price
    }
  }
  
  const negotiation = conversation.currentNegotiation
  
  if (!product.negotiable) {
    return generateFixedPriceResponse(product.name, product.price)
  }
  
  const discountPercentage = 0.15
  const offeredPrice = Math.max(
    product.lowestNegotiationPrice,
    Math.round(product.price * (1 - discountPercentage))
  )
  
  negotiation.currentOffer = offeredPrice
  const discountPercent = Math.round(((product.price - offeredPrice) / product.price) * 100)
  
  return generateNegotiationResponse(
    product.name,
    product.price,
    offeredPrice,
    product.features,
    discountPercent
  )
}

async function generateResponse(
  sessionId: string,
  userMessage: string,
  history?: Array<{ role: string; content: string }>
): Promise<string> {
  await initialize()
  
  const conversation = getConversation(sessionId)
  
  // Add user message to history
  conversation.messageHistory.push({
    role: 'user',
    content: userMessage
  })
  
  // Keep only last 10 messages
  if (conversation.messageHistory.length > 10) {
    conversation.messageHistory = conversation.messageHistory.slice(-10)
  }
  
  // Detect product inquiries
  const product = detectProductInquiry(userMessage)
  let productContext = ''
  
  if (product && productCatalog) {
    productContext = `\n\nRELEVANT PRODUCT INFORMATION:
${productCatalog.getProductDescription(product.id)}`
    
    // Check for negotiation
    if (detectPriceNegotiation(userMessage) && 'negotiable' in product) {
      const negotiationResponse = await handleNegotiation(
        conversation,
        userMessage,
        product as NegotiableProduct
      )
      conversation.messageHistory.push({
        role: 'assistant',
        content: negotiationResponse
      })
      return negotiationResponse
    }
    
    // Check for purchase intent
    if (detectPurchaseIntent(userMessage)) {
      const price = conversation.currentNegotiation?.currentOffer || product.price
      const purchaseResponse = generatePurchaseResponse(COMPANY_CONFIG, product.name, price)
      
      conversation.messageHistory.push({
        role: 'assistant',
        content: purchaseResponse
      })
      return purchaseResponse
    }
  }
  
  // Get relevant documents
  const documentContext = await getRelevantContext(userMessage)
  
  // Build context
  const contextPrompt = generateContextPrompt(documentContext, productContext)
  
  // Generate AI response
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: contextPrompt },
    ...conversation.messageHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  ]
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 1000
  })
  
  const assistantMessage = completion.choices[0].message.content || 
    generateErrorResponse(COMPANY_CONFIG)
  
  conversation.messageHistory.push({
    role: 'assistant',
    content: assistantMessage
  })
  
  return assistantMessage
}

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }
    
    // Use a session ID (in production, use actual session management)
    const sessionId = request.headers.get('x-session-id') || 'default'
    
    const response = await generateResponse(sessionId, message, history)
    
    return NextResponse.json({ response })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
