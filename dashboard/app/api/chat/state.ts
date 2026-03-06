import { SlackNotifier } from '@photon/core'

// Shared singleton state between the chat route and the poll route
export let dashboardSlackNotifier: SlackNotifier | null = null
export function setDashboardSlackNotifier(n: SlackNotifier | null) {
  dashboardSlackNotifier = n
}

// Queue of messages sent by humans in Slack, keyed by sessionId
export const humanMsgQueues = new Map<string, string[]>()

// Sessions where human handoff was just resolved (drained on next poll)
export const resolvedSessions = new Set<string>()
