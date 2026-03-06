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

/**
 * Returns true if the query is asking for a broad catalog/listing of all products or services.
 * Used to widen the search (higher topK, lower threshold) so the LLM sees a full cross-section.
 */
export function isCatalogQuery(query: string): boolean {
  return (
    /\b(all|every|full|complete)\b.{0,30}(product|tool|service|offer|kit|sdk|package|plan|feature)/i.test(query) ||
    /what.{0,20}(do you|does .{1,30}|you all).{0,20}(offer|have|make|sell|build|provide)/i.test(query) ||
    /what.{0,20}(product|tool|service|kit|sdk|package|plan)s?\b.{0,30}(available|offer|have|support)/i.test(query) ||
    /list.{0,20}(product|tool|service|kit|sdk|package|plan|offer|feature)/i.test(query) ||
    /\b(catalog|catalogue|lineup|portfolio|suite|offerings)\b/i.test(query) ||
    // Common ways users ask for everything available
    /what (do you|can i|are my) (have|get|buy|choose|pick|order)/i.test(query) ||
    /what('?s| is) (available|on offer)/i.test(query) ||
    /\bshow me (everything|all|your products|your services|what you have)/i.test(query) ||
    /\b(pricing overview|price list|full pricing|all pricing|all plans)\b/i.test(query) ||
    /what are (my |the |your )?(options|choices|plans|packages|tiers)/i.test(query)
  )
}

/**
 * Returns true if the query is a short vague follow-up that references prior context.
 * Examples: "what about pricing?", "and the advanced version?", "tell me more", "can it also X?"
 */
export function isVagueFollowUp(query: string): boolean {
  // Raised from 12 to 20 ,  longer follow-ups like "what about the pricing on that one?" still need context
  if (query.trim().split(/\s+/).length > 20) return false
  return (
    /^(what|how|tell|can|does|is|are|do|and|but|what about|how about|any|does it|can it)\b/i.test(query.trim()) &&
    !/\b(install|setup|configure|create|build|deploy|integrate|difference|compare|vs)\b/i.test(query)
  )
}

/**
 * Returns true if two matched halves of an "and" split look like they are joining two
 * independent clauses (compound question) rather than two nouns in a comparison.
 * Heuristic: a clause has a verb; a noun phrase generally does not.
 */
function hasVerb(text: string): boolean {
  return /\b(is|are|do|does|can|how|what|install|get|set|use|work|support|run|build|create|configure|need|want|have|find)\b/i.test(text)
}

/**
 * Parse a user query into multiple sub-queries.
 *
 * Handles three patterns:
 * 1. Comparison  ,  "X vs Y", "difference between X and Y", "compare X and Y"
 *    → returns [original, X, Y]
 * 2. Compound question ,  "how do I install X and what are the requirements?"
 *    → returns [original, half1, half2]
 * 3. Everything else ,  returns [original]
 */
export function buildSearchQueries(query: string): string[] {
  // 1. Comparison patterns (checked first, before compound split)
  const comparisonPatterns = [
    /\bdifferences?\s+between\s+(.+?)\s+and\s+(.+)/i,
    /\bcompare\s+(.+?)\s+(?:and|to|vs\.?|versus)\s+(.+)/i,
    /(.+?)\s+vs\.?\s+(.+)/i,
    /(.+?)\s+versus\s+(.+)/i,
  ]

  for (const pattern of comparisonPatterns) {
    const match = query.match(pattern)
    if (match) {
      const a = match[1].trim()
      const b = match[2].trim()
      if (a.length > 2 && b.length > 2) {
        return [...new Set([query, a, b])]
      }
    }
  }

  // 2. Compound question: two independent clauses joined by " and "
  // Only split when both halves look like independent questions/clauses (contain a verb)
  const andMatch = query.match(/^(.{8,}?)\s+and\s+(.{8,})$/i)
  if (andMatch) {
    const a = andMatch[1].trim()
    const b = andMatch[2].trim()
    if (hasVerb(a) && hasVerb(b)) {
      return [...new Set([query, a, b])]
    }
  }

  return [query]
}

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
  async search(query: string, topK: number = 3, minSimilarity: number = 0): Promise<SearchResult[]> {
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

    const filtered = minSimilarity > 0 ? results.filter((r) => r.similarity >= minSimilarity) : results
    return filtered.slice(0, topK)
  }

  /**
   * Search using multiple queries and merge results, deduplicating by chunk.
   * Useful for comparison queries where multiple topics need independent coverage.
   */
  async searchMulti(queries: string[], topKPerQuery: number = 5, minSimilarity: number = 0): Promise<SearchResult[]> {
    if (this.documents.length === 0) return []

    const allResults = await Promise.all(queries.map((q) => this.search(q, topKPerQuery, minSimilarity)))

    // Merge, keeping best similarity score per unique chunk
    const seen = new Map<string, SearchResult>()
    for (const results of allResults) {
      for (const result of results) {
        const id = result.document.id
        const existing = seen.get(id)
        if (!existing || result.similarity > existing.similarity) {
          seen.set(id, result)
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity)
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
