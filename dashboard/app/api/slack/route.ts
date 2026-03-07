import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '..', 'config')
const COMPANY_FILE = path.join(CONFIG_DIR, 'company.json')
const ENV_FILE = path.join(process.cwd(), '..', '.env.local')

async function readCompanyJson(): Promise<any> {
  const data = await fs.readFile(COMPANY_FILE, 'utf-8')
  return JSON.parse(data)
}

async function writeCompanyJson(company: any): Promise<void> {
  await fs.writeFile(COMPANY_FILE, JSON.stringify(company, null, 2))
}

async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(ENV_FILE, 'utf-8')
  } catch {
    return ''
  }
}

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm')
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`)
  }
  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  return `${content}${separator}${key}=${value}\n`
}

// GET - return Slack config (without exposing token values)
export async function GET() {
  try {
    const company = await readCompanyJson()
    const envContent = await readEnvFile()

    const slackEnabled = company.humanHandoff?.slackEnabled ?? false
    const slackChannelId = company.humanHandoff?.slackChannelId ?? ''
    const slackPingType = company.humanHandoff?.slackPingType ?? 'none'
    const botTokenSet = /^SLACK_BOT_TOKEN=.+/m.test(envContent)
    const appTokenSet = /^SLACK_APP_TOKEN=.+/m.test(envContent)

    return NextResponse.json({ slackEnabled, slackChannelId, slackPingType, botTokenSet, appTokenSet })
  } catch (error) {
    console.error('Error loading Slack config:', error)
    return NextResponse.json(
      { error: 'Failed to load Slack configuration' },
      { status: 500 }
    )
  }
}

// POST - save Slack config or test connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, slackEnabled, slackChannelId, slackPingType, botToken, appToken } = body

    // Test Slack bot token
    if (action === 'test') {
      const envContent = await readEnvFile()
      const tokenMatch = envContent.match(/^SLACK_BOT_TOKEN=(.+)$/m)
      const token = tokenMatch?.[1]?.trim()
      if (!token) return NextResponse.json({ ok: false, error: 'SLACK_BOT_TOKEN not set' })
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.ok) return NextResponse.json({ ok: true, team: data.team, botName: data.user })
      return NextResponse.json({ ok: false, error: data.error })
    }

    // Update company.json
    const company = await readCompanyJson()
    if (!company.humanHandoff) {
      company.humanHandoff = { enabled: false, keywords: [], message: '' }
    }
    if (typeof slackEnabled === 'boolean') company.humanHandoff.slackEnabled = slackEnabled
    if (typeof slackChannelId === 'string') company.humanHandoff.slackChannelId = slackChannelId
    if (slackPingType === 'none' || slackPingType === 'here' || slackPingType === 'channel') company.humanHandoff.slackPingType = slackPingType
    await writeCompanyJson(company)

    // Update .env.local for tokens if provided
    if (botToken || appToken) {
      let envContent = await readEnvFile()
      if (botToken) envContent = setEnvVar(envContent, 'SLACK_BOT_TOKEN', botToken)
      if (appToken) envContent = setEnvVar(envContent, 'SLACK_APP_TOKEN', appToken)
      await fs.writeFile(ENV_FILE, envContent)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving Slack config:', error)
    return NextResponse.json(
      { error: 'Failed to save Slack configuration' },
      { status: 500 }
    )
  }
}
