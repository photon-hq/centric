import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DOCUMENTS_DIR = path.join(process.cwd(), '..', 'documents')
const EMBEDDINGS_DIR = path.join(process.cwd(), '..', 'embeddings')

export async function POST() {
  try {
    // Read all files in documents directory
    const files = await fs.readdir(DOCUMENTS_DIR)
    
    // Only delete files that start with 'scraped_' to preserve manual documents
    let deletedCount = 0
    for (const file of files) {
      if (file.startsWith('scraped_')) {
        await fs.unlink(path.join(DOCUMENTS_DIR, file))
        deletedCount++
      }
    }

    // Clear embeddings cache to force regeneration
    try {
      const embeddingFiles = await fs.readdir(EMBEDDINGS_DIR)
      for (const file of embeddingFiles) {
        if (file.startsWith('scraped_')) {
          await fs.unlink(path.join(EMBEDDINGS_DIR, file))
        }
      }
    } catch (error) {
      // Embeddings dir might not exist yet
      console.log('No embeddings to clear')
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount 
    })
  } catch (error) {
    console.error('Error clearing documents:', error)
    return NextResponse.json(
      { error: 'Failed to clear documents' },
      { status: 500 }
    )
  }
}
