import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  DocumentVectorStore,
  ProductCatalog,
  type Product,
  type NegotiableProduct,
  type ConversationState,
  generateSystemPrompt,
  generateContextPrompt,
  generateNegotiationResponse,
  generatePurchaseResponse,
  generateFixedPriceResponse,
  generateErrorResponse,
  generateGreeting,
  ConfigLoader,
  type LoadedConfig
} from '@photon/core'
import { readKnowledgeVersion } from '../../../lib/knowledge-version'
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

interface MCPServer {
  id: string
  name: string
  url: string
  apiKey?: string
  type: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  enabled: boolean
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  lastUpdated: string | null
}

interface MCPTool {
  name: string
  description: string
  parameters: Record<string, any>
  serverUrl: string
  serverApiKey?: string
}

let mcpTools: MCPTool[] = []
let mcpEnabled = false
let mcpInitialized = false

// ============================================================================
// Em-Dash Sanitizer
// ============================================================================

/**
 * Automatically replace em-dashes and en-dashes with ", " in all LLM output
 * Ensures consistent, human-friendly text formatting without problematic punctuation
 * Handles spaces around dashes to prevent extra whitespace (e.g., "Hi, I'm" → "Hi, I'm")
 */
function sanitizeEmDashes(text: string): string {
  if (!text) return text
  // Replace em-dash (U+2014) or en-dash (U+2013) plus surrounding spaces with a single ", "
  return text.replace(/\s*[\u2014\u2013]\s*/g, ', ')
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function loadMCPConfig(): Promise<void> {
  if (mcpInitialized) return
  
  try {
    const configPath = path.join(process.cwd(), '..', 'config', 'mcp-config.json')
    const configData = await fsSync.promises.readFile(configPath, 'utf-8')
    const config: MCPConfig = JSON.parse(configData)
    
    mcpEnabled = config.enabled
    
    if (!mcpEnabled) {
      console.log('⚠️  MCP is disabled in config')
      mcpInitialized = true
      return
    }
    
    // Fetch tools from each active server
    const toolPromises = config.servers
      .filter(server => server.enabled && (server.type === 'sse' || server.type === 'streamable-http'))
      .map(async (server) => {
        try {
          const toolsUrl = `${server.url}/tools`
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (server.apiKey) {
            headers['Authorization'] = `Bearer ${server.apiKey}`
          }
          
          const response = await fetchWithTimeout(toolsUrl, { headers }, 5000)
          if (!response.ok) {
            console.warn(`⚠️  Failed to fetch tools from ${server.name}: ${response.statusText}`)
            return []
          }
          
          const data: any = await response.json()
          const tools = data.tools || []
          
          return tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || {},
            serverUrl: server.url,
            serverApiKey: server.apiKey
          }))
        } catch (error) {
          console.warn(`⚠️  Error fetching tools from ${server.name}:`, error)
          return []
        }
      })
    
    const toolArrays = await Promise.all(toolPromises)
    mcpTools = toolArrays.flat()
    
    if (mcpTools.length > 0) {
      console.log(`✅ Dashboard: Loaded ${mcpTools.length} MCP tools`)
    } else {
      console.log('⚠️  Dashboard: No MCP tools available')
    }
    
    mcpInitialized = true
  } catch (error) {
    console.warn('⚠️  Dashboard: Failed to load MCP config:', error)
    mcpEnabled = false
    mcpInitialized = true
  }
}

function convertMCPToolsToOpenAIFormat(): OpenAI.Chat.ChatCompletionTool[] {
  return mcpTools.map(tool => {
    // Build properties object without 'required' field in each param
    const properties: Record<string, any> = {}
    const requiredParams: string[] = []
    
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      const { required, ...paramProps } = paramDef as any
      properties[paramName] = paramProps
      if (required) {
        requiredParams.push(paramName)
      }
    }
    
    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required: requiredParams
        }
      }
    }
  })
}

async function executeMCPTool(toolName: string, parameters: Record<string, any>): Promise<any> {
  const tool = mcpTools.find(t => t.name === toolName)
  if (!tool) {
    throw new Error(`Tool ${toolName} not found`)
  }
  
  const callUrl = `${tool.serverUrl}/call`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (tool.serverApiKey) {
    headers['Authorization'] = `Bearer ${tool.serverApiKey}`
  }
  
  const response = await fetchWithTimeout(callUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tool: toolName,
      parameters
    })
  }, 15000)
  
  if (!response.ok) {
    throw new Error(`MCP tool call failed: ${response.statusText}`)
  }
  
  return await response.json()
}

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
    await loadMCPConfig()

    isInitialized = true
    console.log(`✅ Agent initialized with ${vectorStore.getDocumentCount()} documents for ${config.company.name}`)
  })()

  try {
    await initPromise
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
    'thanks, goodbye', 'thank you, goodbye', 'bye', 'goodbye'
  ]
  return closePhrases.some(phrase => lower.includes(phrase))
}

function detectHumanHandoff(message: string): boolean {
  const handoffPhrases = [
    'speak to a human', 'talk to a person', 'real person', 'human agent',
    'customer service', 'representative', 'speak to someone', 'talk to agent',
    'need a human', 'want a person', 'actual person', 'live agent',
    'human help', 'human support'
  ]
  
  return handoffPhrases.some(phrase => 
    message.toLowerCase().includes(phrase)
  )
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
  history?: Array<{ role: string; content: string }>,
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

  // Check for human handoff request
  if (detectHumanHandoff(userMessage)) {
    conversation.humanHandoffRequested = true
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
  
  // If human handoff requested, provide appropriate response
  if (conversation.humanHandoffRequested) {
    const handoffMessage = sanitizeEmDashes("I understand you'd like to speak with a human. Human handoff functionality is being set up and will be available soon. In the meantime, I'm here to help with any questions you have!")
    
    conversation.messageHistory.push({
      role: 'assistant',
      content: handoffMessage
    })
    
    // Reset flag after acknowledging (in production, this would route to human)
    conversation.humanHandoffRequested = false
    
    return handoffMessage
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
  const systemPrompt = generateSystemPrompt(config!.company, config!.sops || [], config!.features, senderPhone, mcpEnabled && mcpTools.length > 0)

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
  
  if (mcpEnabled && mcpTools.length > 0) {
    completionOptions.tools = convertMCPToolsToOpenAIFormat()
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
            const result = await executeMCPTool(functionName, functionArgs)
            
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
  
  let finalMessage = sanitizeEmDashes(assistantMessage)

  if (isFirstMessage) {
    const greeting = generateGreeting(config!.company, true)
    if (greeting) {
      finalMessage = `${greeting}\n\n${finalMessage}`
    }
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
    const { message, history, senderPhone } = await request.json()
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }
    
    // Use a session ID (in production, use actual session management)
    const sessionId = request.headers.get('x-session-id') || 'default'
    
    const response = await generateResponse(sessionId, message, history, senderPhone)
    
    return NextResponse.json({ response })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
