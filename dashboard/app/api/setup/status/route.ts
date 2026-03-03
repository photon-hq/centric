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
        
        if (existsSync(configFile)) {
            try {
                const configContent = await readFile(configFile, 'utf-8')
                const config = JSON.parse(configContent)
                websiteUrl = config.websiteUrl || ''
                hasConfig = websiteUrl.length > 0
            } catch (error) {
                // Invalid config file
                hasConfig = false
            }
        }
        
        // Check if documents exist
        let documentCount = 0
        if (existsSync(documentsDir)) {
            const files = readdirSync(documentsDir)
            documentCount = files.filter(f => f.endsWith('.md')).length
        }
        
        const isComplete = hasConfig && documentCount > 0
        
        return NextResponse.json({
            complete: isComplete,
            hasConfig,
            websiteUrl,
            documentCount,
            message: isComplete 
                ? 'Setup complete! Ready to chat and deploy.'
                : !hasConfig
                    ? 'Please configure your website to scrape'
                    : 'Please scrape your website to build the knowledge base'
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Failed to check setup status', details: error.message },
            { status: 500 }
        )
    }
}
