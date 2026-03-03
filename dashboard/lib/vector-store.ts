/**
 * Document Vector Store
 * 
 * Handles document loading, embedding generation, and semantic search
 * for the customer support knowledge base
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type OpenAI from 'openai'

export interface Document {
    id: string
    content: string
    metadata: {
        filename: string
        type: string
        lastModified: Date
    }
}

export interface SearchResult {
    document: Document
    content: string
    similarity: number
}

interface EmbeddedDocument extends Document {
    embedding: number[]
}

export class DocumentVectorStore {
    private documents: EmbeddedDocument[] = []
    private documentsPath: string
    private embeddingsPath: string
    private openai: OpenAI
    
    constructor(documentsPath: string, openai: OpenAI) {
        this.documentsPath = documentsPath
        this.embeddingsPath = path.join(path.dirname(documentsPath), 'embeddings')
        this.openai = openai
    }
    
    /**
     * Initialize the vector store by loading and embedding all documents
     */
    async initialize(): Promise<void> {
        console.log(`   Loading documents from: ${this.documentsPath}`)
        
        // Ensure embeddings directory exists
        await fs.mkdir(this.embeddingsPath, { recursive: true })
        
        const docs = await this.loadDocuments()
        console.log(`   Found ${docs.length} documents`)
        
        if (docs.length === 0) {
            console.log('   ⚠️  No documents found. Add .txt, .md, or .pdf files to the documents folder.')
            return
        }
        
        // Load or generate embeddings
        console.log('   Loading embeddings from cache...')
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
        
        if (cacheHits > 0) {
            console.log(`   ✓ Loaded ${cacheHits} cached embeddings`)
        }
        if (cacheGenerates > 0) {
            console.log(`   ✓ Generated ${cacheGenerates} new embeddings`)
        }
        console.log(`   ✓ Total: ${this.documents.length} embedded documents`)
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
                }
                // PDF support (basic - would need pdf-parse for full support)
                else if (ext === '.pdf') {
                    console.log(`   ⚠️  Skipping PDF: ${filename} (PDF parsing not yet implemented)`)
                    // TODO: Add PDF parsing with pdf-parse library
                }
            }
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                console.log('   Creating documents folder...')
                await fs.mkdir(this.documentsPath, { recursive: true })
            } else {
                console.error('   Error loading documents:', error)
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
        
        // Clean up the content
        content = content.trim()
        
        // If content is small enough, return as single chunk
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
                    // Try to break at word boundary
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
        // Create a safe filename from document id
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
            
            // Verify the cache is still valid (content hasn't changed)
            const cachedTime = new Date(cached.lastModified)
            const docTime = doc.metadata.lastModified
            
            // If document is newer than cache, regenerate
            if (docTime > cachedTime) {
                return null
            }
            
            // Verify content hash matches (simple check)
            if (cached.contentHash !== this.hashContent(doc.content)) {
                return null
            }
            
            return cached.embedding
        } catch (error) {
            // Cache file doesn't exist or is invalid
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
            console.error(`   Warning: Failed to cache embedding for ${doc.id}:`, error)
        }
    }
    
    /**
     * Simple hash function for content validation
     */
    private hashContent(content: string): string {
        // Simple hash based on length and first/last characters
        // Good enough for cache validation without adding dependencies
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
                model: 'text-embedding-3-small',
                input: text,
            })
            
            return response.data[0].embedding
        } catch (error) {
            console.error('Error generating embedding:', error)
            throw error
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
        
        // Generate embedding for the query
        const queryEmbedding = await this.generateEmbedding(query)
        
        // Calculate similarity scores
        const results = this.documents.map(doc => ({
            document: doc,
            content: doc.content,
            similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }))
        
        // Sort by similarity and return top K
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
            console.log('   ✓ Cleared embeddings cache')
        } catch (error) {
            console.error('   Error clearing cache:', error)
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
