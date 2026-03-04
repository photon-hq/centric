/**
 * Configuration Schemas
 * Zod validation schemas for all configuration files
 */

import { z } from 'zod'

// ============================================================================
// Product Schemas
// ============================================================================

const BaseProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  features: z.array(z.string()),
  keywords: z.array(z.string())
})

export const FixedPriceProductSchema = BaseProductSchema.extend({
  negotiable: z.literal(false)
})

export const NegotiableProductSchema = BaseProductSchema.extend({
  negotiable: z.literal(true),
  lowestNegotiationPrice: z.number().positive()
})

export const ProductSchema = z.discriminatedUnion('negotiable', [
  FixedPriceProductSchema,
  NegotiableProductSchema
])

export const ProductsConfigSchema = z.object({
  products: z.array(ProductSchema)
})

// ============================================================================
// Company Configuration Schemas
// ============================================================================

export const GreetingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  template: z.string(),
  showHumanEscalation: z.boolean().optional().default(true)
})

export const HumanHandoffConfigSchema = z.object({
  enabled: z.boolean(),
  keywords: z.array(z.string()),
  message: z.string()
})

export const CompanyConfigSchema = z.object({
  name: z.string().min(1),
  industry: z.string(),
  description: z.string(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  agentName: z.string().optional().default('Assistant'),
  features: z.array(z.string()),
  greeting: z.union([
    GreetingConfigSchema,
    z.string() // Legacy support for string greetings
  ]),
  humanHandoff: HumanHandoffConfigSchema.optional()
})

// ============================================================================
// Feature Flags Schemas
// ============================================================================

export const NegotiationFeatureSchema = z.object({
  enabled: z.boolean(),
  defaultDiscount: z.number().min(0).max(1),
  maxDiscount: z.number().min(0).max(1),
  requiresApproval: z.boolean().optional().default(false)
})

export const MCPFeatureSchema = z.object({
  enabled: z.boolean()
})

export const SOPFeatureSchema = z.object({
  enabled: z.boolean(),
  autoLoad: z.boolean(),
  source: z.string().optional()
})

export const KnowledgeBaseFeatureSchema = z.object({
  enabled: z.boolean(),
  documentsPath: z.string(),
  maxResults: z.number().int().positive(),
  similarityThreshold: z.number().min(0).max(1)
})

export const TimeConstraintsSchema = z.object({
  offerValidityHours: z.number().positive(),
  responseTimeMinutes: z.number().positive()
})

export const FeatureFlagsSchema = z.object({
  negotiation: NegotiationFeatureSchema,
  mcp: MCPFeatureSchema,
  sops: SOPFeatureSchema,
  knowledgeBase: KnowledgeBaseFeatureSchema,
  timeConstraints: TimeConstraintsSchema
})

// ============================================================================
// AI Configuration Schema
// ============================================================================

export const AIConfigSchema = z.object({
  provider: z.literal('openai'),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  embeddingModel: z.string(),
  embeddingDimensions: z.number().int().positive()
})

// ============================================================================
// Prompt Configuration Schema
// ============================================================================

export const PromptConfigSchema = z.object({
  systemPromptTemplate: z.string(),
  tone: z.enum(['casual', 'professional', 'friendly']),
  maxResponseLength: z.number().int().positive(),
  includeSOPs: z.boolean(),
  sopTemplate: z.string().optional()
})

// ============================================================================
// SOP Schema
// ============================================================================

export const SOPSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  trigger: z.string(),
  steps: z.array(z.string()),
  enabled: z.boolean()
})

export const SOPsConfigSchema = z.object({
  sops: z.array(SOPSchema)
})

// ============================================================================
// MCP Schemas
// ============================================================================

export const MCPServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  apiKey: z.string().optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  enabled: z.boolean()
})

export const MCPConfigSchema = z.object({
  enabled: z.boolean(),
  servers: z.array(MCPServerSchema),
  lastUpdated: z.string().nullable()
})
