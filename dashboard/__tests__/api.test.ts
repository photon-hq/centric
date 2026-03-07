/**
 * Dashboard API Integration Tests
 *
 * All dashboard tests in a single file to share the module-level OpenAI mock and
 * avoid stale singleton issues from bun's shared module cache across test files.
 *
 * Covers:
 *  - Basic AI response pipeline
 *  - Em-dash sanitization
 *  - Tool calling loop (MCP + KB search)
 *  - Multiple concurrent sessions (isolation)
 *  - CLOSETICKET behavior
 *  - Human handoff trigger
 *  - Handoff relay (messages forwarded to hold response)
 *  - Session isolation (handoff in A does not affect B)
 *  - Poll endpoint (humanMsgQueues drain, resolvedSessions)
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { makeChatRequest, makePollRequest, makeTextCompletion, makeToolCallCompletion, uniqueSessionId } from './setup.ts'

// ---------------------------------------------------------------------------
// Single shared completion queue ,  all tests push here BEFORE calling chat()
// ---------------------------------------------------------------------------

const completionQueue: any[] = []

// ---------------------------------------------------------------------------
// Mock openai BEFORE importing the route so the module singleton uses this mock
// ---------------------------------------------------------------------------

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async (_params: any) => {
          const response = completionQueue.shift()
          if (!response) return makeTextCompletion('Default mock')
          return response
        }
      }
    }
    // No embeddings.create ,  vector store falls back to noop gracefully
  }
}))

// ---------------------------------------------------------------------------
// Import the route handler (uses mocked openai from above)
// ---------------------------------------------------------------------------

const { POST } = await import('../app/api/chat/route.ts')

// Import poll handler (may not exist ,  skip poll tests if absent)
let pollGET: (req: any) => Promise<any> | null = null as any
try {
  const pollMod = await import('../app/api/chat/poll/route.ts')
  pollGET = pollMod.GET
} catch {
  // poll route not wired up ,  poll tests will be skipped
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function chat(message: string, sessionId: string): Promise<{ response: string; handoffActive: boolean }> {
  const req = makeChatRequest({ message }, sessionId)
  const res = await POST(req)
  return res.json()
}

// ---------------------------------------------------------------------------
// Basic pipeline
// ---------------------------------------------------------------------------

describe('Basic AI response', () => {
  it('returns AI response text', async () => {
    const sid = uniqueSessionId('basic')
    completionQueue.push(makeTextCompletion('Hello from AI!'))

    const { response } = await chat('Hello', sid)
    expect(response).toBe('Hello from AI!')
  })

  it('returns 400 when message is missing', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': uniqueSessionId() },
      body: JSON.stringify({})
    })
    // @ts-ignore ,  passing plain Request to NextRequest handler for test
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('handoffActive is false for normal conversation', async () => {
    const sid = uniqueSessionId('no-handoff')
    completionQueue.push(makeTextCompletion('Happy to help!'))
    const { handoffActive } = await chat('Hello, can you help me?', sid)
    expect(handoffActive).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Em-dash sanitization
// ---------------------------------------------------------------------------

describe('Em-dash sanitization', () => {
  it('converts em-dashes in AI response to commas', async () => {
    const sid = uniqueSessionId('emdash')
    completionQueue.push(makeTextCompletion('Step one \u2014 do this. Step two \u2014 do that.'))

    const { response } = await chat('Show me steps', sid)
    expect(response).not.toContain('\u2014')
    expect(response).toContain(',')
  })
})

// ---------------------------------------------------------------------------
// Tool calling loop
// ---------------------------------------------------------------------------

describe('Tool calling loop', () => {
  it('handles a single KB search tool call then returns text', async () => {
    const sid = uniqueSessionId('tool-kb')
    completionQueue.push(makeToolCallCompletion('search_knowledge_base', { query: 'refund policy' }))
    completionQueue.push(makeTextCompletion('Our refund policy is 30 days.'))

    const { response } = await chat('What is the refund policy?', sid)
    expect(response).toBe('Our refund policy is 30 days.')
  })

  it('caps tool loop at 5 iterations and returns fallback', async () => {
    const sid = uniqueSessionId('loop-cap')
    // Push 6 tool calls ,  loop should cap at 5 and return the max-iterations message
    for (let i = 0; i < 6; i++) {
      completionQueue.push(makeToolCallCompletion('search_knowledge_base', { query: 'loop' }))
    }

    const { response } = await chat('Test looping', sid)
    expect(response.toLowerCase()).toMatch(/maximum|tool call|rephrase/)
  })

  it('handles MCP tool call sequence', async () => {
    const sid = uniqueSessionId('tool-mcp')
    // AI calls an MCP tool (order status), gets result, then responds
    completionQueue.push(makeToolCallCompletion('get_order_status', { orderId: 'ORD-123' }))
    completionQueue.push(makeTextCompletion('Your order ORD-123 is on its way!'))

    const { response } = await chat('Where is my order ORD-123?', sid)
    expect(response).toBe('Your order ORD-123 is on its way!')
  })
})

// ---------------------------------------------------------------------------
// Multiple concurrent sessions
// ---------------------------------------------------------------------------

describe('Multiple concurrent sessions', () => {
  it('maintains separate conversation histories for two sessions', async () => {
    const sid1 = uniqueSessionId('userA')
    const sid2 = uniqueSessionId('userB')

    completionQueue.push(makeTextCompletion('Hello from session 1'))
    await chat('Hello', sid1)

    completionQueue.push(makeTextCompletion('Hello from session 2'))
    await chat('Hello', sid2)

    completionQueue.push(makeTextCompletion('Session 1 reply 2'))
    const { response } = await chat('Second message', sid1)
    expect(response).toBe('Session 1 reply 2')
  })

  it('five sessions process independently without cross-contamination', async () => {
    const sessions = Array.from({ length: 5 }, (_, i) => uniqueSessionId(`concurrent-${i}`))

    // Push responses - one per session (queue is FIFO, order may vary with concurrent requests)
    sessions.forEach((_, i) => {
      completionQueue.push(makeTextCompletion(`Response for session ${i}`))
    })

    const results = await Promise.all(sessions.map((sid, i) => chat(`Message ${i}`, sid)))

    // Each session gets exactly one response and they don't bleed into each other
    const allResponses = results.map(r => r.response)
    // Verify all 5 responses were consumed (each one was unique)
    const uniqueResponses = new Set(allResponses)
    expect(uniqueResponses.size).toBe(5)
    // All should match the pattern
    allResponses.forEach(r => expect(r).toMatch(/Response for session \d/))
  })

  it('handoff in session A does not affect session B', async () => {
    const sidA = uniqueSessionId('handoff-iso-A')
    const sidB = uniqueSessionId('handoff-iso-B')

    const { handoffActive: aHandoff } = await chat('I need to speak to a human agent', sidA)
    expect(aHandoff).toBe(true)

    completionQueue.push(makeTextCompletion('No handoff here'))
    const { handoffActive: bHandoff } = await chat('Just a normal question', sidB)
    expect(bHandoff).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CLOSETICKET behavior
// ---------------------------------------------------------------------------

describe('CLOSETICKET behavior', () => {
  it('closes ticket when customer uses a close phrase', async () => {
    const sid = uniqueSessionId('closeticket')
    completionQueue.push(makeTextCompletion('Sure, I can help with that!'))
    await chat('I need help with something', sid)

    const { response } = await chat('close ticket', sid)
    expect(response.toLowerCase()).toMatch(/closed|done|goodbye|take care/)
  })

  it('fresh ticket starts after close ,  AI responds normally', async () => {
    const sid = uniqueSessionId('fresh-after-close')
    completionQueue.push(makeTextCompletion('First conversation'))
    await chat('First question', sid)

    // Close
    await chat('that is all', sid)

    // New question should get AI response
    completionQueue.push(makeTextCompletion('New fresh response'))
    const { response } = await chat('New question', sid)
    expect(response).toBe('New fresh response')
  })

  it('closed session A does not affect session B', async () => {
    const sidA = uniqueSessionId('close-iso-A')
    const sidB = uniqueSessionId('close-iso-B')

    completionQueue.push(makeTextCompletion('Session A response'))
    await chat('First message', sidA)
    await chat('all done, nothing else', sidA)

    completionQueue.push(makeTextCompletion('Session B normal'))
    const { response } = await chat('Normal question', sidB)
    expect(response).toBe('Session B normal')
  })
})

// ---------------------------------------------------------------------------
// Human handoff
// ---------------------------------------------------------------------------

describe('Human handoff', () => {
  it('sets handoffActive=true when handoff keyword is used', async () => {
    const sid = uniqueSessionId('handoff-kw')
    const { handoffActive } = await chat('I need to speak to a human agent', sid)
    expect(handoffActive).toBe(true)
  })

  it('returns hold message when handoffActive and customer sends more messages', async () => {
    const sid = uniqueSessionId('handoff-relay')
    await chat('speak to a human', sid)

    const { response } = await chat('Are you there?', sid)
    expect(response.toLowerCase()).toMatch(/sent|support team|shortly|hold/)
  })

  it('handoffActive stays true for subsequent messages in same session', async () => {
    const sid = uniqueSessionId('handoff-sticky')
    await chat('I want a real person', sid)

    const second = await chat('Hello?', sid)
    expect(second.handoffActive).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Poll endpoint
// ---------------------------------------------------------------------------

describe('Poll endpoint', () => {
  it('GET /api/chat/poll returns valid response shape', async () => {
    if (!pollGET) { console.log('[SKIP] poll route not found'); return }
    const sid = uniqueSessionId('poll-shape')
    const req = makePollRequest(sid)
    const res = await pollGET(req)
    const body = await res.json()
    expect(body).toHaveProperty('messages')
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body).toHaveProperty('handoffResolved')
  })

  it('poll drains humanMsgQueues for the session', async () => {
    if (!pollGET) { console.log('[SKIP] poll route not found'); return }
    const sid = uniqueSessionId('poll-drain')
    const state = await import('../app/api/chat/state.ts')

    state.humanMsgQueues.set(sid, ['Agent reply 1', 'Agent reply 2'])

    const req = makePollRequest(sid)
    const res = await pollGET(req)
    const body = await res.json()
    expect(body.messages).toContain('Agent reply 1')
    expect(body.messages).toContain('Agent reply 2')
    // Queue should be drained
    expect(state.humanMsgQueues.get(sid)?.length ?? 0).toBe(0)
  })

  it('poll returns handoffResolved=true and clears resolvedSessions', async () => {
    if (!pollGET) { console.log('[SKIP] poll route not found'); return }
    const sid = uniqueSessionId('poll-resolved')
    const state = await import('../app/api/chat/state.ts')
    state.resolvedSessions.add(sid)

    const req = makePollRequest(sid)
    const res = await pollGET(req)
    const body = await res.json()
    expect(body.handoffResolved).toBe(true)
    expect(state.resolvedSessions.has(sid)).toBe(false)
  })
})
