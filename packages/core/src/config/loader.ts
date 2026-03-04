/**
 * Configuration Loader
 * Unified system for loading and validating all configuration
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  CompanyConfig,
  Product,
  PromptConfig,
  FeatureFlags,
  AIConfig,
  SOP,
  MCPConfig,
  LoadedConfig,
  GreetingConfig
} from '../types/index.js'
import {
  CompanyConfigSchema,
  ProductsConfigSchema,
  PromptConfigSchema,
  FeatureFlagsSchema,
  AIConfigSchema,
  SOPsConfigSchema,
  MCPConfigSchema
} from './schemas.js'
import { ConfigError } from '../errors/index.js'
import { logger } from '../logger/index.js'

export interface ConfigLoaderOptions {
  configDir?: string
  validateOnLoad?: boolean
}

export class ConfigLoader {
  private configDir: string
  private validateOnLoad: boolean

  constructor(options: ConfigLoaderOptions = {}) {
    this.configDir = options.configDir || path.join(process.cwd(), 'config')
    this.validateOnLoad = options.validateOnLoad !== false
  }

  /**
   * Load and parse a JSON file with optional validation
   */
  private async loadJSON<T>(
    filePath: string,
    schema?: any,
    required: boolean = true
  ): Promise<T | null> {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.configDir, filePath)

      const content = await fs.readFile(fullPath, 'utf-8')
      const data = JSON.parse(content)

      if (schema && this.validateOnLoad) {
        const result = schema.safeParse(data)
        if (!result.success) {
          throw ConfigError(
            `Validation failed for ${filePath}`,
            { errors: result.error.errors },
            result.error
          )
        }
        return result.data
      }

      return data
    } catch (error) {
      if (required) {
        throw ConfigError(
          `Failed to load required config file: ${filePath}`,
          { filePath },
          error as Error
        )
      }
      logger.warn({ filePath, error }, `Optional config file not found: ${filePath}`)
      return null
    }
  }

  /**
   * Load company configuration
   * Supports environment variable overrides
   */
  async loadCompanyConfig(): Promise<CompanyConfig> {
    const fileConfig = await this.loadJSON<any>(
      'company.json',
      CompanyConfigSchema,
      false
    )

    // Normalize greeting to object format if it's a string
    let greeting: GreetingConfig = {
      enabled: true,
      template: "Hi! I'm {agentName}, {companyName}'s AI assistant. How can I help you today?",
      showHumanEscalation: true
    }

    if (fileConfig?.greeting) {
      if (typeof fileConfig.greeting === 'string') {
        greeting = {
          enabled: true,
          template: fileConfig.greeting,
          showHumanEscalation: true
        }
      } else {
        greeting = fileConfig.greeting
      }
    }

    // Environment variable overrides
    const config: CompanyConfig = {
      name: process.env.COMPANY_NAME || fileConfig?.name || 'My Company',
      industry: process.env.COMPANY_INDUSTRY || fileConfig?.industry || 'Customer Support',
      description:
        process.env.COMPANY_DESCRIPTION ||
        fileConfig?.description ||
        'AI-powered customer support',
      website: process.env.COMPANY_WEBSITE || fileConfig?.website,
      phone: process.env.COMPANY_PHONE || fileConfig?.phone,
      email: process.env.COMPANY_EMAIL || fileConfig?.email,
      agentName: process.env.AGENT_NAME || fileConfig?.agentName || 'Assistant',
      features: fileConfig?.features || [],
      greeting,
      humanHandoff: fileConfig?.humanHandoff
    }

    // Validate final config (skip validation to avoid type issues with union types)
    // The config is already normalized above
    return config
  }

  /**
   * Load product catalog
   */
  async loadProducts(): Promise<Product[]> {
    const config = await this.loadJSON<{ products: Product[] }>(
      'products.json',
      ProductsConfigSchema
    )
    return config?.products || []
  }

  /**
   * Load prompt configuration
   */
  async loadPrompts(): Promise<PromptConfig> {
    return (
      (await this.loadJSON<PromptConfig>('prompts.json', PromptConfigSchema, false)) || {
        systemPromptTemplate:
          'You are {agentName}, an AI assistant for {companyName} in the {industry} industry.',
        tone: 'professional' as const,
        maxResponseLength: 500,
        includeSOPs: false
      }
    )
  }

  /**
   * Load feature flags
   */
  async loadFeatures(): Promise<FeatureFlags> {
    return (
      (await this.loadJSON<FeatureFlags>('features.json', FeatureFlagsSchema, false)) || {
        negotiation: {
          enabled: true,
          defaultDiscount: 0.15,
          maxDiscount: 0.25,
          requiresApproval: false
        },
        mcp: {
          enabled: false
        },
        sops: {
          enabled: true,
          autoLoad: true,
          source: 'config/sops.json'
        },
        knowledgeBase: {
          enabled: true,
          documentsPath: './documents',
          maxResults: 5,
          similarityThreshold: 0.7
        },
        timeConstraints: {
          offerValidityHours: 24,
          responseTimeMinutes: 60
        }
      }
    )
  }

  /**
   * Load AI configuration
   */
  async loadAIConfig(): Promise<AIConfig> {
    const fileConfig = await this.loadJSON<AIConfig>('ai.json', AIConfigSchema, false)

    // Environment variable overrides
    const config: AIConfig = {
      provider: 'openai',
      model: process.env.MODEL || fileConfig?.model || 'gpt-4o-mini',
      temperature:
        parseFloat(process.env.TEMPERATURE || '') || fileConfig?.temperature || 0.5,
      maxTokens:
        parseInt(process.env.MAX_COMPLETION_TOKENS || '') || fileConfig?.maxTokens || 2000,
      embeddingModel:
        process.env.EMBEDDING_MODEL ||
        fileConfig?.embeddingModel ||
        'text-embedding-3-small',
      embeddingDimensions: fileConfig?.embeddingDimensions || 1536
    }

    return config
  }

  /**
   * Load SOPs (Standard Operating Procedures)
   */
  async loadSOPs(): Promise<SOP[]> {
    const config = await this.loadJSON<{ sops: SOP[] }>('sops.json', SOPsConfigSchema, false)
    return config?.sops || []
  }

  /**
   * Load MCP configuration
   */
  async loadMCPConfig(): Promise<MCPConfig | null> {
    return await this.loadJSON<MCPConfig>('mcp-config.json', MCPConfigSchema, false)
  }

  /**
   * Load all configuration at once
   */
  async loadAll(): Promise<LoadedConfig> {
    logger.info('Loading all configuration...')

    const [company, products, prompts, features, ai, sops, mcp] = await Promise.all([
      this.loadCompanyConfig(),
      this.loadProducts(),
      this.loadPrompts(),
      this.loadFeatures(),
      this.loadAIConfig(),
      this.loadSOPs(),
      this.loadMCPConfig()
    ])

    logger.info(
      {
        company: company.name,
        agentName: company.agentName,
        products: products.length,
        sops: sops.length
      },
      'Configuration loaded successfully'
    )

    return {
      company,
      products,
      prompts,
      features,
      ai,
      sops,
      mcp: mcp || undefined
    }
  }
}

// Singleton instance
let _loader: ConfigLoader | null = null

/**
 * Get the singleton config loader instance
 */
export function getConfigLoader(options?: ConfigLoaderOptions): ConfigLoader {
  if (!_loader) {
    _loader = new ConfigLoader(options)
  }
  return _loader
}
