import { NextResponse } from 'next/server'
import { bumpKnowledgeVersion } from '../../../lib/knowledge-version'

/**
 * POST /api/reinitialize - Signal that knowledge base should be reloaded
 */
export async function POST() {
  try {
    const version = await bumpKnowledgeVersion()

    return NextResponse.json({
      success: true,
      version,
      message: 'Knowledge base reload signal sent'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reinitialize', details: error.message },
      { status: 500 }
    )
  }
}
