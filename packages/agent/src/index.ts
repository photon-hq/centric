/**
 * Photon iMessage Customer Support Agent v2.0
 * Refactored to use modular core packages
 */

import { IMessageSDK, type Message } from '@photon-ai/imessage-kit'
import OpenAI from 'openai'
import {
  ConfigLoader,
  DocumentVectorStore,
  ProductCatalog,
  MCPManager,
  SlackNotifier,
  generateSystemPrompt,
  generateContextPrompt,
  generateGreeting,
  generateNegotiationResponse,
  generatePurchaseResponse,
  generateFixedPriceResponse,
  generateErrorResponse,
  logger,
  type LoadedConfig,
  type Product,
  type ConversationState,
  type NegotiationState
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

logger.info('Starting Photon Customer Support Agent v2.0')

// Module-level references set during main() initialization
let sdk: IMessageSDK
let slackNotifier: SlackNotifier | null = null
let mcpManager: MCPManager

// ============================================================================
// Utilities
// ============================================================================

function sanitizeEmDashes(text: string): string {
  if (!text) return text
  return text.replace(/\s*[\u2014\u2013]\s*/g, ', ')
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
  debounceTimer: ReturnType<typeof setTimeout> | null
  isProcessing: boolean
}

const senderQueues = new Map<string, SenderQueue>()

function getSenderQueue(sender: string): SenderQueue {
  if (!senderQueues.has(sender)) {
    senderQueues.set(sender, { pending: [], debounceTimer: null, isProcessing: false })
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

function detectProductInquiry(message: string, products: Product[]): Product | null {
  for (const product of products) {
    const keywords = [product.name.toLowerCase(), product.id, ...product.keywords]
    if (keywords.some((keyword) => message.toLowerCase().includes(keyword))) {
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

async function getRelevantContext(query: string, vectorStore: DocumentVectorStore): Promise<string> {
  const maxResults = config.features.knowledgeBase.maxResults
  const results = await vectorStore.search(query, maxResults, config.features.knowledgeBase.similarityThreshold)

  if (results.length === 0) {
    return 'No specific documentation found for this query.'
  }

  return results
    .map((r, i) => `[Document ${i + 1}] ${r.content} (Relevance: ${(r.similarity * 100).toFixed(1)}%)`)
    .join('\n\n')
}

async function handleNegotiation(
  conversation: ConversationState,
  product: Product,
  userMessage: string
): Promise<string> {
  if (!product.negotiable) {
    return generateFixedPriceResponse(product.name, product.price)
  }

  const discountPercent = config.features.negotiation.defaultDiscount
  const offeredPrice = Math.round(product.price * (1 - discountPercent))

  // Check if offered price is acceptable
  if (offeredPrice < product.lowestNegotiationPrice) {
    return generateFixedPriceResponse(product.name, product.price)
  }

  // Track negotiation state
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

async function generateResponse(sender: string, message: string, vectorStore: DocumentVectorStore, productCatalog: ProductCatalog): Promise<string> {
  const conversation = getConversation(sender)

  try {
    // Check for human handoff
    if (config.company.humanHandoff?.enabled) {
      if (detectHumanHandoff(message, config.company.humanHandoff.keywords)) {
        conversation.humanHandoffRequested = true

        // Slack integration: post handoff notification
        if (slackNotifier) {
          const summary = await generateHandoffSummary(conversation)
          const threadTs = await slackNotifier.postHandoff(sender, conversation, summary)
          if (threadTs) {
            conversation.slackThreadTs = threadTs
            conversation.humanHandoffActive = true
            conversation.handoffCount = (conversation.handoffCount ?? 0) + 1
            logger.info({ sender, threadTs }, 'Human handoff posted to Slack')
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
      return await handleNegotiation(conversation, product, message)
    }

    // Get relevant context from vector store
    const documentContext = await getRelevantContext(message, vectorStore)
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + '\n\n' + contextPrompt },
      ...conversation.messageHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    ]

    const openAITools = mcpManager.getTools().length > 0 ? mcpManager.convertToOpenAIFormat() : undefined

    const completionOptions: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: config.ai.model,
      messages,
      temperature: config.ai.temperature,
      max_completion_tokens: config.ai.maxTokens,
      ...(openAITools ? { tools: openAITools, tool_choice: 'auto' as const } : {})
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
        completionOptions.messages = messages
      } else {
        assistantMessage = sanitizeEmDashes(choice.message.content || 'I apologize, but I encountered an error.')
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

  logger.info({ company: config.company.name, agentName: config.company.agentName }, 'Configuration loaded')

  // Initialize components
  sdk = new IMessageSDK({ debug: process.env.DEBUG === 'true' })
  const vectorStore = new DocumentVectorStore(
    config.features.knowledgeBase.documentsPath,
    openai,
    config.ai.embeddingModel
  )
  const productCatalog = new ProductCatalog(config.products)
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
          logger.info({ sender }, 'Forwarded Slack reply to customer')
        } catch (error) {
          logger.error({ error, sender }, 'Failed to forward Slack reply to customer')
        }
      },
      onResolve: async (sender) => {
        const conversation = getConversation(sender)
        conversation.humanHandoffActive = false
        conversation.slackThreadTs = undefined
        conversation.currentNegotiation = undefined
        logger.info({ sender }, 'Human handoff resolved, AI re-enabled')
        try {
          await sdk.send(sender, "You're back with the AI assistant. How can I help?")
        } catch (error) {
          logger.error({ error, sender }, 'Failed to send resolve message to customer')
        }
      }
    })

    await slackNotifier.start()
    logger.info({ channelId }, 'Slack notifier started')
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
    const combinedText = messages.join('\n')

    logger.info({ sender, messageCount: messages.length }, 'Processing queued messages')

    const conversation = getConversation(sender)

    // If human handoff is active, relay to Slack instead
    if (conversation.humanHandoffActive && conversation.slackThreadTs && slackNotifier) {
      try {
        await slackNotifier.postCustomerMessage(conversation.slackThreadTs, combinedText)
        logger.info({ sender }, 'Relayed customer message to Slack thread')
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

    const isFirstMessage = conversation.messageHistory.length === 0

    try {
      const response = await generateResponse(sender, combinedText, vectorStore, productCatalog)

      let finalMessage = response
      if (isFirstMessage) {
        const greeting = generateGreeting(config.company, true)
        if (greeting) {
          finalMessage = `${greeting}\n\n${response}`
        }
      }

      await sdk.send(sender, sanitizeEmDashes(finalMessage))
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

      // Reset debounce ,  wait for the user to finish typing before processing
      if (queue.debounceTimer) clearTimeout(queue.debounceTimer)
      queue.debounceTimer = setTimeout(() => processSenderQueue(sender), DEBOUNCE_MS)
    }
  })

  logger.info('Agent is now watching for messages...')
}

// Start the agent
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error starting agent')
  process.exit(1)
})
