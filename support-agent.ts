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
import * as fs from 'fs/promises'
import * as path from 'path'

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
    model: process.env.MODEL || 'gpt-5-mini',
    temperature: parseFloat(process.env.TEMPERATURE || '1'),
    max_completion_tokens: parseInt(process.env.MAX_COMPLETION_TOKENS || '5000'),
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

async function loadMCPConfig(): Promise<void> {
    try {
        const configPath = path.join(process.cwd(), 'config', 'mcp-config.json')
        const configData = await fs.readFile(configPath, 'utf-8')
        const config: MCPConfig = JSON.parse(configData)
        
        mcpEnabled = config.enabled
        
        if (!mcpEnabled) {
            console.log('⚠️  MCP is disabled in config')
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
                    
                    const response = await fetch(toolsUrl, { headers })
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
            console.log(`✅ Loaded ${mcpTools.length} MCP tools:`)
            mcpTools.forEach(tool => console.log(`   - ${tool.name}: ${tool.description}`))
        } else {
            console.log('⚠️  No MCP tools available')
        }
    } catch (error) {
        console.warn('⚠️  Failed to load MCP config:', error)
        mcpEnabled = false
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
    
    const response = await fetch(callUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            tool: toolName,
            parameters
        })
    })
    
    if (!response.ok) {
        throw new Error(`MCP tool call failed: ${response.statusText}`)
    }
    
    return await response.json()
}

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
    firstMessageShown: boolean
    humanHandoffRequested: boolean
}

const conversations = new Map<string, ConversationState>()

function getConversation(phoneNumber: string): ConversationState {
    if (!conversations.has(phoneNumber)) {
        conversations.set(phoneNumber, {
            messageHistory: [],
            customerInfo: { phoneNumber },
            firstMessageShown: false,
            humanHandoffRequested: false
        })
    }
    return conversations.get(phoneNumber)!
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
    
    // Check if this is the first message
    const isFirstMessage = conversation.messageHistory.length === 0 && !conversation.firstMessageShown
    
    // Check for human handoff request
    if (detectHumanHandoff(userMessage)) {
        conversation.humanHandoffRequested = true
    }
    
    // Add user message to history
    conversation.messageHistory.push({
        role: 'user',
        content: userMessage
    })
    
    // Keep only last 10 messages to manage context
    if (conversation.messageHistory.length > 10) {
        conversation.messageHistory = conversation.messageHistory.slice(-10)
    }
    
    // If human handoff requested, provide appropriate response
    if (conversation.humanHandoffRequested) {
        const handoffMessage = "I understand you'd like to speak with a human. Human handoff functionality is being set up and will be available soon. In the meantime, I'm here to help with any questions you have!"
        
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
    
    // Generate AI response with MCP tool support
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: contextPrompt },
        ...conversation.messageHistory.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
        }))
    ]
    
    // Add MCP tools if enabled
    const completionOptions: OpenAI.Chat.ChatCompletionCreateParams = {
        model: config.model!,
        messages,
        temperature: config.temperature,
        max_completion_tokens: config.max_completion_tokens
    }
    
    if (mcpEnabled && mcpTools.length > 0) {
        completionOptions.tools = convertMCPToolsToOpenAIFormat()
        completionOptions.tool_choice = 'auto'
    }
    
    let assistantMessage = ''
    let maxIterations = 5 // Prevent infinite loops
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
                    const functionArgs = JSON.parse(toolCall.function.arguments)
                    
                    console.log(`🔧 Executing MCP tool: ${functionName}`, functionArgs)
                    
                    try {
                        const result = await executeMCPTool(functionName, functionArgs)
                        
                        // Add tool result to messages
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result)
                        })
                        
                        console.log(`✅ Tool result:`, result)
                    } catch (error) {
                        console.error(`❌ Tool execution error:`, error)
                        
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
            assistantMessage = choice.message.content || 
                "I apologize, but I'm having trouble generating a response. Please try again."
            break
        }
    }
    
    if (!assistantMessage) {
        assistantMessage = "I apologize, but I reached the maximum number of tool calls. Please try rephrasing your request."
    }
    
    // Add Centric greeting if first message
    let finalMessage = assistantMessage
    if (isFirstMessage) {
        finalMessage = `Hi! I'm Centric, an AI Assistant.\n${assistantMessage}\n\nIf you'd like to speak with a human, just say so and we'll connect you.`
        conversation.firstMessageShown = true
    }
    
    // Add assistant response to history
    conversation.messageHistory.push({
        role: 'assistant',
        content: finalMessage
    })
    
    return finalMessage
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
    
    // Load MCP tools
    console.log('🔌 Loading MCP tools...')
    await loadMCPConfig()
    console.log()
    
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
