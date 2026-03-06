import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  DocumentVectorStore,
  ProductCatalog,
  SlackNotifier,
  type Product,
  type NegotiableProduct,
  type ConversationState,
  generateSystemPrompt,
  generateContextPrompt,
  generateNegotiationResponse,
  generatePurchaseResponse,
  generateFixedPriceResponse,
  generateErrorResponse,
  sanitizeEmDashes,
  MCPManager,
  ConfigLoader,
  type LoadedConfig
} from '@photon/core'
import { readKnowledgeVersion } from '../../../lib/knowledge-version'
import { humanMsgQueues, resolvedSessions, setDashboardSlackNotifier } from './state'
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
          const key = m[1]
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
let config: LoadedConfig | null = null
let vectorStore: DocumentVectorStore | null = null
let productCatalog: ProductCatalog | null = null
let isInitialized = false
let initPromise: Promise<void> | null = null
let loadedKnowledgeVersion = '0'

// ============================================================================
// MCP Integration
// ============================================================================

let mcpManager: MCPManager | null = null

// ============================================================================
// Slack Notifier (dashboard singleton)
// ============================================================================

let slackNotifier: SlackNotifier | null = null

async function initialize() {
  if (isInitialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    // Load configuration
    if (!config) {
      const configLoader = new ConfigLoader({ 
        configDir: path.join(process.cwd(), '..', 'config')
      })
      config = await configLoader.loadAll()
    }

    const documentsPath = path.join(process.cwd(), '..', 'documents')

    if (!vectorStore) {
      vectorStore = new DocumentVectorStore(
        documentsPath, 
        openai,
        config.ai.embeddingModel
      )
    }

    if (!productCatalog) {
      productCatalog = new ProductCatalog(config.products)
    }

    try {
      // Use a timeout to prevent worker issues from hanging forever
      // Attach .catch() to the init promise before racing so that if the timeout
      // wins and the worker later crashes, the rejection doesn't become an uncaughtException
      const vsInit = vectorStore.initialize()
      vsInit.catch(() => {})
      const initPromiseWithTimeout = Promise.race([
        vsInit,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Vector store initialization timeout')), 10000)
        )
      ])
      await initPromiseWithTimeout
    } catch (error) {
      console.warn('⚠️  Dashboard: Vector store initialization failed (non-fatal):', error instanceof Error ? error.message : error)
      // Fallback to a noop vector store so the API can still respond without docs
      vectorStore = {
        initialize: async () => {},
        search: async (_q: string, _n: number = 3, _m: number = 0) => [] as any[],
        getDocumentCount: () => 0
      } as unknown as DocumentVectorStore
      console.log('✅ Dashboard: Using fallback vector store (no embeddings available)')
    }

    // Load MCP tools (non-fatal if unavailable)
    mcpManager = new MCPManager()
    await mcpManager.loadConfig(config.mcp ?? null).catch((err) => {
      console.warn('⚠️  Dashboard: Failed to load MCP config:', err)
    })

    // Initialize Slack notifier if configured
    const handoffConfig = config.company.humanHandoff
    const botToken = process.env.SLACK_BOT_TOKEN
    const appToken = process.env.SLACK_APP_TOKEN
    const channelId = process.env.SLACK_CHANNEL_ID || handoffConfig?.slackChannelId || ''

    if (handoffConfig?.slackEnabled && botToken && appToken && channelId) {
      slackNotifier = new SlackNotifier(botToken, appToken, channelId, {
        onMessageForCustomer: (sessionId, text) => {
          const q = humanMsgQueues.get(sessionId) ?? []
          q.push(text)
          humanMsgQueues.set(sessionId, q)
        },
        onResolve: (sessionId) => {
          const conv = conversations.get(sessionId)
          if (conv) {
            conv.humanHandoffActive = false
            conv.slackThreadTs = undefined
            resolvedSessions.add(sessionId)
          }
        }
      })
      await slackNotifier.start().catch((err) => {
        console.warn('⚠️  Dashboard: Failed to start Slack notifier:', err)
        slackNotifier = null
      })
      setDashboardSlackNotifier(slackNotifier)
      if (slackNotifier) console.log('✅ Dashboard: Slack notifier started')
    }

    isInitialized = true
    console.log(`✅ Agent initialized with ${vectorStore.getDocumentCount()} documents for ${config.company.name}`)
  })()

  try {
    await initPromise
  } catch {
    // initialization failed ,  clear so the next request retries
    initPromise = null
  } finally {
    if (isInitialized) {
      initPromise = null
    }
  }
}

async function ensureKnowledgeBaseVersion(): Promise<void> {
  const currentVersion = await readKnowledgeVersion()
  if (currentVersion !== loadedKnowledgeVersion) {
    isInitialized = false
    initPromise = null
    vectorStore = null
    config = null        // reload company/features/products on next request
    productCatalog = null
    loadedKnowledgeVersion = currentVersion
  }
}

async function waitForInitialization(timeoutMs: number = 6000): Promise<void> {
  await ensureKnowledgeBaseVersion()

  const ensureInit = initialize().catch((error) => {
    console.warn('⚠️  Initialization failed:', error)
  })

  await Promise.race([
    ensureInit,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  ])
}

const conversations = new Map<string, ConversationState>()

function newTicketState(): ConversationState {
  return {
    messageHistory: [],
    firstMessageShown: false,
    humanHandoffRequested: false,
    humanHandoffActive: false,
    handoffCount: 0,
    ticketClosed: false,
    ticketId: crypto.randomUUID()
  }
}

function getConversation(sessionId: string): ConversationState {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, newTicketState())
  }
  return conversations.get(sessionId)!
}

function detectTicketClose(message: string): boolean {
  const lower = message.toLowerCase()
  const closePhrases = [
    'close ticket', 'close the ticket', 'close this ticket',
    'resolve ticket', 'mark resolved', 'that\'s all', "that's all",
    'no more questions', 'nothing else', 'all done', 'all good',
    'thanks, goodbye', 'thank you, goodbye'
  ]
  return closePhrases.some(phrase => lower.includes(phrase))
}

function detectHumanHandoff(message: string): boolean {
  const keywords = config?.company.humanHandoff?.keywords
  const phrases = keywords?.length ? keywords : [
    'speak to a human', 'talk to a person', 'real person', 'human agent',
    'customer service', 'representative', 'speak to someone', 'talk to agent',
    'need a human', 'want a person', 'actual person', 'live agent',
    'human help', 'human support'
  ]
  return phrases.some(phrase => message.toLowerCase().includes(phrase.toLowerCase()))
}

async function generateHandoffSummary(conversation: ConversationState): Promise<string> {
  try {
    const historyText = conversation.messageHistory
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n')
    const completion = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-5-mini',
      messages: [
        { role: 'system', content: "Summarize the customer's issue in 2-3 sentences for a support agent taking over." },
        { role: 'user', content: `Conversation:\n${historyText}` }
      ],
      temperature: 0.3,
      max_completion_tokens: 150
    })
    return completion.choices[0]?.message?.content || 'Customer requested human support.'
  } catch {
    return 'Customer requested human support.'
  }
}

async function getRelevantContext(query: string): Promise<string> {
  if (!vectorStore) return "No context available"
  
  try {
    const results = await vectorStore.search(query, 3, config?.features.knowledgeBase.similarityThreshold ?? 0)
    
    if (results.length === 0) {
      return "No specific documentation found for this query."
    }
    
    return results.map((r, i) => 
      `[Document ${i + 1}] ${r.content} (Relevance: ${(r.similarity * 100).toFixed(1)}%)`
    ).join('\n\n')
  } catch (error) {
    console.warn('⚠️  Vector search failed (non-fatal):', error instanceof Error ? error.message : error)
    return "No specific documentation found for this query."
  }
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
  if (!product.negotiable) {
    return generateFixedPriceResponse(product.name, product.price)
  }

  if (!conversation.currentNegotiation) {
    conversation.currentNegotiation = {
      productId: product.id,
      currentOffer: product.price,
      negotiationRound: 1
    }
  }

  const negotiation = conversation.currentNegotiation

  const discountPercentage = config!.features.negotiation.defaultDiscount
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
    discountPercent,
    config!.features.timeConstraints.offerValidityHours
  )
}

async function generateResponse(
  sessionId: string,
  userMessage: string,
  senderPhone?: string
): Promise<string> {
  try {
    await waitForInitialization(6000)
  } catch (error) {
    console.warn('⚠️  Initialization error (continuing with fallback):', error instanceof Error ? error.message : error)
    // Continue anyway - fallback vector store will be used
  }
  
  // Make sure we have a valid vectorStore even if initialization fails
  if (!vectorStore) {
    vectorStore = {
      initialize: async () => {},
      search: async (_q: string, _n: number = 3, _m: number = 0) => [] as any[],
      getDocumentCount: () => 0
    } as unknown as DocumentVectorStore
  }
  
  let conversation = getConversation(sessionId)

  // If the previous ticket was closed, open a fresh one
  if (conversation.ticketClosed) {
    const fresh = newTicketState()
    conversations.set(sessionId, fresh)
    conversation = fresh
  }

  // Check if this is the first message
  const isFirstMessage = conversation.messageHistory.length === 0 && !conversation.firstMessageShown

  // Detect explicit ticket-close intent
  if (detectTicketClose(userMessage)) {
    conversation.ticketClosed = true
    const closeMsg = sanitizeEmDashes("Got it ,  I've closed this ticket. If you need anything else in the future, feel free to message again and we'll open a new one. Take care!")
    conversation.messageHistory.push({ role: 'assistant', content: closeMsg })
    return closeMsg
  }

  // Add user message to history
  conversation.messageHistory.push({
    role: 'user',
    content: userMessage
  })

  // Keep only last 10 messages
  if (conversation.messageHistory.length > 10) {
    conversation.messageHistory = conversation.messageHistory.slice(-10)
  }

  // If already in human handoff, relay message to Slack and hold
  if (conversation.humanHandoffActive) {
    if (slackNotifier && conversation.slackThreadTs) {
      await slackNotifier.postCustomerMessage(conversation.slackThreadTs, userMessage)
    }
    const holdMsg = sanitizeEmDashes("Your message has been sent to our support team. They'll reply here shortly.")
    conversation.messageHistory.push({ role: 'assistant', content: holdMsg })
    return holdMsg
  }

  // Check for human handoff request
  if (config?.company.humanHandoff?.enabled && detectHumanHandoff(userMessage)) {
    conversation.humanHandoffRequested = true
    conversation.handoffCount = (conversation.handoffCount ?? 0) + 1

    const handoffMsg = sanitizeEmDashes(config.company.humanHandoff.message || "I'll connect you with a team member. Please hold on.")
    conversation.messageHistory.push({ role: 'assistant', content: handoffMsg })

    if (slackNotifier) {
      const summary = await generateHandoffSummary(conversation)
      const threadTs = await slackNotifier.postHandoff(sessionId, conversation, summary)
      if (threadTs) {
        conversation.slackThreadTs = threadTs
        conversation.humanHandoffActive = true
      }
    }

    conversation.humanHandoffRequested = false
    return handoffMsg
  }
  
  // Detect product inquiries
  const product = detectProductInquiry(userMessage)
  let productContext = ''
  
  if (product && productCatalog) {
    // Build product description
    const desc = `${product.name} - $${product.price}${product.negotiable ? ' (negotiable)' : ''}\n${product.description}\nFeatures:\n${product.features.map(f => `- ${f}`).join('\n')}`
    productContext = `\n\nRELEVANT PRODUCT INFORMATION:
${desc}`
    
    // Check for negotiation
    if (detectPriceNegotiation(userMessage) && 'negotiable' in product) {
      const negotiationResponse = sanitizeEmDashes(await handleNegotiation(
        conversation,
        userMessage,
        product as NegotiableProduct
      ))
      conversation.messageHistory.push({
        role: 'assistant',
        content: negotiationResponse
      })
      return negotiationResponse
    }
    
    // Check for purchase intent
    if (detectPurchaseIntent(userMessage)) {
      const price = conversation.currentNegotiation?.currentOffer || product.price
      const purchaseResponse = sanitizeEmDashes(generatePurchaseResponse(config!.company, product.name, price, config!.features.timeConstraints.responseTimeMinutes))
      
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
  
  // Generate system prompt from config
  const hasMCPTools = (mcpManager?.isEnabled() && mcpManager.getTools().length > 0) ?? false
  const systemPrompt = generateSystemPrompt(config!.company, config!.sops || [], config!.features, senderPhone, hasMCPTools)

  // Generate AI response with MCP tool support
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt + '\n\n' + contextPrompt },
    ...conversation.messageHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  ]
  
  // Add MCP tools if enabled
  const completionOptions: OpenAI.Chat.ChatCompletionCreateParams = {
    model: process.env.MODEL || 'gpt-5-mini',
    messages,
    temperature: config!.ai.temperature,
    max_completion_tokens: config!.ai.maxTokens
  }
  
  if (hasMCPTools) {
    completionOptions.tools = mcpManager!.convertToOpenAIFormat()
    completionOptions.tool_choice = 'auto'
  }
  
  let assistantMessage = ''
  const maxIterations = 5 // Prevent infinite loops
  let iteration = 0
  
  // Tool calling loop
  while (iteration < maxIterations) {
    iteration++
    
    const completion = await openai.chat.completions.create(completionOptions)
    const choice = completion.choices[0]
    
    // If the model wants to call tools
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Add assistant's tool call message to history
      messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)
      
      // Execute each tool call
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name
          let functionArgs: Record<string, any>
          try {
            functionArgs = JSON.parse(toolCall.function.arguments)
          } catch {
            functionArgs = {}
          }
          
          console.log(`🔧 Dashboard: Executing MCP tool: ${functionName}`, functionArgs)
          
          try {
            const result = await mcpManager!.executeTool(functionName, functionArgs)
            
            // Add tool result to messages
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            })
            
            console.log(`✅ Dashboard: Tool result:`, result)
          } catch (error) {
            console.error(`❌ Dashboard: Tool execution error:`, error)
            
            // Add error as tool result
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
              })
            })
          }
        }
      }
      
      // Update messages for next iteration
      completionOptions.messages = messages
    } else {
      // Got final text response
      assistantMessage = sanitizeEmDashes(choice.message.content || generateErrorResponse(config!.company))
      break
    }
  }
  
  if (!assistantMessage) {
    assistantMessage = sanitizeEmDashes("I apologize, but I reached the maximum number of tool calls. Please try rephrasing your request.")
  }
  
  const finalMessage = sanitizeEmDashes(assistantMessage)

  if (isFirstMessage) {
    conversation.firstMessageShown = true
  }

  conversation.messageHistory.push({
    role: 'assistant',
    content: finalMessage
  })

  return finalMessage
}

export async function POST(request: NextRequest) {
  try {
    const { message, senderPhone } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Use a session ID (in production, use actual session management)
    const sessionId = request.headers.get('x-session-id') || 'default'

    const response = await generateResponse(sessionId, message, senderPhone)
    const conv = conversations.get(sessionId)
    const handoffActive = conv?.humanHandoffActive ?? false

    return NextResponse.json({ response, handoffActive })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
