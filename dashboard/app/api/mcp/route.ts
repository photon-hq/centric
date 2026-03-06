import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '..', 'config')
const MCP_CONFIG_FILE = path.join(CONFIG_DIR, 'mcp-config.json')

interface MCPServer {
  id: string
  name: string
  url: string
  apiKey?: string
  type: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  enabled: boolean
  lastConnected?: string
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  lastUpdated: string | null
}

async function loadMCPConfig(): Promise<MCPConfig> {
  if (fsSync.existsSync(MCP_CONFIG_FILE)) {
    try {
      const data = await fs.readFile(MCP_CONFIG_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      console.error('Error loading MCP config:', e)
    }
  }
  
  return {
    enabled: false,
    servers: [],
    lastUpdated: null
  }
}

async function saveMCPConfig(config: MCPConfig): Promise<void> {
  config.lastUpdated = new Date().toISOString()
  await fs.writeFile(MCP_CONFIG_FILE, JSON.stringify(config, null, 2))
}

// GET - Get MCP configuration
export async function GET() {
  try {
    const config = await loadMCPConfig()
    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error loading MCP config:', error)
    return NextResponse.json(
      { error: 'Failed to load MCP configuration' },
      { status: 500 }
    )
  }
}

// POST - Add a new MCP server or test connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, name, url, apiKey, type = 'sse', command, args } = body

    // Test MCP server connectivity
    if (action === 'test') {
      if (!url) return NextResponse.json({ error: 'URL is required for test' }, { status: 400 })
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(`${url}/tools`, { signal: controller.signal })
        clearTimeout(timer)
        const data = await res.json()
        return NextResponse.json({ ok: true, toolCount: data.tools?.length ?? 0 })
      } catch (err) {
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Server name is required' },
        { status: 400 }
      )
    }
    
    if (type === 'stdio' && !command) {
      return NextResponse.json(
        { error: 'Command is required for stdio transport' },
        { status: 400 }
      )
    }
    
    if ((type === 'sse' || type === 'streamable-http') && !url) {
      return NextResponse.json(
        { error: 'URL is required for SSE/HTTP transport' },
        { status: 400 }
      )
    }
    
    const config = await loadMCPConfig()
    
    const newServer: MCPServer = {
      id: `mcp-${Date.now()}`,
      name,
      url: url || '',
      apiKey,
      type,
      command,
      args: args || [],
      enabled: true
    }
    
    config.servers.push(newServer)
    config.enabled = true
    await saveMCPConfig(config)
    
    return NextResponse.json({ 
      server: newServer, 
      message: 'MCP server added successfully' 
    })
  } catch (error) {
    console.error('Error adding MCP server:', error)
    return NextResponse.json(
      { error: 'Failed to add MCP server' },
      { status: 500 }
    )
  }
}

// PATCH - Update MCP config or server
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { serverId, enabled, ...serverUpdates } = body
    
    const config = await loadMCPConfig()
    
    // If updating global enabled state
    if (typeof enabled === 'boolean' && !serverId) {
      config.enabled = enabled
      await saveMCPConfig(config)
      return NextResponse.json({ 
        config, 
        message: `MCP ${enabled ? 'enabled' : 'disabled'} successfully` 
      })
    }
    
    // If updating a specific server
    if (serverId) {
      const serverIndex = config.servers.findIndex(s => s.id === serverId)
      
      if (serverIndex === -1) {
        return NextResponse.json(
          { error: 'Server not found' },
          { status: 404 }
        )
      }
      
      config.servers[serverIndex] = {
        ...config.servers[serverIndex],
        ...serverUpdates,
        ...(typeof enabled === 'boolean' ? { enabled } : {})
      }
      
      await saveMCPConfig(config)
      
      return NextResponse.json({ 
        server: config.servers[serverIndex], 
        message: 'Server updated successfully' 
      })
    }
    
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating MCP config:', error)
    return NextResponse.json(
      { error: 'Failed to update MCP configuration' },
      { status: 500 }
    )
  }
}

// DELETE - Remove an MCP server
export async function DELETE(request: NextRequest) {
  try {
    const { serverId } = await request.json()
    
    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      )
    }
    
    const config = await loadMCPConfig()
    const originalLength = config.servers.length
    config.servers = config.servers.filter(s => s.id !== serverId)
    
    if (config.servers.length === originalLength) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      )
    }
    
    // Disable MCP if no servers left
    if (config.servers.length === 0) {
      config.enabled = false
    }
    
    await saveMCPConfig(config)
    
    return NextResponse.json({ message: 'MCP server removed successfully' })
  } catch (error) {
    console.error('Error removing MCP server:', error)
    return NextResponse.json(
      { error: 'Failed to remove MCP server' },
      { status: 500 }
    )
  }
}
