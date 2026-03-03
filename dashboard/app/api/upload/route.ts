import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'
import * as fsSync from 'fs'

const DOCUMENTS_DIR = path.join(process.cwd(), '..', 'documents')
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.markdown', // Text
  '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
  '.pdf', // PDF
  '.csv', '.json', '.xml', // Data
  '.docx' // Documents
]

// Load environment variables
function loadParentEnvSync() {
  const candidates = [
    path.join(process.cwd(), '..', '.env.local'),
    path.join(process.cwd(), '..', '.env')
  ]

  for (const p of candidates) {
    if (fsSync.existsSync(p)) {
      try {
        const data = fsSync.readFileSync(p, 'utf8')
        data.split(/\r?\n/).forEach(line => {
          const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/)
          if (!m) return
          let key = m[1]
          let val = m[2] || ''
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (process.env[key] === undefined) {
            process.env[key] = val
          }
        })
        break
      } catch (e) {
        // ignore
      }
    }
  }
}

loadParentEnvSync()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper to extract text from file using OpenAI
async function extractContent(buffer: Buffer, mimeType: string, extension: string): Promise<string> {
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)
  
  // For text-based files, try to read directly first
  if (['.txt', '.md', '.markdown', '.csv', '.json', '.xml'].includes(extension)) {
    return buffer.toString('utf-8')
  }

  // For complex files (PDF, Images, DOCX), use OpenAI Vision/File processing
  const base64Data = buffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  const prompt = isImage 
    ? 'Extract all text content from this image. Include all visible text, maintaining structure and formatting.' 
    : 'Extract all text content from this document. Include all visible text, maintaining structure and formatting. If there are tables, preserve the structure.'

  const response = await openai.chat.completions.create({
    model: process.env.MODEL || 'gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: dataUrl }
          }
        ]
      }
    ],
    temperature: 0.3,
    max_completion_tokens: 4000
  })
  
  return response.choices[0].message.content || ''
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('file') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const results = []
    
    // Ensure documents directory exists
    await mkdir(DOCUMENTS_DIR, { recursive: true })

    for (const file of files) {
      const fileName = file.name
      const fileExtension = path.extname(fileName).toLowerCase()
      const baseName = path.basename(fileName, fileExtension)
      
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        results.push({ 
          fileName, 
          status: 'error', 
          message: `Unsupported file type: ${fileExtension}` 
        })
        continue
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || 'application/octet-stream'
        
        console.log(`Processing file: ${fileName} (${mimeType})`)
        const textContent = await extractContent(buffer, mimeType, fileExtension)
        
        // Add metadata header
        const finalContent = `# ${baseName}\n\nSource: Uploaded file (${fileName})\nType: ${fileExtension}\n\n${textContent}`
        const finalFileName = `uploaded_${baseName}.md`
        
        // Save to documents folder
        const filePath = path.join(DOCUMENTS_DIR, finalFileName)
        await writeFile(filePath, finalContent, 'utf-8')
        
        results.push({
          fileName,
          savedAs: finalFileName,
          status: 'success'
        })
      } catch (error: any) {
        console.error(`Error processing ${fileName}:`, error)
        results.push({
          fileName,
          status: 'error',
          message: error.message
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    
    return NextResponse.json({
      success: true,
      results,
      message: `Successfully processed ${successCount} of ${files.length} files`
    })

  } catch (error: any) {
    console.error('Error processing upload:', error)
    return NextResponse.json(
      { error: 'Failed to process upload', details: error.message },
      { status: 500 }
    )
  }
}
