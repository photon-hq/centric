/**
 * Slack Notifier
 * Bidirectional Slack integration for human handoff support
 */

import { App } from '@slack/bolt'
import type { ConversationState } from '../types/index.js'

export interface SlackNotifierCallbacks {
  onMessageForCustomer: (sender: string, text: string) => void
  onResolve: (sender: string) => void
}

export class SlackNotifier {
  private app: App
  private channelId: string
  private threadMap: Map<string, string> = new Map() // threadTs → senderPhoneNumber
  private callbacks: SlackNotifierCallbacks

  constructor(
    botToken: string,
    appToken: string,
    channelId: string,
    callbacks: SlackNotifierCallbacks
  ) {
    this.channelId = channelId
    this.callbacks = callbacks
    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true
    })
  }

  async start(): Promise<void> {
    this.app.event('message', async ({ event }) => {
      const msg = event as any

      // Ignore top-level messages, bot messages, and messages from other channels
      if (!msg.thread_ts) return
      if (msg.bot_id || msg.subtype === 'bot_message') return
      if (msg.channel !== this.channelId) return

      const sender = this.threadMap.get(msg.thread_ts)
      if (!sender) return

      const text: string = msg.text || ''

      if (text.trim() === '/resolve') {
        this.callbacks.onResolve(sender)
        await this.app.client.chat.postMessage({
          channel: this.channelId,
          thread_ts: msg.thread_ts,
          text: '✅ Resolved. AI re-enabled.'
        })
      } else {
        this.callbacks.onMessageForCustomer(sender, text)
      }
    })

    await this.app.start()
  }

  async stop(): Promise<void> {
    await this.app.stop()
  }

  async postHandoff(
    sender: string,
    conversation: ConversationState,
    summary: string
  ): Promise<string | null> {
    try {
      const time = new Date().toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      const priorEscalations = conversation.handoffCount ?? 0

      const transcript = conversation.messageHistory
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Agent'}: ${msg.content}`)
        .join('\n')

      // Format phone number for display
      const formattedPhone = sender.replace(/[^0-9+]/g, '')

      const text = [
        '🚨 Human Handoff Request',
        '',
        `Customer Phone: ${formattedPhone}`,
        `Time: ${time}`,
        `Prior escalations this session: ${priorEscalations}`,
        '',
        '📋 AI Issue Summary:',
        summary,
        '',
        '💬 Conversation Transcript:',
        transcript,
        '',
        '---',
        'Reply here to respond via iMessage. Type /resolve when done to re-enable AI.'
      ].join('\n')

      const result = await this.app.client.chat.postMessage({
        channel: this.channelId,
        text
      })

      if (result.ts) {
        this.threadMap.set(result.ts, sender)
        return result.ts
      }
      return null
    } catch (error) {
      return null
    }
  }

  async postCustomerMessage(threadTs: string, text: string): Promise<void> {
    try {
      await this.app.client.chat.postMessage({
        channel: this.channelId,
        thread_ts: threadTs,
        text: `📱 Customer: ${text}`
      })
    } catch {
      // silently fail - customer message relay is best-effort
    }
  }
}
