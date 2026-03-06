/**
 * Core Types for Photon Customer Support
 * Shared type definitions across all packages
 */

// ============================================================================
// Product Types
// ============================================================================

export interface BaseProduct {
  id: string
  name: string
  description: string
  price: number
  features: string[]
  keywords: string[]
}

export interface FixedPriceProduct extends BaseProduct {
  negotiable: false
}

export interface NegotiableProduct extends BaseProduct {
  negotiable: true
  lowestNegotiationPrice: number
}

export type Product = FixedPriceProduct | NegotiableProduct

// ============================================================================
// Company Configuration Types
// ============================================================================

export interface CompanyIdentity {
  name: string
  industry: string
  description: string
  website?: string
  phone?: string
  email?: string
  agentName?: string // Name of the AI assistant (defaults to "Assistant")
}

export interface GreetingConfig {
  enabled: boolean
  template: string // Template string with {agentName}, {companyName} variables
  showHumanEscalation?: boolean
}

export interface HumanHandoffConfig {
  enabled: boolean
  keywords: string[]
  message: string
  slackEnabled?: boolean
  slackChannelId?: string
}

export interface CompanyConfig extends CompanyIdentity {
  features: string[]
  greeting: GreetingConfig
  humanHandoff?: HumanHandoffConfig
}

// ============================================================================
// Feature Flags Types
// ============================================================================

export interface NegotiationFeature {
  enabled: boolean
  defaultDiscount: number // e.g., 0.15 for 15%
  maxDiscount: number // e.g., 0.25 for 25%
  requiresApproval?: boolean
}

export interface MCPFeature {
  enabled: boolean
}

export interface SOPFeature {
  enabled: boolean
  autoLoad: boolean
  source?: string
}

export interface KnowledgeBaseFeature {
  enabled: boolean
  documentsPath: string
  maxResults: number
  similarityThreshold: number
}

export interface TimeConstraints {
  offerValidityHours: number
  responseTimeMinutes: number
}

export interface FeatureFlags {
  negotiation: NegotiationFeature
  mcp: MCPFeature
  sops: SOPFeature
  knowledgeBase: KnowledgeBaseFeature
  timeConstraints: TimeConstraints
}

// ============================================================================
// AI Configuration Types
// ============================================================================

export interface AIConfig {
  provider: 'openai'
  model: string
  temperature: number
  maxTokens: number
  embeddingModel: string
  embeddingDimensions: number
}

// ============================================================================
// Prompt Configuration Types
// ============================================================================

export interface PromptConfig {
  systemPromptTemplate: string
  tone: 'casual' | 'professional' | 'friendly'
  maxResponseLength: number
  includeSOPs: boolean
  sopTemplate?: string
}

// ============================================================================
// SOP Types
// ============================================================================

export interface SOP {
  id: string
  title: string
  objective: string
  trigger: string
  steps: string[]
  enabled: boolean
}

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPServer {
  id: string
  name: string
  url: string
  apiKey?: string
  type: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  enabled: boolean
}

export interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  lastUpdated: string | null
}

export interface MCPTool {
  name: string
  description: string
  parameters: Record<string, any>
  serverUrl: string
  serverApiKey?: string
}

// ============================================================================
// Vector Store Types
// ============================================================================

export interface Document {
  id: string
  content: string
  metadata: {
    filename: string
    type: string
    lastModified: Date
  }
}

export interface SearchResult {
  document: Document
  content: string
  similarity: number
}

export interface EmbeddedDocument extends Document {
  embedding: number[]
}

// ============================================================================
// Conversation State Types
// ============================================================================

export interface NegotiationState {
  productId: string
  currentOffer: number
  customerBudget?: number
  negotiationRound: number
}

export interface ConversationState {
  messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  currentNegotiation?: NegotiationState
  context?: string
  lastMessageTime?: Date
  firstMessageShown?: boolean
  humanHandoffRequested?: boolean
  humanHandoffActive?: boolean
  slackThreadTs?: string
  handoffCount?: number
  ticketClosed?: boolean
  ticketId?: string
}

// ============================================================================
// Configuration Loading Types
// ============================================================================

export interface ConfigPaths {
  company: string
  products: string
  prompts: string
  features: string
  ai: string
  sops?: string
  mcp?: string
}

export interface LoadedConfig {
  company: CompanyConfig
  products: Product[]
  prompts: PromptConfig
  features: FeatureFlags
  ai: AIConfig
  sops?: SOP[]
  mcp?: MCPConfig
}
