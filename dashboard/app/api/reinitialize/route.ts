import { NextResponse } from 'next/server'

/**
 * POST /api/reinitialize - Signal that knowledge base should be reloaded
 * This doesn't actually reinitialize (that happens per-request in chat)
 * but we'll use it to clear any caches if needed
 */
export async function POST() {
  try {
    // In a production system, you might clear Redis cache or reset shared state here
    // For now, just return success - the next chat request will load fresh documents
    
    return NextResponse.json({ 
      success: true,
      message: 'Knowledge base will be reloaded on next chat request'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reinitialize', details: error.message },
      { status: 500 }
    )
  }
}
