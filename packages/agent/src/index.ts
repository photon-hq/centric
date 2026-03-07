/**
 * Photon iMessage Customer Support Agent v2.0
 * Refactored to use modular core packages
 */

import { IMessageSDK, type Message, type Attachment } from '@photon-ai/imessage-kit'
import OpenAI from 'openai'
import {
  ConfigLoader,
  DocumentVectorStore,
  ProductCatalog,
  MCPManager,
  SlackNotifier,
  generateSystemPrompt,
  generateContextPrompt,
  generateNegotiationResponse,
  generatePurchaseResponse,
  generateFixedPriceResponse,
  generateErrorResponse,
  sanitizeEmDashes,
  buildSearchQueries,
  isCatalogQuery,
  isVagueFollowUp,
  logger,
  type LoadedConfig,
  type Product,
  type ConversationState
} from '@photon/core'

// ============================================================================
// Initialize
// ============================================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

if (!process.env.OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY environment variable is required')
  process.exit(1)
}

// Load all configuration
const configLoader = new ConfigLoader()
let config: LoadedConfig
let configLoadedAt = 0
const CONFIG_RELOAD_MS = 60_000

logger.info('Starting Photon Customer Support Agent v2.0')

// Module-level references set during main() initialization
let sdk: IMessageSDK
let slackNotifier: SlackNotifier | null = null
let mcpManager: MCPManager
let agentProductCatalog: ProductCatalog

async function reloadConfigIfStale(): Promise<void> {
  if (Date.now() - configLoadedAt < CONFIG_RELOAD_MS) return
  try {
    config = await configLoader.loadAll()
    agentProductCatalog = new ProductCatalog(config.products)
    configLoadedAt = Date.now()
    logger.info('Configuration reloaded')
  } catch (err) {
    logger.warn({ err }, 'Failed to reload config, continuing with existing config')
  }
}

let loadedKbVersion = ''

async function checkKbVersion(vectorStore: DocumentVectorStore): Promise<void> {
  try {
    const { promises: fs } = await import('fs')
    const raw = await fs.readFile('config/kb-version.json', 'utf-8')
    const { version } = JSON.parse(raw) as { version: string }
    if (version && version !== loadedKbVersion) {
      logger.info({ version }, 'Knowledge base updated, reinitializing vector store')
      await vectorStore.initialize()
      loadedKbVersion = version
    }
  } catch {
    // version file missing or unreadable ,  skip
  }
}

// ============================================================================
// Conversation State Management
// ============================================================================

const conversations = new Map<string, ConversationState>()

// ============================================================================
// Per-Sender Message Queue (handles double/triple texting)
// ============================================================================

const DEBOUNCE_MS = 1500

interface SenderQueue {
  pending: string[]
  pendingAttachments: Attachment[]
  debounceTimer: ReturnType<typeof setTimeout> | null
  isProcessing: boolean
}

const senderQueues = new Map<string, SenderQueue>()

function getSenderQueue(sender: string): SenderQueue {
  if (!senderQueues.has(sender)) {
    senderQueues.set(sender, { pending: [], pendingAttachments: [], debounceTimer: null, isProcessing: false })
  }
  return senderQueues.get(sender)!
}

function getConversation(phoneNumber: string): ConversationState {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, {
      messageHistory: [],
      firstMessageShown: false,
      humanHandoffRequested: false,
      humanHandoffActive: false,
      handoffCount: 0
    })
  }
  return conversations.get(phoneNumber)!
}

function detectHumanHandoff(message: string, keywords: string[]): boolean {
  return keywords.some((phrase) => message.toLowerCase().includes(phrase.toLowerCase()))
}

function detectRestartIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return ['new', 'fresh', 'start over', 'restart', 'different', 'reset', 'no'].some((k) =>
    lower.includes(k)
  )
}

function detectProductInquiry(message: string, products: Product[]): Product | null {
  const msg = message.toLowerCase()

  // Pass 1: match by full product name first (most specific ,  prevents "support" in
  // "Premium Support Package" keywords from matching "Standard Support Package")
  for (const product of products) {
    const escaped = product.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(msg)) return product
  }

  // Pass 2: match by individual keywords (id + keyword list, not the name again)
  for (const product of products) {
    const keywords = [product.id, ...product.keywords]
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const wordBoundary = new RegExp(`\\b${escaped}\\b`, 'i')
      if (!wordBoundary.test(msg)) continue

      const negationPattern = new RegExp(
        `\\b(no|not|don'?t|never|without|except|instead of|cancel|stop|avoid|skip|remove)\\b.{0,40}\\b${escaped}\\b`,
        'i'
      )
      if (negationPattern.test(msg)) continue

      return product
    }
  }
  return null
}

function detectPriceNegotiation(message: string): boolean {
  const negotiationPhrases = [
    'too expensive',
    'too much',
    'discount',
    'cheaper',
    'lower price',
    'budget',
    'afford',
    'better price',
    'deal',
    'negotiate',
    'can you do better',
    'is that the best',
    'reduce the price'
  ]
  return negotiationPhrases.some((phrase) => message.toLowerCase().includes(phrase))
}

function detectPurchaseIntent(message: string): boolean {
  const purchaseKeywords = [
    'buy',
    'purchase',
    'get it',
    'sign up',
    'enroll',
    'yes please',
    "i'll take it",
    'sounds good',
    "let's do it",
    'proceed'
  ]
  return purchaseKeywords.some((keyword) => message.toLowerCase().includes(keyword))
}

// ============================================================================
// Core Agent Logic
// ============================================================================

async function getRelevantContext(
  query: string,
  vectorStore: DocumentVectorStore,
  recentTopics: string[] = []
): Promise<string> {
  const maxResults = config.features.knowledgeBase.maxResults
  const threshold = config.features.knowledgeBase.similarityThreshold

  // For vague follow-ups ("what about pricing?"), prepend recent topics so the
  // search has enough signal to find the right documents.
  const effectiveQuery =
    isVagueFollowUp(query) && recentTopics.length > 0
      ? `${recentTopics.join(' ')} ${query}`
      : query

  let results

  if (isCatalogQuery(effectiveQuery)) {
    // Widen search: more results, lower threshold ,  user wants a broad overview
    results = await vectorStore.search(effectiveQuery, Math.max(maxResults * 3, 20), Math.min(threshold, 0.2))
  } else {
    const queries = buildSearchQueries(effectiveQuery)
    results =
      queries.length > 1
        ? await vectorStore.searchMulti(queries, maxResults, threshold)
        : await vectorStore.search(effectiveQuery, maxResults, threshold)
  }

  if (results.length === 0) {
    return 'No specific documentation found for this query.'
  }

  return results
    .slice(0, isCatalogQuery(effectiveQuery) ? Math.max(maxResults * 3, 20) : maxResults)
    .map((r, i) => `[Document ${i + 1}] ${r.content} (Relevance: ${(r.similarity * 100).toFixed(1)}%)`)
    .join('\n\n')
}

async function handleNegotiation(
  conversation: ConversationState,
  product: Product
): Promise<string> {
  if (!product.negotiable) {
    return generateFixedPriceResponse(product.name, product.price)
  }

  const existing = conversation.currentNegotiation
  const isCounterOffer = existing?.productId === product.id

  if (isCounterOffer && existing) {
    existing.negotiationRound = (existing.negotiationRound ?? 1) + 1

    // Round 2: offer the floor price if it's better than the current offer
    if (existing.negotiationRound === 2 && existing.currentOffer > product.lowestNegotiationPrice) {
      existing.currentOffer = product.lowestNegotiationPrice
      const floorDiscount = Math.round(((product.price - product.lowestNegotiationPrice) / product.price) * 100)
      return generateNegotiationResponse(
        product.name,
        product.price,
        product.lowestNegotiationPrice,
        product.features,
        floorDiscount,
        config.features.timeConstraints.offerValidityHours
      )
    }

    // Round 3+: hold firm ,  this is our absolute best price
    return generateFixedPriceResponse(product.name, existing.currentOffer)
  }

  // First negotiation attempt
  const discountPercent = config.features.negotiation.defaultDiscount
  const offeredPrice = Math.round(product.price * (1 - discountPercent))

  if (offeredPrice < product.lowestNegotiationPrice) {
    return generateFixedPriceResponse(product.name, product.price)
  }

  conversation.currentNegotiation = {
    productId: product.id,
    currentOffer: offeredPrice,
    negotiationRound: 1
  }

  return generateNegotiationResponse(
    product.name,
    product.price,
    offeredPrice,
    product.features,
    Math.round(discountPercent * 100),
    config.features.timeConstraints.offerValidityHours
  )
}

async function generateHandoffSummary(conversation: ConversationState): Promise<string> {
  try {
    const historyText = conversation.messageHistory
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: config.ai.model,
      messages: [
        {
          role: 'system',
          content: "Summarize the customer's issue in 2-3 sentences for a support agent who needs to take over the conversation."
        },
        {
          role: 'user',
          content: `Conversation:\n${historyText}`
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 150
    })

    return completion.choices[0]?.message?.content || 'Customer requested human support.'
  } catch {
    return 'Customer requested human support.'
  }
}

async function generateResponse(sender: string, message: string, vectorStore: DocumentVectorStore, productCatalog: ProductCatalog, images: Attachment[] = []): Promise<string> {
  const conversation = getConversation(sender)

  // Store phone number for Slack handoff display
  if (!conversation.senderPhone) {
    conversation.senderPhone = sender
  }

  try {
    // Check for human handoff
    if (config.company.humanHandoff?.enabled) {
      if (detectHumanHandoff(message, config.company.humanHandoff.keywords)) {
        conversation.humanHandoffRequested = true
        conversation.humanHandoffActive = true
        conversation.handoffCount = (conversation.handoffCount ?? 0) + 1

        // Slack integration: post handoff notification
        if (slackNotifier) {
          try {
            const summary = await generateHandoffSummary(conversation)
            const threadTs = await slackNotifier.postHandoff(sender, conversation, summary, config.company.humanHandoff?.slackPingType ?? 'none')
            if (threadTs) {
              conversation.slackThreadTs = threadTs
              logger.info({ sender, threadTs }, 'Human handoff posted to Slack')
            }
          } catch (err: any) {
            logger.error({ error: err?.data?.error || err?.message }, 'Failed to post handoff to Slack')
          }
        }

        return sanitizeEmDashes(config.company.humanHandoff.message)
      }
    }

    // Check for purchase intent
    if (detectPurchaseIntent(message) && conversation.currentNegotiation) {
      const product = productCatalog.getProduct(conversation.currentNegotiation.productId)
      if (product) {
        const price = conversation.currentNegotiation.currentOffer || product.price
        return generatePurchaseResponse(
          config.company,
          product.name,
          price,
          config.features.timeConstraints.responseTimeMinutes
        )
      }
    }

    // Check for product inquiry and price negotiation
    const product = detectProductInquiry(message, productCatalog.getAllProducts())
    if (product && detectPriceNegotiation(message) && config.features.negotiation.enabled) {
      return await handleNegotiation(conversation, product)
    }

    // Extract product/topic names mentioned in the last assistant message for follow-up query enrichment
    const lastAssistantMsg = [...conversation.messageHistory].reverse().find((m) => m.role === 'assistant')?.content ?? ''
    const recentTopics = productCatalog
      .getAllProducts()
      .map((p) => p.name)
      .filter((name) => lastAssistantMsg.toLowerCase().includes(name.toLowerCase()))

    // Get relevant context from vector store
    const documentContext = await getRelevantContext(message, vectorStore, recentTopics)
    const productContext = product
      ? `Product: ${product.name}\nPrice: $${product.price}\n${product.description}\n\nFeatures:\n${product.features.map((f) => `- ${f}`).join('\n')}`
      : ''

    // Build conversation history
    conversation.messageHistory.push({ role: 'user', content: message })

    // Trim history to last 10 messages
    if (conversation.messageHistory.length > 10) {
      conversation.messageHistory = conversation.messageHistory.slice(-10)
    }

    // Generate AI response
    const systemPrompt = generateSystemPrompt(config.company, config.sops || [], config.features, sender, mcpManager.getTools().length > 0)
    const contextPrompt = generateContextPrompt(documentContext, productContext)

    // Build image content for the current user turn if attachments present
    let userContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = message
    if (images.length > 0) {
      const { promises: fs } = await import('fs')
      const imageParts: OpenAI.Chat.ChatCompletionContentPart[] = []
      for (const img of images) {
        try {
          const buf = await fs.readFile(img.path)
          imageParts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${buf.toString('base64')}` } })
        } catch (err) {
          logger.warn({ err, path: img.path }, 'Failed to read attachment, skipping')
        }
      }
      if (imageParts.length > 0) {
        userContent = [{ type: 'text', text: message }, ...imageParts]
      }
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + '\n\n' + contextPrompt },
      ...conversation.messageHistory.slice(0, -1).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userContent }
    ]

    const kbSearchTool: OpenAI.Chat.ChatCompletionTool = {
      type: 'function',
      function: {
        name: 'search_knowledge_base',
        description: 'Search the company knowledge base for product documentation, features, pricing, and support content. Use this when you need more detail than what is already in context.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' }
          },
          required: ['query']
        }
      }
    }

    const allTools: OpenAI.Chat.ChatCompletionTool[] = [kbSearchTool, ...mcpManager.convertToOpenAIFormat()]

    const completionOptions: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: config.ai.model,
      messages,
      temperature: config.ai.temperature,
      max_completion_tokens: config.ai.maxTokens,
      tools: allTools,
      tool_choice: 'auto' as const
    }

    let assistantMessage = ''
    const maxIterations = 5
    let iteration = 0

    while (iteration < maxIterations) {
      iteration++
      const completion = await openai.chat.completions.create(completionOptions)
      const choice = completion.choices[0]

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type === 'function') {
            const functionName = toolCall.function.name
            let functionArgs: Record<string, any>
            try {
              functionArgs = JSON.parse(toolCall.function.arguments)
            } catch {
              functionArgs = {}
            }
            if (functionName === 'search_knowledge_base') {
              logger.info({ query: functionArgs.query }, 'Executing KB search')
              const searchResult = await getRelevantContext(functionArgs.query ?? '', vectorStore)
              messages.push({ role: 'tool', tool_call_id: toolCall.id, content: searchResult })
            } else {
              logger.info({ toolName: functionName, args: functionArgs }, 'Executing MCP tool')
              try {
                const result = await mcpManager.executeTool(functionName, functionArgs)
                messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
              } catch (error) {
                logger.error({ error, toolName: functionName }, 'MCP tool execution failed')
                messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ success: false, error: String(error) }) })
              }
            }
          }
        }
        completionOptions.messages = messages
      } else {
        const content = (choice.message.content ?? '').trim()
        assistantMessage = sanitizeEmDashes(content || generateErrorResponse(config.company))
        break
      }
    }

    if (!assistantMessage) {
      assistantMessage = 'I apologize, but I reached the maximum number of tool calls. Please try rephrasing your request.'
    }

    conversation.messageHistory.push({ role: 'assistant', content: assistantMessage })

    return assistantMessage
  } catch (error) {
    logger.error({ error, sender }, 'Error generating response')
    return sanitizeEmDashes(generateErrorResponse(config.company))
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Load configuration
  config = await configLoader.loadAll()
  configLoadedAt = Date.now()

  logger.info({ company: config.company.name, agentName: config.company.agentName }, 'Configuration loaded')

  // Initialize components
  sdk = new IMessageSDK({ debug: process.env.DEBUG === 'true' })
  const vectorStore = new DocumentVectorStore(
    config.features.knowledgeBase.documentsPath,
    openai,
    config.ai.embeddingModel
  )
  agentProductCatalog = new ProductCatalog(config.products)
  mcpManager = new MCPManager()

  // Initialize vector store
  if (config.features.knowledgeBase.enabled) {
    await vectorStore.initialize()
  }

  // Initialize MCP if enabled
  if (config.features.mcp.enabled && config.mcp) {
    await mcpManager.loadConfig(config.mcp)
  }

  // Initialize Slack notifier if enabled
  const handoffConfig = config.company.humanHandoff
  const botToken = process.env.SLACK_BOT_TOKEN
  const appToken = process.env.SLACK_APP_TOKEN
  const channelId = process.env.SLACK_CHANNEL_ID || handoffConfig?.slackChannelId || ''

  if (handoffConfig?.slackEnabled && botToken && appToken && channelId) {
    slackNotifier = new SlackNotifier(botToken, appToken, channelId, {
      onMessageForCustomer: async (sender, text) => {
        try {
          await sdk.send(sender, text)
          getConversation(sender).lastHumanReplyAt = Date.now()
          logger.info({ sender }, 'Forwarded Slack reply to customer')
        } catch (error) {
          logger.error({ error, sender }, 'Failed to forward Slack reply to customer')
        }
      },
      onResolve: async (sender) => {
        const prev = getConversation(sender)
        conversations.set(sender, {
          messageHistory: [],
          firstMessageShown: true,
          humanHandoffRequested: false,
          humanHandoffActive: false,
          handoffCount: prev.handoffCount,
          senderPhone: prev.senderPhone,
          lastMessageTime: new Date()
        })
        logger.info({ sender }, 'Human handoff resolved, conversation reset, AI re-enabled')
        try {
          await sdk.send(sender, "You're back with the AI assistant. How can I help?")
        } catch (error) {
          logger.error({ error, sender }, 'Failed to send resolve message to customer')
        }
      }
    })

    try {
      await slackNotifier.start()
      logger.info({ channelId }, 'Slack notifier started')
    } catch (error: any) {
      const isTokenError = error?.code === 'slack_webapi_platform_error' || String(error?.message).includes('token')
      logger.error(
        { error: error?.message, code: error?.data?.error },
        isTokenError
          ? 'Slack token is invalid or expired ,  human handoff via Slack is disabled. Update SLACK_BOT_TOKEN/SLACK_APP_TOKEN and restart.'
          : 'Failed to start Slack notifier ,  human handoff via Slack is disabled. Agent will continue without it.'
      )
      slackNotifier = null
    }
  } else if (handoffConfig?.slackEnabled) {
    logger.warn('Slack handoff is enabled in config but SLACK_BOT_TOKEN, SLACK_APP_TOKEN, or channel ID is missing')
  }

  logger.info('Agent initialized successfully')

  // Process all pending messages for a sender as one combined turn
  async function processSenderQueue(sender: string): Promise<void> {
    const queue = getSenderQueue(sender)

    // If already processing, the finally block below will re-trigger after it finishes
    if (queue.isProcessing || queue.pending.length === 0) return

    queue.isProcessing = true
    const messages = queue.pending.splice(0) // drain atomically
    const imageAttachments = queue.pendingAttachments.splice(0)
    const combinedText = messages.join('\n')

    logger.info({ sender, messageCount: messages.length }, 'Processing queued messages')

    const conversation = getConversation(sender)

    // Update last message time (read old value first for inactivity check below)
    const timeSinceLast = conversation.lastMessageTime
      ? Date.now() - conversation.lastMessageTime.getTime()
      : 0
    conversation.lastMessageTime = new Date()

    // If human handoff is active, relay to Slack instead of processing with AI
    if (conversation.humanHandoffActive) {
      try {
        if (slackNotifier && conversation.slackThreadTs) {
          await slackNotifier.postCustomerMessage(conversation.slackThreadTs, combinedText)
          logger.info({ sender }, 'Relayed customer message to Slack thread')
        }
        // Only send hold message if the human agent hasn't replied recently (within 10 min)
        const recentReply = conversation.lastHumanReplyAt && (Date.now() - conversation.lastHumanReplyAt) < 10 * 60 * 1000
        if (!recentReply) {
          await sdk.send(sender, "Your message has been sent to our support team. They'll reply here shortly.")
        }
      } catch (error) {
        logger.error({ error, sender }, 'Failed to relay message to Slack')
      } finally {
        queue.isProcessing = false
        if (queue.pending.length > 0) {
          queue.debounceTimer = setTimeout(() => processSenderQueue(sender), DEBOUNCE_MS)
        }
      }
      return
    }

    // Inactivity detection ,  only runs when NOT in a human handoff
    const inactivityMs = (config.features?.session?.inactivityHours ?? 24) * 3600_000
    const sessionTtlMs = (config.features?.session?.sessionTtlDays ?? 7) * 86_400_000
    const hasHistory = conversation.messageHistory.length > 0

    if (conversation.awaitingResumeDecision) {
      if (detectRestartIntent(combinedText)) {
        conversations.set(sender, { messageHistory: [], firstMessageShown: false, humanHandoffRequested: false, humanHandoffActive: false, handoffCount: 0, lastMessageTime: new Date() })
        queue.isProcessing = false
        await sdk.send(sender, "Starting fresh! How can I help you today?")
        return
      } else {
        conversation.awaitingResumeDecision = false
        queue.isProcessing = false
        await sdk.send(sender, "Continuing your last conversation! What can I help you with?")
        return
      }
    }

    if (hasHistory && timeSinceLast > inactivityMs && timeSinceLast < sessionTtlMs) {
      conversation.awaitingResumeDecision = true
      queue.isProcessing = false
      await sdk.send(sender, "Welcome back! It's been a while since we last spoke. Would you like to continue our previous conversation, or start a new one? (Reply 'continue' or 'new')")
      return
    }

    if (hasHistory && timeSinceLast >= sessionTtlMs) {
      conversations.set(sender, { messageHistory: [], firstMessageShown: false, humanHandoffRequested: false, humanHandoffActive: false, handoffCount: 0, lastMessageTime: new Date() })
    }

    const isFirstMessage = conversation.messageHistory.length === 0

    try {
      await reloadConfigIfStale()
      await checkKbVersion(vectorStore)
      const response = await generateResponse(sender, combinedText, vectorStore, agentProductCatalog, imageAttachments)

      if (isFirstMessage) {
        conversation.firstMessageShown = true
      }

      await sdk.send(sender, response)
      logger.info({ sender }, 'Response sent successfully')
    } catch (error) {
      logger.error({ error, sender }, 'Error processing message')
      await sdk.send(sender, sanitizeEmDashes(generateErrorResponse(config.company)))
    } finally {
      queue.isProcessing = false
      // If more messages arrived while we were processing, handle them now
      if (queue.pending.length > 0) {
        queue.debounceTimer = setTimeout(() => processSenderQueue(sender), DEBOUNCE_MS)
      }
    }
  }

  // Watch for messages
  await sdk.startWatching({
    onDirectMessage: async (msg: Message) => {
      if (msg.isFromMe) return

      const sender = msg.sender || msg.chatId
      const text = msg.text || ''
      if (!text.trim()) return

      logger.info({ sender }, 'Incoming message')

      const queue = getSenderQueue(sender)
      queue.pending.push(text)
      const imgAttachments = msg.attachments.filter((a) => a.isImage)
      if (imgAttachments.length > 0) queue.pendingAttachments.push(...imgAttachments)

      // Reset debounce ,  wait for the user to finish typing before processing
      if (queue.debounceTimer) clearTimeout(queue.debounceTimer)
      queue.debounceTimer = setTimeout(() => processSenderQueue(sender), DEBOUNCE_MS)
    }
  })

  logger.info('Agent is now watching for messages...')

  // Periodic cleanup: remove sessions idle beyond sessionTtlDays to prevent unbounded memory growth
  setInterval(() => {
    const ttlMs = (config.features?.session?.sessionTtlDays ?? 7) * 86_400_000
    const cutoff = Date.now() - ttlMs
    let removed = 0
    for (const [phone, conv] of conversations) {
      if ((conv.lastMessageTime?.getTime() ?? 0) < cutoff) {
        conversations.delete(phone)
        senderQueues.delete(phone)
        removed++
      }
    }
    if (removed > 0) logger.info({ removed }, 'Cleaned up idle sessions')
  }, 60 * 60 * 1000) // run hourly
}

// Start the agent
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error starting agent')
  process.exit(1)
})
