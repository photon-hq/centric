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

async function processFile(file: File): Promise<{ fileName: string; originalName: string; type: string; message: string }> {
  const safeBase = path.basename(file.name)
  const fileExtension = path.extname(safeBase).toLowerCase()
  const baseName = path.basename(safeBase, fileExtension)

  const isTextFile = ALLOWED_TEXT_EXTENSIONS.includes(fileExtension)
  const isImageFile = ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension)
  const isPDFFile = ALLOWED_PDF_EXTENSIONS.includes(fileExtension)

  if (!isTextFile && !isImageFile && !isPDFFile) {
    throw new Error(`Unsupported file type: ${fileExtension}. Supported types: ${[...ALLOWED_TEXT_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_PDF_EXTENSIONS].join(', ')}`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let textContent: string
  let finalFileName: string

  if (isTextFile) {
    textContent = buffer.toString('utf-8')
    finalFileName = `uploaded_${safeBase}`
  } else if (isImageFile) {
    console.log(`Extracting text from image: ${safeBase}`)
    const mimeType = file.type || 'image/jpeg'
    textContent = await extractTextFromImage(buffer, mimeType)
    textContent = `# ${baseName}\n\nSource: Uploaded image (${safeBase})\nExtracted using OpenAI Vision\n\n${textContent}`
    finalFileName = `uploaded_${baseName}.md`
  } else {
    console.log(`Extracting text from PDF: ${safeBase}`)
    textContent = await extractTextFromPDF(buffer)
    textContent = `# ${baseName}\n\nSource: Uploaded PDF (${safeBase})\nExtracted using OpenAI\n\n${textContent}`
    finalFileName = `uploaded_${baseName}.md`
  }

  const filePath = path.join(DOCUMENTS_DIR, finalFileName)
  await writeFile(filePath, textContent, 'utf-8')
  console.log(`✅ File uploaded and processed: ${finalFileName}`)

  return {
    fileName: finalFileName,
    originalName: safeBase,
    type: isTextFile ? 'text' : isImageFile ? 'image' : 'pdf',
    message: isTextFile ? 'Text file uploaded successfully' : `Content extracted from ${isImageFile ? 'image' : 'PDF'} and saved as markdown`
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('file') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    await mkdir(DOCUMENTS_DIR, { recursive: true })

    const results = []
    const errors = []

    for (const file of files) {
      try {
        results.push(await processFile(file))
      } catch (err: any) {
        errors.push({ file: path.basename(file.name), error: err.message })
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'All files failed to process', details: errors },
        { status: 400 }
      )
    }

    const singleResult = results[0]
    return NextResponse.json({
      success: true,
      fileName: singleResult.fileName,
      originalName: singleResult.originalName,
      type: singleResult.type,
      files: results,
      errors: errors.length > 0 ? errors : undefined,
      message: results.length === 1
        ? singleResult.message
        : `Successfully processed ${results.length} file(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
    })

  } catch (error: any) {
    console.error('Error processing upload:', error)
    return NextResponse.json(
      { error: 'Failed to process upload', details: error.message },
      { status: 500 }
    )
  }
}
