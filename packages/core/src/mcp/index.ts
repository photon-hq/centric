/**
 * MCP (Model Context Protocol) Integration
 * Handles loading, converting, and executing MCP tools
 */

import type OpenAI from 'openai'
import type { MCPConfig, MCPTool, MCPServer } from '../types/index.js'
import { MCPError } from '../errors/index.js'
import { logger } from '../logger/index.js'

export class MCPManager {
  private tools: MCPTool[] = []
  private enabled: boolean = false

  /**
   * Load MCP configuration and fetch tools from servers
   */
  async loadConfig(config: MCPConfig | null): Promise<void> {
    if (!config || !config.enabled) {
      logger.info('MCP is disabled')
      this.enabled = false
      return
    }

    this.enabled = true

    // Fetch tools from each active server
    const toolPromises = config.servers
      .filter((server) => server.enabled && (server.type === 'sse' || server.type === 'streamable-http'))
      .map(async (server) => {
        try {
          const toolsUrl = `${server.url}/tools`
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (server.apiKey) {
            headers['Authorization'] = `Bearer ${server.apiKey}`
          }

          const response = await fetch(toolsUrl, { headers })
          if (!response.ok) {
            logger.warn(
              { server: server.name, status: response.statusText },
              'Failed to fetch tools from MCP server'
            )
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
          logger.warn({ server: server.name, error }, 'Error fetching tools from MCP server')
          return []
        }
      })

    const toolArrays = await Promise.all(toolPromises)
    this.tools = toolArrays.flat()

    if (this.tools.length > 0) {
      logger.info({ count: this.tools.length, tools: this.tools.map(t => t.name) }, 'MCP tools loaded')
    } else {
      logger.warn('No MCP tools available')
    }
  }

  /**
   * Check if MCP is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get all loaded MCP tools
   */
  getTools(): MCPTool[] {
    return this.tools
  }

  /**
   * Convert MCP tools to OpenAI function calling format
   */
  convertToOpenAIFormat(): OpenAI.Chat.ChatCompletionTool[] {
    return this.tools.map((tool) => {
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

  /**
   * Execute an MCP tool
   */
  async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    const tool = this.tools.find((t) => t.name === toolName)
    if (!tool) {
      throw MCPError(`Tool not found: ${toolName}`, { toolName })
    }

    const callUrl = `${tool.serverUrl}/call`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (tool.serverApiKey) {
      headers['Authorization'] = `Bearer ${tool.serverApiKey}`
    }

    try {
      const response = await fetch(callUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tool: toolName,
          parameters
        })
      })

      if (!response.ok) {
        throw MCPError(`MCP tool call failed: ${response.statusText}`, {
          toolName,
          status: response.status,
          statusText: response.statusText
        })
      }

      return await response.json()
    } catch (error) {
      throw MCPError(`Error executing MCP tool: ${toolName}`, { toolName, parameters }, error as Error)
    }
  }
}
