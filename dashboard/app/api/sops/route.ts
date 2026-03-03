import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '..', 'config')
const SOPS_FILE = path.join(CONFIG_DIR, 'sops.json')
const DEFAULT_SOPS_FILE = path.join(CONFIG_DIR, 'default-sops.json')

interface SOP {
  id: string
  title: string
  objective: string
  trigger: string
  steps: string[]
  enabled: boolean
  createdAt: string
}

async function loadSOPs(): Promise<SOP[]> {
  // First try to load custom SOPs
  if (fsSync.existsSync(SOPS_FILE)) {
    try {
      const data = await fs.readFile(SOPS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (e) {
      console.error('Error loading SOPs:', e)
    }
  }
  
  // Fall back to default SOPs
  if (fsSync.existsSync(DEFAULT_SOPS_FILE)) {
    try {
      const data = await fs.readFile(DEFAULT_SOPS_FILE, 'utf-8')
      const defaultSOPs = JSON.parse(data)
      // Save defaults as current SOPs
      await fs.writeFile(SOPS_FILE, JSON.stringify(defaultSOPs, null, 2))
      return defaultSOPs
    } catch (e) {
      console.error('Error loading default SOPs:', e)
    }
  }
  
  return []
}

async function saveSOPs(sops: SOP[]): Promise<void> {
  await fs.writeFile(SOPS_FILE, JSON.stringify(sops, null, 2))
}

// GET - List all SOPs
export async function GET() {
  try {
    const sops = await loadSOPs()
    return NextResponse.json({ sops })
  } catch (error) {
    console.error('Error loading SOPs:', error)
    return NextResponse.json(
      { error: 'Failed to load SOPs' },
      { status: 500 }
    )
  }
}

// POST - Create a new SOP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, objective, trigger, steps } = body
    
    if (!title || !objective || !trigger || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, objective, trigger, steps (array)' },
        { status: 400 }
      )
    }
    
    const sops = await loadSOPs()
    
    const newSOP: SOP = {
      id: `sop-${Date.now()}`,
      title,
      objective,
      trigger,
      steps,
      enabled: true,
      createdAt: new Date().toISOString()
    }
    
    sops.push(newSOP)
    await saveSOPs(sops)
    
    return NextResponse.json({ sop: newSOP, message: 'SOP created successfully' })
  } catch (error) {
    console.error('Error creating SOP:', error)
    return NextResponse.json(
      { error: 'Failed to create SOP' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a specific SOP
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'SOP ID is required' },
        { status: 400 }
      )
    }
    
    const sops = await loadSOPs()
    const filteredSOPs = sops.filter(sop => sop.id !== id)
    
    if (filteredSOPs.length === sops.length) {
      return NextResponse.json(
        { error: 'SOP not found' },
        { status: 404 }
      )
    }
    
    await saveSOPs(filteredSOPs)
    
    return NextResponse.json({ message: 'SOP deleted successfully' })
  } catch (error) {
    console.error('Error deleting SOP:', error)
    return NextResponse.json(
      { error: 'Failed to delete SOP' },
      { status: 500 }
    )
  }
}

// PATCH - Update an existing SOP (toggle enabled, edit fields)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'SOP ID is required' },
        { status: 400 }
      )
    }
    
    const sops = await loadSOPs()
    const sopIndex = sops.findIndex(sop => sop.id === id)
    
    if (sopIndex === -1) {
      return NextResponse.json(
        { error: 'SOP not found' },
        { status: 404 }
      )
    }
    
    // Update the SOP with provided fields
    sops[sopIndex] = {
      ...sops[sopIndex],
      ...updates
    }
    
    await saveSOPs(sops)
    
    return NextResponse.json({ sop: sops[sopIndex], message: 'SOP updated successfully' })
  } catch (error) {
    console.error('Error updating SOP:', error)
    return NextResponse.json(
      { error: 'Failed to update SOP' },
      { status: 500 }
    )
  }
}
