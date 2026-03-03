# Photon Customer Support Dashboard 🌐

A Next.js web dashboard for testing the AI customer support agent in your browser. This provides the same intelligent features as the iMessage agent (RAG, product catalog, negotiation) but through a clean web interface.

**NEW**: Includes an automatic website scraper to build your knowledge base!

## Features ✨

### 🎨 Modern Web Interface
- Beautiful, responsive chat UI built with React and Tailwind CSS
- Real-time message streaming
- Quick action buttons for common queries
- Dark mode support
- Mobile-friendly design

### 🔧 Knowledge Base Configuration **(NEW!)**
- **Automatic Website Scraper**: Crawl your entire website to build the knowledge base
- **Subdomain Support**: Optionally scrape docs.example.com, blog.example.com, etc.
- **Real-time Progress**: Watch as pages are scraped
- **Smart Content Extraction**: Removes navigation, ads, and non-content elements
- **One-click Setup**: Enter your URL and click "Start Scraping"

### 🤖 Same AI Capabilities
- **RAG Knowledge Base**: Searches tax documentation with semantic embeddings
- **Product Catalog**: 8 tax services with fixed and negotiable pricing
- **Smart Negotiation**: Handles price discussions within configured ranges
- **Conversation Memory**: Maintains context across messages

### ⚡ Quick Testing
- No iMessage setup required
- Test the agent directly in your browser
- See responses instantly
- Perfect for development and demos

## Quick Start 🚀

### 1. Set Up Environment

```bash
cd dashboard

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 2. Run Development Server

```bash
bun dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

### 3. Start Chatting

The dashboard will:
- Load documents from `./documents` folder
- Generate/cache embeddings in `./embeddings` folder
- Initialize the AI agent
- Display a chat interface

Try asking:
- "What documents do I need to file my taxes?"
- "How much does individual tax filing cost?"
- "That's too expensive, can you do better?"
- "When is the tax deadline?"

### 4. Configure Your Knowledge Base (Optional)

Want to automatically build your knowledge base from your website?

1. **Click "🔧 Configure Knowledge Base"** in the top-right corner
2. **Enter your website URL** (e.g., `https://example.com`)
3. **Enable subdomain scraping** if you have docs on `docs.example.com`, `blog.example.com`, etc.
4. **Set max crawl depth** (recommended: 2-5)
5. **Click "🚀 Start Scraping"**

The scraper will:
- ✅ Crawl your entire website
- ✅ Extract clean text content from each page
- ✅ Save to `documents/scraped_*.md` files
- ✅ Show real-time progress
- ✅ Update the AI agent's knowledge automatically

**Configuration is saved** in `../config/scraper.config.json` with a special comment format that documents itself.

**To clear scraped content**: Use the "🗑️ Clear All Scraped Documents" button (preserves manual documents)

## How It Works 🔍

```
Browser (React)
    ↓
  POST /api/chat
    ↓
Next.js API Route
    ├── DocumentVectorStore (RAG)
    ├── ProductCatalog
    └── OpenAI (GPT-4o)
    ↓
  Response
    ↓
Chat Interface Updates
```

### Architecture

```
dashboard/
├── app/
│   ├── api/chat/route.ts      # Chat API endpoint
│   ├── page.tsx               # Home page
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── components/
│   └── ChatInterface.tsx      # Chat UI component
├── lib/
│   ├── vector-store.ts        # RAG implementation
│   └── product-catalog.ts     # Product management
├── documents/                  # Knowledge base
│   ├── tax-filing-guide.md
│   ├── faqs.md
│   └── deadlines.md
└── embeddings/                 # Cached embeddings
```

## API Endpoint 📡

### POST /api/chat

Send messages to the AI agent:

```typescript
// Request
{
  "message": "How much does tax filing cost?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}

// Response
{
  "response": "Our Individual Tax Filing service is $299..."
}
```

## Development 🛠️

### File Structure

- **`app/page.tsx`**: Main dashboard page with layout
- **`components/ChatInterface.tsx`**: React chat component
- **`app/api/chat/route.ts`**: AI agent API handler
- **`lib/`**: Shared modules (vector store, product catalog)

### Adding Documents

Add `.txt` or `.md` files to the `documents/` folder. The agent will:
1. Automatically load them on next API call
2. Split into chunks
3. Generate embeddings
4. Cache for future use

### Modifying Products

Edit `lib/product-catalog.ts` to add/modify products:

```typescript
{
  id: 'my-service',
  name: 'My Service',
  price: 199,
  negotiable: true,
  lowestNegotiationPrice: 149,
  features: ['Feature 1', 'Feature 2'],
  keywords: ['keyword1', 'keyword2']
}
```

### Adjusting AI Behavior

Edit `app/api/chat/route.ts`:

```typescript
// System prompt
const SYSTEM_PROMPT = `Your custom prompt...`

// Model settings
model: 'gpt-4o',
temperature: 0.7,
max_tokens: 1000

// Negotiation discount
const discountPercentage = 0.15  // 15% off
```

## Production Deployment 🚀

### Build for Production

```bash
bun run build
bun run start
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable in Vercel dashboard:
# OPENAI_API_KEY=sk-your-key
```

### Environment Variables

Required:
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `NEXT_PUBLIC_MODEL`: Override GPT model (default: gpt-4o)

### Considerations

- **Embeddings Cache**: Stored locally in `embeddings/` folder
- **Session Management**: Currently in-memory (use Redis for production)
- **API Rate Limits**: Consider caching responses
- **Document Updates**: Auto-detects changes via file modification time

## Customization 🎨

### Styling

The dashboard uses Tailwind CSS. Customize in:
- `tailwind.config.ts`: Theme colors, fonts, etc.
- `app/globals.css`: Global styles
- Components: Inline Tailwind classes

### UI Components

The chat interface is fully customizable:
- Message bubbles
- Quick action buttons
- Loading indicators
- Header/footer

Edit `components/ChatInterface.tsx` to modify the UI.

### Branding

Update branding in:
- `app/layout.tsx`: Page title and meta
- `app/page.tsx`: Header content
- `components/ChatInterface.tsx`: Chat header

## Troubleshooting 🔧

### "Cannot find module './lib/vector-store'"
→ Make sure to run `cp -r ../lib .` from dashboard directory

### "OPENAI_API_KEY is required"
→ Create `.env.local` file with your API key

### Embeddings not loading
→ First API call generates embeddings (may be slow). Subsequent calls use cache.

### Port 3000 already in use
→ Use different port: `PORT=3001 bun dev`

### API response timeout
→ Increase timeout in `next.config.js` or optimize document chunks

## Comparison: Dashboard vs iMessage 📊

| Feature | Dashboard | iMessage Agent |
|---------|-----------|----------------|
| Setup | Browser only | Requires Full Disk Access |
| Testing | Instant | Need phone number |
| UI | Modern web chat | Native iMessage |
| Deployment | Web server | Mac required |
| Best For | Development, demos | Production customer support |

## Tips 💡

### Development Workflow

1. **Test in Dashboard**: Quickly iterate on prompts and logic
2. **Refine Responses**: Adjust based on dashboard testing
3. **Deploy to iMessage**: Once satisfied, use for real customers

### Quick Actions

Add more quick action buttons in `ChatInterface.tsx`:

```typescript
<button onClick={() => handleQuickPrompt('Your prompt')}>
  🎯 Button Text
</button>
```

### Monitoring

View API logs in the terminal where you run `bun dev`:

```
✅ Agent initialized with 15 documents
POST /api/chat 200 in 1234ms
```

## Scripts 📜

```bash
# Development
bun dev          # Start dev server (http://localhost:3000)

# Production
bun build        # Build for production
bun start        # Start production server

# Linting
bun lint         # Run ESLint
```

## Tech Stack 🏗️

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o
- **Runtime**: Bun (or Node.js)
- **RAG**: Custom vector store with embeddings

## Future Enhancements 🔮

- [ ] **Session Management**: Persistent conversations with Redis
- [ ] **Admin Panel**: View all conversations, analytics
- [ ] **Multi-user Support**: Handle multiple concurrent users
- [ ] **Streaming Responses**: Real-time token streaming
- [ ] **Message History Export**: Download conversation logs
- [ ] **Custom Theming**: User-selectable themes
- [ ] **Voice Input**: Speech-to-text support
- [ ] **File Uploads**: Let users upload tax documents
- [ ] **WebSocket Support**: Real-time bidirectional communication

## Related Files 📁

- **Main Agent**: `../tax-support-agent.ts` (iMessage version)
- **Documentation**: `../README.md`
- **Examples**: `../EXAMPLES.md`

---

**Built with ❤️ by Anmol** | Powered by OpenAI & Next.js
