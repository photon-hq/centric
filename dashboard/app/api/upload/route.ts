import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import OpenAI from 'openai'
import * as fsSync from 'fs'

const DOCUMENTS_DIR = path.join(process.cwd(), '..', 'documents')
const ALLOWED_TEXT_EXTENSIONS = ['.txt', '.md', '.markdown']
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const ALLOWED_PDF_EXTENSIONS = ['.pdf']

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

// Helper to extract text from image using OpenAI Vision
async function extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const base64Image = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64Image}`
  
  const response = await openai.chat.completions.create({
    model: process.env.MODEL || 'gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text content from this image. Include all visible text, maintaining structure and formatting as much as possible. If there are tables, preserve the table structure. If this is a document or form, extract all fields and their values.'
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ],
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    max_completion_tokens: parseInt(process.env.MAX_COMPLETION_TOKENS || '5000')
  })
  
  return response.choices[0].message.content || ''
}

// Helper to detect if PDF is image-based (simple heuristic)
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // For PDFs, we'll use OpenAI to extract text from each page as an image
  // This is a simplified version - in production you might want to use pdf-parse first
  // and only fall back to vision API if no text is found
  
  // For now, we'll treat all PDFs as potentially having images
  // Convert first page to image representation using vision API
  const base64Pdf = pdfBuffer.toString('base64')
  const dataUrl = `data:application/pdf;base64,${base64Pdf}`
  
  const response = await openai.chat.completions.create({
    model: process.env.MODEL || 'gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text content from this PDF document. Include all visible text, maintaining structure and formatting. If there are multiple pages, include content from all pages. If there are tables or forms, preserve their structure.'
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ],
    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
    max_completion_tokens: parseInt(process.env.MAX_COMPLETION_TOKENS || '5000')
  })
  
  return response.choices[0].message.content || ''
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const fileName = file.name
    const fileExtension = path.extname(fileName).toLowerCase()
    const baseName = path.basename(fileName, fileExtension)
    
    // Validate file type
    const isTextFile = ALLOWED_TEXT_EXTENSIONS.includes(fileExtension)
    const isImageFile = ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension)
    const isPDFFile = ALLOWED_PDF_EXTENSIONS.includes(fileExtension)
    
    if (!isTextFile && !isImageFile && !isPDFFile) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileExtension}. Supported types: ${[...ALLOWED_TEXT_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_PDF_EXTENSIONS].join(', ')}` },
        { status: 400 }
      )
    }

    // Ensure documents directory exists
    await mkdir(DOCUMENTS_DIR, { recursive: true })

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer())
    
    let textContent: string
    let finalFileName: string

    if (isTextFile) {
      // Text file - just read and save
      textContent = buffer.toString('utf-8')
      finalFileName = `uploaded_${fileName}`
    } else if (isImageFile) {
      // Image file - use OpenAI Vision to extract text
      console.log(`Extracting text from image: ${fileName}`)
      const mimeType = file.type || 'image/jpeg'
      textContent = await extractTextFromImage(buffer, mimeType)
      
      // Add metadata header
      textContent = `# ${baseName}\n\nSource: Uploaded image (${fileName})\nExtracted using OpenAI Vision\n\n${textContent}`
      finalFileName = `uploaded_${baseName}.md`
    } else if (isPDFFile) {
      // PDF file - extract text
      console.log(`Extracting text from PDF: ${fileName}`)
      textContent = await extractTextFromPDF(buffer)
      
      // Add metadata header
      textContent = `# ${baseName}\n\nSource: Uploaded PDF (${fileName})\nExtracted using OpenAI\n\n${textContent}`
      finalFileName = `uploaded_${baseName}.md`
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Save to documents folder
    const filePath = path.join(DOCUMENTS_DIR, finalFileName)
    await writeFile(filePath, textContent, 'utf-8')
    
    console.log(`✅ File uploaded and processed: ${finalFileName}`)

    return NextResponse.json({
      success: true,
      fileName: finalFileName,
      originalName: fileName,
      type: isTextFile ? 'text' : isImageFile ? 'image' : 'pdf',
      extractedText: textContent.length > 500 ? textContent.substring(0, 500) + '...' : textContent,
      message: isTextFile 
        ? 'Text file uploaded successfully'
        : `Content extracted from ${isImageFile ? 'image' : 'PDF'} and saved as markdown`
    })

  } catch (error: any) {
    console.error('Error processing upload:', error)
    return NextResponse.json(
      { error: 'Failed to process upload', details: error.message },
      { status: 500 }
    )
  }
}
