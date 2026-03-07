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
    // Handle incoming thread replies ,  relay back to the customer
    this.app.event('message', async ({ event }) => {
      const msg = event as any

      console.log('[SlackNotifier] message event:', { subtype: msg.subtype, thread_ts: msg.thread_ts, channel: msg.channel, bot_id: msg.bot_id, text: msg.text?.slice(0, 50) })

      if (!msg.thread_ts) { console.log('[SlackNotifier] skip: no thread_ts'); return }
      if (msg.bot_id || msg.subtype) { console.log('[SlackNotifier] skip: bot_id or subtype', msg.bot_id, msg.subtype); return }
      if (msg.channel !== this.channelId) { console.log('[SlackNotifier] skip: channel mismatch', msg.channel, 'vs', this.channelId); return }

      const sender = this.threadMap.get(msg.thread_ts)
      if (!sender) { console.log('[SlackNotifier] skip: no threadMap entry for', msg.thread_ts, ',  known threads:', [...this.threadMap.keys()]); return }

      const text: string = msg.text || ''

      // CLOSETICKET keyword ,  re-enables AI without forwarding to customer
      if (text.trim().toUpperCase() === 'CLOSETICKET') {
        this.callbacks.onResolve(sender)
        this.threadMap.delete(msg.thread_ts)
        return
      }

      console.log('[SlackNotifier] routing to customer', sender)
      this.callbacks.onMessageForCustomer(sender, text)
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
      const phone = conversation.senderPhone || sender

      const alertText = [
        ':rotating_light: *Human Handoff Request*',
        '',
        `*Customer Phone:* ${phone}`,
        `*Time:* ${time}`,
        `*Prior escalations this session:* ${priorEscalations}`,
        '',
        ':clipboard: *AI Issue Summary:*',
        summary
      ].join('\n')

      const result = await this.app.client.chat.postMessage({
        channel: this.channelId,
        text: alertText,
        mrkdwn: true
      })

      if (!result.ts) {
        console.error('[SlackNotifier] postHandoff: message posted but no ts returned', result)
        return null
      }

      // Lock in the canonical channel ID from the API response so event filtering always matches
      if (result.channel) this.channelId = result.channel as string

      this.threadMap.set(result.ts, sender)

      // Post full transcript as a thread reply
      const transcriptLines = conversation.messageHistory.map((msg) => {
        const label = msg.role === 'user' ? '👤 *Customer:*' : '🤖 *Agent:*'
        return `${label} ${msg.content}`
      })

      const threadText = [
        '💬 *Conversation Transcript*',
        '',
        ...transcriptLines,
        '',
        '---',
        '_Reply in this thread to respond to the customer. Type `CLOSETICKET` when done to re-enable AI._'
      ].join('\n\n').replace(/\n\n---\n\n/g, '\n\n---\n')

      await this.app.client.chat.postMessage({
        channel: this.channelId,
        thread_ts: result.ts,
        text: threadText,
        mrkdwn: true
      })

      return result.ts
    } catch (error: any) {
      console.error('[SlackNotifier] postHandoff failed:', error?.data?.error || error?.message || error)
      throw error
    }
  }

  async postCustomerMessage(threadTs: string, text: string): Promise<void> {
    try {
      await this.app.client.chat.postMessage({
        channel: this.channelId,
        thread_ts: threadTs,
        text: `📱 Customer: ${text}`
      })
    } catch (error: any) {
      console.error('[SlackNotifier] postCustomerMessage failed:', error?.data?.error || error?.message || error)
    }
  }
}
