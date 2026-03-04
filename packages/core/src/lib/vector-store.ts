/**
 * Document Vector Store
 * Handles document loading, embedding generation, and semantic search
 * for the customer support knowledge base
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type OpenAI from 'openai'
import type { Document, SearchResult, EmbeddedDocument } from '../types/index.js'
import { VectorStoreError } from '../errors/index.js'
import { logger } from '../logger/index.js'

export class DocumentVectorStore {
  private documents: EmbeddedDocument[] = []
  private documentsPath: string
  private embeddingsPath: string
  private openai: OpenAI
  private embeddingModel: string

  constructor(documentsPath: string, openai: OpenAI, embeddingModel: string = 'text-embedding-3-small') {
    this.documentsPath = documentsPath
    this.embeddingsPath = path.join(path.dirname(documentsPath), 'embeddings')
    this.openai = openai
    this.embeddingModel = embeddingModel
  }

  /**
   * Initialize the vector store by loading and embedding all documents
   */
  async initialize(): Promise<void> {
    logger.info({ documentsPath: this.documentsPath }, 'Loading documents')

    // Ensure embeddings directory exists
    await fs.mkdir(this.embeddingsPath, { recursive: true })

    const docs = await this.loadDocuments()
    logger.info({ count: docs.length }, 'Found documents')

    if (docs.length === 0) {
      logger.warn('No documents found. Add .txt, .md, or .pdf files to the documents folder')
      return
    }

    // Load or generate embeddings
    let cacheHits = 0
    let cacheGenerates = 0

    for (const doc of docs) {
      const cachedEmbedding = await this.loadCachedEmbedding(doc)

      if (cachedEmbedding) {
        this.documents.push({ ...doc, embedding: cachedEmbedding })
        cacheHits++
      } else {
        const embedding = await this.generateEmbedding(doc.content)
        this.documents.push({ ...doc, embedding })
        await this.saveCachedEmbedding(doc, embedding)
        cacheGenerates++
      }
    }

    logger.info(
      { cacheHits, cacheGenerates, total: this.documents.length },
      'Embeddings ready'
    )
  }

  /**
   * Load all documents from the documents folder
   */
  private async loadDocuments(): Promise<Document[]> {
    const documents: Document[] = []

    try {
      const files = await fs.readdir(this.documentsPath)

      for (const filename of files) {
        const filePath = path.join(this.documentsPath, filename)
        const stat = await fs.stat(filePath)

        if (!stat.isFile()) continue

        const ext = path.extname(filename).toLowerCase()

        // Support common text formats
        if (['.txt', '.md', '.markdown'].includes(ext)) {
          const content = await fs.readFile(filePath, 'utf-8')

          // Split large documents into chunks
          const chunks = this.chunkDocument(content, filename)

          for (let i = 0; i < chunks.length; i++) {
            documents.push({
              id: `${filename}_chunk_${i}`,
              content: chunks[i],
              metadata: {
                filename,
                type: ext,
                lastModified: stat.mtime
              }
            })
          }
        } else if (ext === '.pdf') {
          logger.warn({ filename }, 'Skipping PDF (PDF parsing not yet implemented)')
        }
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.info('Creating documents folder')
        await fs.mkdir(this.documentsPath, { recursive: true })
      } else {
        throw VectorStoreError('Error loading documents', { documentsPath: this.documentsPath }, error as Error)
      }
    }

    return documents
  }

  /**
   * Split a document into smaller chunks for better embedding quality
   */
  private chunkDocument(content: string, filename: string): string[] {
    const maxChunkSize = 1000 // characters
    const overlap = 200 // characters of overlap between chunks

    content = content.trim()

    if (content.length <= maxChunkSize) {
      return [content]
    }

    const chunks: string[] = []
    let start = 0

    while (start < content.length) {
      let end = start + maxChunkSize

      // Try to break at sentence boundary
      if (end < content.length) {
        const sentenceEnd = content.lastIndexOf('. ', end)
        if (sentenceEnd > start + maxChunkSize / 2) {
          end = sentenceEnd + 1
        } else {
          const spaceIndex = content.lastIndexOf(' ', end)
          if (spaceIndex > start) {
            end = spaceIndex
          }
        }
      }

      chunks.push(content.slice(start, end).trim())
      start = end - overlap
    }

    return chunks
  }

  /**
   * Get cache file path for a document
   */
  private getCacheFilePath(doc: Document): string {
    const safeId = doc.id.replace(/[^a-z0-9_-]/gi, '_')
    return path.join(this.embeddingsPath, `${safeId}.json`)
  }

  /**
   * Load cached embedding for a document
   */
  private async loadCachedEmbedding(doc: Document): Promise<number[] | null> {
    try {
      const cacheFile = this.getCacheFilePath(doc)
      const cacheData = await fs.readFile(cacheFile, 'utf-8')
      const cached = JSON.parse(cacheData)

      const cachedTime = new Date(cached.lastModified)
      const docTime = doc.metadata.lastModified

      if (docTime > cachedTime) {
        return null
      }

      if (cached.contentHash !== this.hashContent(doc.content)) {
        return null
      }

      return cached.embedding
    } catch (error) {
      return null
    }
  }

  /**
   * Save embedding to cache
   */
  private async saveCachedEmbedding(doc: Document, embedding: number[]): Promise<void> {
    try {
      const cacheFile = this.getCacheFilePath(doc)
      const cacheData = {
        id: doc.id,
        embedding,
        lastModified: doc.metadata.lastModified.toISOString(),
        contentHash: this.hashContent(doc.content),
        filename: doc.metadata.filename
      }

      await fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8')
    } catch (error) {
      logger.warn({ docId: doc.id, error }, 'Failed to cache embedding')
    }
  }

  /**
   * Simple hash function for content validation
   */
  private hashContent(content: string): string {
    const len = content.length
    const first = content.substring(0, 50)
    const last = content.substring(Math.max(0, len - 50))
    return `${len}_${first}_${last}`
  }

  /**
   * Generate embedding for a text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      })

      return response.data[0].embedding
    } catch (error) {
      throw VectorStoreError('Error generating embedding', { model: this.embeddingModel }, error as Error)
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Search for relevant documents using semantic similarity
   */
  async search(query: string, topK: number = 3): Promise<SearchResult[]> {
    if (this.documents.length === 0) {
      return []
    }

    const queryEmbedding = await this.generateEmbedding(query)

    const results = this.documents.map((doc) => ({
      document: doc,
      content: doc.content,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }))

    results.sort((a, b) => b.similarity - a.similarity)

    return results.slice(0, topK)
  }

  /**
   * Get the total number of documents loaded
   */
  getDocumentCount(): number {
    return this.documents.length
  }

  /**
   * Clear the embeddings cache
   */
  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.embeddingsPath)
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.embeddingsPath, file))
        }
      }
      logger.info('Cleared embeddings cache')
    } catch (error) {
      logger.error({ error }, 'Error clearing cache')
    }
  }

  /**
   * Reload documents (useful for hot-reloading)
   */
  async reload(clearCache: boolean = false): Promise<void> {
    if (clearCache) {
      await this.clearCache()
    }
    this.documents = []
    await this.initialize()
  }
}
