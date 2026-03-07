/**
 * Shared test setup for dashboard tests
 *
 * Provides mock factories for OpenAI and infrastructure dependencies.
 * Import this AFTER mock.module() calls (or let the test file handle mocking).
 */

import type { ConversationState } from '@photon/core'
import { NextRequest } from 'next/server'

/**
 * Build a POST /api/chat NextRequest
 */
export function makeChatRequest(
  body: { message: string; senderPhone?: string },
  sessionId: string
): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-id': sessionId
    },
    body: JSON.stringify(body)
  })
}

/**
 * Build a GET /api/chat/poll NextRequest
 */
export function makePollRequest(sessionId: string): NextRequest {
  return new NextRequest(`http://localhost/api/chat/poll?sessionId=${sessionId}`)
}

/**
 * Create a unique session ID for test isolation
 */
let _sessionCounter = 0
export function uniqueSessionId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${++_sessionCounter}`
}

/**
 * Simple OpenAI completion response shape
 */
export function makeTextCompletion(content: string) {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: { role: 'assistant', content, tool_calls: null }
      }
    ]
  }
}

/**
 * OpenAI tool call response shape
 */
export function makeToolCallCompletion(toolName: string, args: Record<string, any>, callId = 'call_1') {
  return {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(args) }
            }
          ]
        }
      }
    ]
  }
}
