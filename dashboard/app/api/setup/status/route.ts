import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
import path from 'path'

/**
 * GET /api/setup/status - Check if setup is complete
 */
export async function GET() {
    try {
        const projectRoot = path.join(process.cwd(), '..')
        const configFile = path.join(projectRoot, 'config', 'scraper.config.json')
        const documentsDir = path.join(projectRoot, 'documents')
        
        // Check if config exists and has a website URL
        let hasConfig = false
        let websiteUrl = ''
        let lastScraped: string | null = null
        let autoUpdateEnabled = false
        
        if (existsSync(configFile)) {
            try {
                const configContent = await readFile(configFile, 'utf-8')
                const config = JSON.parse(configContent)
                websiteUrl = config.websiteUrl || ''
                lastScraped = config.lastScraped || null
                autoUpdateEnabled = config.autoUpdateEnabled ?? false
                hasConfig = websiteUrl.length > 0
            } catch (error) {
                hasConfig = false
            }
        }
        
        // Check if documents exist (knowledge base)
        let documentCount = 0
        if (existsSync(documentsDir)) {
            const files = readdirSync(documentsDir)
            documentCount = files.filter(f => f.endsWith('.md')).length
        }
        
        // Setup is complete if knowledge base has documents
        const isComplete = documentCount > 0
        
        return NextResponse.json({
            complete: isComplete,
            hasConfig,
            websiteUrl,
            documentCount,
            lastScraped,
            autoUpdateEnabled,
            message: isComplete 
                ? 'Knowledge base ready! iMessage agent can be deployed.'
                : 'Please scrape your website or upload documents to build the knowledge base'
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to check setup status', details: error.message },
            { status: 500 }
        )
    }
}
