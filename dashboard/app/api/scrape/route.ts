import { NextRequest } from 'next/server'
import { normalizeWebsiteUrl, runScrape, type ScrapeConfig } from '../../../lib/scrape-engine'

export async function POST(request: NextRequest) {
  try {
    const config: ScrapeConfig = await request.json()

    if (!config.websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'Website URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    try {
      config.websiteUrl = normalizeWebsiteUrl(config.websiteUrl)
    } catch {
      return new Response(
        JSON.stringify({ error: `Invalid URL format: ${config.websiteUrl}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const summary = await runScrape(config, async (progress) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`))
          })

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'complete', ...summary })}\n\n`)
          )
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
              })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
