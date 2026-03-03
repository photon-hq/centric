/**
 * AI Customer Support Agent
 * 
 * A configurable AI-powered iMessage customer support agent
 * Features:
 * - Document-based knowledge retrieval (RAG)
 * - Product sales at fixed prices
 * - Price negotiation with configurable ranges
 * - Adaptable for any company/industry
 * - Human handoff capability (coming soon)
 */

import { IMessageSDK } from './imessage-kit/src/index.js'
import { DocumentVectorStore } from './lib/vector-store.js'
import { ProductCatalog, type Product, type NegotiableProduct } from './lib/product-catalog.js'
import { COMPANY_CONFIG } from './config/company.js'
import { generateSystemPrompt, generateContextPrompt, generateNegotiationResponse, generatePurchaseResponse, generateFixedPriceResponse, generateErrorResponse } from './config/prompts.js'
import OpenAI from 'openai'

// ============================================================================
// Configuration
// ============================================================================

interface AgentConfig {
    openaiApiKey: string
    model?: string
    temperature?: number
    max_completion_tokens?: number
    debug?: boolean
}

// Initialize OpenAI
const config: AgentConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-5-mini',
    temperature: 0.7,
    max_completion_tokens: 1000,
    debug: true
}

if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
}

const openai = new OpenAI({ apiKey: config.openaiApiKey })

// ============================================================================
// Initialize Components
// ============================================================================

const sdk = new IMessageSDK({ debug: config.debug })
const vectorStore = new DocumentVectorStore('./documents', openai)
const productCatalog = new ProductCatalog()

// Generate system prompt from company configuration
const SYSTEM_PROMPT = generateSystemPrompt(COMPANY_CONFIG)

// ============================================================================
// Conversation State Management
// ============================================================================

interface ConversationState {
    messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
    currentNegotiation?: {
        productId: string
        currentOffer: number
        customerBudget?: number
    }
    customerInfo?: {
        name?: string
        phoneNumber: string
    }
}

const conversations = new Map<string, ConversationState>()

function getConversation(phoneNumber: string): ConversationState {
    if (!conversations.has(phoneNumber)) {
        conversations.set(phoneNumber, {
            messageHistory: [],
            customerInfo: { phoneNumber }
        })
    }
    return conversations.get(phoneNumber)!
}

// ============================================================================
// Core Agent Logic
// ============================================================================

async function getRelevantContext(query: string): Promise<string> {
    const results = await vectorStore.search(query, 3)
    
    if (results.length === 0) {
        return "No specific documentation found for this query."
    }
    
    return results.map((r, i) => 
        `[Document ${i + 1}] ${r.content} (Relevance: ${(r.similarity * 100).toFixed(1)}%)`
    ).join('\n\n')
}

function detectProductInquiry(message: string): Product | null {
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
    // Initialize negotiation state
    if (!conversation.currentNegotiation) {
        conversation.currentNegotiation = {
            productId: product.id,
            currentOffer: product.price
        }
    }
    
    const negotiation = conversation.currentNegotiation
    
    // Check if price is negotiable
    if (!product.negotiable) {
        return generateFixedPriceResponse(product.name, product.price)
    }
    
    // Calculate offer based on negotiation
    const discountPercentage = 0.15 // Can offer up to 15% off initially
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
    phoneNumber: string,
    userMessage: string
): Promise<string> {
    const conversation = getConversation(phoneNumber)
    
    // Add user message to history
    conversation.messageHistory.push({
        role: 'user',
        content: userMessage
    })
    
    // Keep only last 10 messages to manage context
    if (conversation.messageHistory.length > 10) {
        conversation.messageHistory = conversation.messageHistory.slice(-10)
    }
    
    // Detect product inquiries
    const product = detectProductInquiry(userMessage)
    let productContext = ''
    
    if (product) {
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
            const purchaseResponse = generatePurchaseResponse(
                COMPANY_CONFIG,
                product.name,
                price
            )
            
            conversation.messageHistory.push({
                role: 'assistant',
                content: purchaseResponse
            })
            return purchaseResponse
        }
    }
    
    // Get relevant documents for context
    const documentContext = await getRelevantContext(userMessage)
    
    // Build enhanced context
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
        model: config.model!,
        messages,
        temperature: config.temperature,
        max_tokens: config.max_completion_tokens
    })
    
    const assistantMessage = completion.choices[0].message.content || 
        "I apologize, but I'm having trouble generating a response. Please try again."
    
    // Add assistant response to history
    conversation.messageHistory.push({
        role: 'assistant',
        content: assistantMessage
    })
    
    return assistantMessage
}

// ============================================================================
// iMessage Handler
// ============================================================================

async function handleIncomingMessage(message: any) {
    const sender = message.sender
    const text = message.text || ''
    
    console.log(`\n📱 Incoming message from ${sender}: "${text}"`)
    
    try {
        // Generate AI response
        const response = await generateResponse(sender, text)
        
        // Send response back
        await sdk.send(sender, response)
        
        console.log(`✅ Sent response to ${sender}`)
        console.log(`🤖 Response: "${response}"`)
        
    } catch (error) {
        console.error(`❌ Error processing message from ${sender}:`, error)
        
        // Send error message to user
        await sdk.send(
            sender,
            generateErrorResponse(COMPANY_CONFIG)
        )
    }
}

// ============================================================================
// Main Application
// ============================================================================

async function main() {
    console.log(`🚀 ${COMPANY_CONFIG.name} Customer Support Agent Starting...\n`)
    
    // Initialize vector store
    console.log('📚 Loading documents and creating vector embeddings...')
    await vectorStore.initialize()
    console.log(`✅ Loaded ${vectorStore.getDocumentCount()} documents\n`)
    
    // Show available products
    console.log('🛍️  Available Products:')
    productCatalog.getAllProducts().forEach(product => {
        const negotiable = 'negotiable' in product && product.negotiable
        console.log(`   - ${product.name}: $${product.price}${negotiable ? ' (negotiable)' : ''}`)
    })
    console.log()
    
    // Start watching for messages
    console.log('👀 Starting message watcher...')
    console.log('✨ Agent is ready! Waiting for customer messages...\n')
    
    await sdk.startWatching({
        onDirectMessage: handleIncomingMessage
    })
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down...')
        await sdk.stopWatching()
        await sdk.close()
        console.log('👋 Goodbye!')
        process.exit(0)
    })
}

// Start the agent
main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
