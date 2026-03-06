import { NextRequest, NextResponse } from 'next/server'
import { humanMsgQueues, resolvedSessions } from '../state'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const messages = humanMsgQueues.get(sessionId) ?? []
  humanMsgQueues.set(sessionId, []) // drain

  const handoffResolved = resolvedSessions.has(sessionId)
  if (handoffResolved) resolvedSessions.delete(sessionId)

  return NextResponse.json({ messages, handoffResolved })
}
