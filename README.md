# Photon Customer Support

An AI-powered customer support platform built for iMessage. Responds to customer texts automatically, looks up orders and accounts via MCP tools, negotiates pricing, escalates to human agents in Slack, and builds its knowledge base from your website or uploaded documents.

**Works for any business.** Every aspect ,  company identity, products, pricing, SOPs, AI behavior, human handoff ,  is configured through JSON files. No code changes required to deploy for a new company.

---

## What It Does

- **Responds to iMessages** from customers, automatically, 24/7
- **Web chat dashboard** for testing and configuration without a Mac or iMessage
- **RAG knowledge base** ,  scrapes your website or accepts uploaded documents; AI answers from your content
- **Intelligent multi-query search** ,  automatically expands comparison, compound, catalog, and follow-up queries into multiple targeted searches so the AI always finds the right documents
- **Product catalog** with fixed and negotiable pricing; handles discounts within configured limits
- **Standard Operating Procedures (SOPs)** ,  inject step-by-step instructions the AI follows for specific scenarios
- **MCP tool integration** ,  connect external APIs (order systems, CRMs, databases) so the AI can look things up in real time
- **Human handoff to Slack** ,  detects escalation keywords, posts to a Slack channel, relays replies back to the customer, re-enables AI when the ticket is resolved
- **Auto knowledge base updates** ,  scheduled re-scraping keeps content fresh
- **GitHub scraping** ,  indexes your org's repos, members, and READMEs via the GitHub API

---

## Prerequisites

| Requirement | Notes |
|---|---|
| macOS | Required for iMessage integration only. Dashboard works on any OS. |
| [Bun](https://bun.sh) | `curl -fsSL https://bun.sh/install \| bash` |
| OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| iMessage signed in on Mac | Settings → Messages → enable iMessage |
| Full Disk Access for your terminal | System Settings → Privacy & Security → Full Disk Access → add Terminal/IDE |

Slack integration and GitHub scraping are optional.

---

## Quick Start

```bash
git clone <repository-url>
cd PhotonCustomerSupport

# Add your OpenAI key
cp .env.example .env.local
# Edit .env.local: OPENAI_API_KEY=sk-...

# Install dependencies
bun install

# Launch the dashboard (opens http://localhost:3000)
./start.sh
```

From the dashboard:
1. Go to **Config → Knowledge Base** and paste your website URL, then click **Start Scraping**
2. Edit **Config → Company** to set your business name, products, and SOPs
3. Open the **Chat** tab and test your agent
4. When satisfied, click **Launch iMessage Agent** to go live

---

## Repository Layout

```
PhotonCustomerSupport/
├── config/                     # All runtime configuration (JSON)
│   ├── company.json            # Company identity, greeting, human handoff
│   ├── products.json           # Product catalog with pricing
│   ├── features.json           # Feature flags (negotiation, MCP, SOPs, KB)
│   ├── ai.json                 # Model, temperature, token limits, embeddings
│   ├── sops.json               # Standard Operating Procedures
│   ├── mcp-config.json         # MCP server connections
│   └── scraper.config.json     # Web scraper settings (auto-managed by dashboard)
├── documents/                  # Knowledge base ,  add .txt or .md files here
├── embeddings/                 # Auto-generated embedding cache (do not edit)
├── packages/
│   ├── agent/                  # iMessage agent (bun run packages/agent/src/index.ts)
│   ├── core/                   # Shared library: config loader, vector store, MCP, prompts
│   └── imessage-kit/           # iMessage SDK (polling, sending, AppleScript)
├── dashboard/                  # Next.js web dashboard (port 3000)
│   └── app/api/
│       ├── chat/               # AI chat endpoint (same pipeline as iMessage agent)
│       ├── scrape/             # Web scraper + auto-update scheduler
│       ├── upload/             # File upload (txt, md, images via OCR, PDFs)
│       ├── documents/          # Document list and management
│       ├── config/             # Read/write config files
│       ├── sops/               # SOP CRUD
│       ├── mcp/                # MCP server management and tool testing
│       ├── imessage/           # Start/stop iMessage agent from dashboard
│       └── slack/              # Slack integration status
├── local-test/                 # Local MCP test server for development
│   ├── mcp-server.js           # Express MCP server with customer support tools
│   └── verify.sh               # End-to-end MCP verification script
└── .env.local                  # Your secrets (never commit)
```

---

## Configuration

All configuration lives in `config/`. The dashboard provides a UI for all of these ,  you can also edit the JSON files directly.

### Company (`config/company.json`)

```json
{
  "name": "Acme Corp",
  "industry": "E-commerce",
  "description": "The best widgets on the internet",
  "website": "https://acme.com",
  "phone": "1-800-555-0100",
  "email": "support@acme.com",
  "agentName": "Max",
  "features": [
    "Order tracking and returns",
    "Product recommendations",
    "Billing support"
  ],
  "greeting": {
    "enabled": true,
    "template": "Hi! I'm {agentName}, {companyName}'s AI assistant. How can I help you today?",
    "showHumanEscalation": true
  },
  "humanHandoff": {
    "enabled": true,
    "keywords": ["human", "agent", "person", "manager", "representative"],
    "message": "I'll connect you with a team member. Please hold on.",
    "slackEnabled": false,
    "slackChannelId": ""
  }
}
```

| Field | Description |
|---|---|
| `agentName` | The name the AI introduces itself as |
| `greeting.template` | Supports `{agentName}` and `{companyName}` variables |
| `greeting.showHumanEscalation` | Appends "say so if you'd like a human" to the greeting |
| `humanHandoff.keywords` | Any message containing one of these triggers handoff |
| `humanHandoff.slackEnabled` | Set `true` to post handoffs to Slack |
| `humanHandoff.slackChannelId` | The Slack channel ID to post handoffs to |

---

### Products (`config/products.json`)

```json
{
  "products": [
    {
      "id": "pro-plan",
      "name": "Pro Plan",
      "description": "Full access to all features",
      "price": 299,
      "negotiable": true,
      "lowestNegotiationPrice": 249,
      "features": ["Unlimited usage", "Priority support", "API access"],
      "keywords": ["pro", "premium", "full"]
    },
    {
      "id": "basic-plan",
      "name": "Basic Plan",
      "description": "Core features for small teams",
      "price": 99,
      "negotiable": false,
      "features": ["Up to 5 users", "Email support"],
      "keywords": ["basic", "starter", "small"]
    }
  ]
}
```

- `negotiable: true` ,  agent will offer discounts up to `defaultDiscount` (set in `features.json`)
- `lowestNegotiationPrice` ,  floor; agent will never offer below this
- `keywords` ,  words in a customer message that trigger this product's context

---

### Feature Flags (`config/features.json`)

```json
{
  "negotiation": {
    "enabled": true,
    "defaultDiscount": 0.15,
    "maxDiscount": 0.25
  },
  "mcp": {
    "enabled": true
  },
  "sops": {
    "enabled": true,
    "autoLoad": true
  },
  "knowledgeBase": {
    "enabled": true,
    "documentsPath": "./documents",
    "maxResults": 5,
    "similarityThreshold": 0.7
  },
  "timeConstraints": {
    "offerValidityHours": 24,
    "responseTimeMinutes": 60
  }
}
```

| Field | Description |
|---|---|
| `negotiation.defaultDiscount` | Fraction offered (0.15 = 15% off) |
| `knowledgeBase.similarityThreshold` | Minimum cosine similarity for RAG results (0, 1). Raise to reduce noise. |
| `knowledgeBase.maxResults` | How many document chunks are injected into the prompt |
| `timeConstraints.offerValidityHours` | How long a quoted price is valid |

---

### AI Model (`config/ai.json`)

```json
{
  "provider": "openai",
  "model": "gpt-5-mini",
  "temperature": 1,
  "maxTokens": 5000,
  "embeddingModel": "text-embedding-3-small",
  "embeddingDimensions": 1536
}
```

Any value here can be overridden with an environment variable: `MODEL`, `TEMPERATURE`, `MAX_COMPLETION_TOKENS`, `EMBEDDING_MODEL`.

---

### SOPs (`config/sops.json`)

SOPs are step-by-step instructions injected into the system prompt. The AI is instructed to follow them when the trigger condition matches.

```json
{
  "sops": [
    {
      "id": "sop-returns-001",
      "title": "Returns & Refunds SOP",
      "objective": "Process return requests without making promises the policy doesn't support.",
      "trigger": "Customer asks to return a product or get a refund.",
      "steps": [
        "Ask which order they'd like to return.",
        "Call check_return_window({order_id}) to verify eligibility.",
        "If eligible: call process_refund({order_id, reason}) and share the refund ID.",
        "If ineligible: explain the 30-day window has passed and offer 20% store credit instead."
      ],
      "enabled": true
    }
  ]
}
```

SOPs are most powerful when they reference MCP tool names by exact name (e.g., `check_return_window`), so the AI knows which tools to call in which order.

---

### MCP Tool Integration (`config/mcp-config.json`)

MCP (Model Context Protocol) lets you connect any external API ,  order management, CRMs, databases ,  so the AI can look up real data instead of hallucinating.

```json
{
  "enabled": true,
  "servers": [
    {
      "id": "my-backend",
      "name": "My Backend API",
      "url": "https://api.yourcompany.com/mcp",
      "apiKey": "your-api-key-here",
      "type": "sse",
      "enabled": true
    }
  ]
}
```

**Your MCP server must expose:**

| Endpoint | Method | Description |
|---|---|---|
| `/tools` | GET | Returns `{ tools: [...] }` ,  list of available tools |
| `/call` | POST | Accepts `{ tool, parameters }` ,  executes a tool and returns result |

Each tool definition:
```json
{
  "name": "get_order_status",
  "description": "Get order status by order ID",
  "parameters": {
    "order_id": {
      "type": "string",
      "description": "The order ID (e.g. ORD-12345)",
      "required": true
    }
  }
}
```

The dashboard includes a live **MCP Connector** UI for adding, testing, and toggling servers. Use `local-test/mcp-server.js` as a starting point ,  it implements all the expected endpoints with mock customer support data.

**Testing your MCP server locally:**
```bash
cd local-test
npm install
node mcp-server.js &   # starts on port 3100
bash verify.sh          # runs 29 automated checks
```

---

### Slack Human Handoff

When a customer says a handoff keyword (configurable in `company.json`), the agent:
1. Posts a summary of the conversation to the configured Slack channel
2. Pauses AI responses ,  subsequent customer messages relay to the Slack thread
3. Human agents reply in the Slack thread to respond to the customer
4. When the human types `/resolve` in the Slack thread, AI re-enables for that customer

**Setup:**

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode** and generate an **App-Level Token** (scope: `connections:write`)
3. Add these **Bot Token Scopes**: `chat:write`, `channels:history`, `channels:join`
4. Install the app to your workspace
5. Add environment variables:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_CHANNEL_ID=C0XXXXXXXXX
```

6. In `config/company.json`, set `humanHandoff.slackEnabled: true` and `humanHandoff.slackChannelId`

---

## Knowledge Base

### Website Scraping

The dashboard can scrape your website and convert every page into a searchable markdown document.

1. Go to **Config → Knowledge Base** in the dashboard
2. Enter your website URL
3. Optionally enable **Include Same-Origin Subdomains** (e.g., `docs.yoursite.com`)
4. Set **Max Depth** (2, 5 recommended)
5. Click **Start Scraping**

For GitHub organizations, paste the GitHub org URL (e.g., `https://github.com/your-org`). The scraper uses the GitHub API to fetch repo metadata, members, and READMEs ,  not raw file contents.

```
GITHUB_TOKEN=ghp_...   # optional, increases rate limit from 60 to 5000 req/hr
```

**Auto-updates:** Enable **Auto Update** in the dashboard to re-scrape on a schedule (5 minutes to 24 hours).

### Document Upload

Upload files directly from the **Config → Upload Documents** section:

| Type | Handling |
|---|---|
| `.txt`, `.md`, `.markdown` | Saved as-is |
| `.jpg`, `.png`, `.gif`, `.webp` | Text extracted via OpenAI Vision |
| `.pdf` | Text extracted via OpenAI Vision |

### Manual Documents

Drop `.txt` or `.md` files directly into the `documents/` folder. The agent picks them up automatically on next start or re-initialization.

Files prefixed with `scraped_` are managed by the scraper. All other files are preserved when scraping is cleared.

---

## Intelligent Query Handling

The RAG pipeline automatically detects four query patterns and adjusts the search strategy accordingly. This works for any knowledge base ,  no configuration required.

### Comparison queries
Triggered by: `X vs Y`, `X versus Y`, `difference between X and Y`, `compare X and Y`

Runs independent searches for each term, then merges and deduplicates results. This ensures both sides of a comparison appear in context even when one document scores lower overall.

```
"what's the difference between the Basic and Pro plans?"
→ searches: ["difference between Basic and Pro plans", "Basic plan", "Pro plan"]
```

### Compound questions
Triggered by: two independent clauses joined by "and" (both sides contain a verb)

Splits the question and searches each half separately, then merges results.

```
"how do I install the SDK and what are the system requirements?"
→ searches: ["how do I install the SDK and...", "how do I install the SDK", "what are the system requirements"]
```

### Catalog / listing queries
Triggered by: "what do you offer", "list all products", "full catalog", "what tools are available", etc.

Widens the search: returns up to `maxResults × 3` chunks (minimum 20) at a lower similarity threshold (0.2) so the LLM sees a broad cross-section of your entire knowledge base.

```
"what services does your company offer?"
→ broad search: topK=20, threshold=0.2
```

### Follow-up / context queries
Triggered by: short vague messages (≤12 words) starting with "what", "how", "tell", "can", "does", etc. that don't contain action verbs like "install" or "configure"

Automatically prepends product/topic names from the last AI response to enrich the search query.

```
[After discussing "Pro Plan"]
"what about the pricing for that?"
→ searches: "Pro Plan what about the pricing for that?"
```

### Tuning

All search parameters are in `config/features.json`:

```json
"knowledgeBase": {
  "maxResults": 7,
  "similarityThreshold": 0.4
}
```

- `maxResults` ,  chunks returned per normal query; catalog queries use `maxResults × 3` (min 20)
- `similarityThreshold` ,  minimum cosine similarity (0, 1). Lower = broader recall, higher = stricter relevance. 0.4 works well for large technical docs.

---

## Environment Variables

Create `.env.local` in the project root (copy from `.env.example`):

```env
# Required
OPENAI_API_KEY=sk-...

# Optional ,  override config/ai.json values
MODEL=gpt-5-mini
TEMPERATURE=1
MAX_COMPLETION_TOKENS=5000

# Optional ,  Slack human handoff
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_CHANNEL_ID=C0XXXXXXXXX

# Optional ,  GitHub scraping (increases API rate limit)
GITHUB_TOKEN=ghp_...
```

The dashboard also reads from `dashboard/.env.local` for `NEXT_PUBLIC_*` display variables. These are cosmetic only.

---

## Running the System

### Option A: Dashboard only (recommended to start)

```bash
./start.sh
```

Opens the dashboard at `http://localhost:3000`. Use the chat interface to test the AI. No iMessage or macOS required.

### Option B: iMessage agent only

```bash
bun run packages/agent/src/index.ts
```

Starts the iMessage watcher. Requires macOS with iMessage signed in and Full Disk Access granted to your terminal.

### Option C: Both together

Run in two separate terminals:

```bash
# Terminal 1 ,  dashboard
./start.sh

# Terminal 2 ,  iMessage agent
bun run packages/agent/src/index.ts
```

Or use the **Launch iMessage Agent** button in the dashboard to start the agent as a background process.

### Development (hot reload)

```bash
# Agent with watch
bun --watch packages/agent/src/index.ts

# Dashboard
cd dashboard && bun dev
```

---

## Architecture

```
Customer iMessage
       │
       ▼
packages/agent/src/index.ts
       │
       ├─── IMessageSDK (polling macOS Messages DB)
       │
       ├─── SenderQueue (debounce rapid-fire messages, 1.5s window)
       │
       ├─── ConversationState (per-phone-number: history, negotiation, handoff status)
       │
       ├─── Human handoff check → SlackNotifier (if keywords detected)
       │         └── relay customer messages to Slack thread
       │         └── relay human Slack replies back to iMessage
       │         └── /resolve command re-enables AI
       │
       ├─── Product detection + price negotiation (local, no LLM needed)
       │
       ├─── RAG: DocumentVectorStore.search(query, topK, minSimilarity)
       │         └── text-embedding-3-small embeddings, cached in embeddings/
       │
       ├─── System prompt = generateSystemPrompt(company, SOPs, features, phone, hasMCPTools)
       │
       └─── OpenAI chat completions (5-iteration MCP tool loop)
                 ├─── Tool calls → MCPManager.executeTool(name, params) → your API
                 └─── Final text response → sanitizeEmDashes() → sdk.send()

dashboard/app/api/chat/route.ts
       └── Identical pipeline (same config, same tool loop, same em-dash sanitization)
```

### Key Design Decisions

**Both surfaces share one pipeline.** The iMessage agent and dashboard chat API use identical logic: same system prompt, same MCP tool loop (5 iterations), same negotiation math, same greeting, same em-dash sanitization. You can test everything in the browser before deploying to iMessage.

**Config-driven, not code-driven.** Every behavioral parameter ,  discounts, timeouts, keywords, SOPs, model ,  is in `config/*.json`. Operators change behavior without touching TypeScript.

**Empty message guard.** iMessage delivers tapbacks, stickers, and attachment-only messages as empty text. The agent discards these before doing any processing.

**Debounced queue.** Rapid-fire messages from the same sender are batched with a 1.5-second debounce and processed as one turn, preventing duplicate AI calls.

**Embeddings cache.** Embeddings are stored in `embeddings/` alongside a content hash. On startup, unchanged documents load from cache (fast, no API cost). Modified documents regenerate automatically.

**handoffCount guard.** `handoffCount` only increments if the Slack post actually succeeds (returns a thread timestamp). Failed Slack posts don't count as handoffs.

**Stale negotiation cleared on resolve.** When a human resolves a Slack handoff, `currentNegotiation` is cleared so the returning AI doesn't pick up a stale offer from before the human intervened.

---

## Customizing for Your Business

### Minimal setup (15 minutes)

1. Edit `config/company.json` ,  name, industry, description, agent name, greeting
2. Edit `config/products.json` ,  your actual products/services with real pricing
3. Run `./start.sh`, go to Config, scrape your website
4. Test in chat, launch iMessage

### With custom SOPs

Add entries to `config/sops.json`. Name the MCP tools explicitly in the steps if you want the AI to call them in a specific order.

### With MCP tools

1. Build or deploy an MCP server that exposes `/tools` (GET) and `/call` (POST)
2. Add it to `config/mcp-config.json`
3. Reference tool names in your SOPs
4. Test with the MCP Connector in the dashboard

Use `local-test/mcp-server.js` as a template. It provides `lookup_customer`, `get_order_status`, `check_return_window`, `process_refund`, `log_bug_report`, and `create_ticket` with realistic mock data.

### With Slack handoff

Follow the Slack setup steps above. No code changes ,  just environment variables and `company.json`.

### Changing the AI model

Edit `config/ai.json` or set the `MODEL` environment variable. The system uses whatever model you specify.

---

## Testing

### Pipeline test (no iMessage required)

```bash
cd local-test && node mcp-server.js &    # start MCP server
bun run local-test/pipeline-test.ts      # simulate 9 iMessage scenarios
```

Tests: empty message guard, greeting, em-dash sanitization, human handoff, price negotiation, MCP `get_order_status`, MCP `lookup_customer`, MCP refund flow, stale negotiation cleared on resolve, handoffCount guard.

### MCP server verification

```bash
cd local-test && node mcp-server.js &
bash local-test/verify.sh               # 29 automated tool checks
```

### iMessage-kit unit tests

```bash
cd packages/imessage-kit
bun test
```

---

## Troubleshooting

**"Cannot read iMessage database"**
→ Grant Full Disk Access to your terminal or IDE. System Settings → Privacy & Security → Full Disk Access → add Terminal (or Cursor, VS Code, etc.). Restart after granting.

**"OPENAI_API_KEY is required"**
→ Create `.env.local` in the project root with `OPENAI_API_KEY=sk-...`

**SOPs not loading / agent not following procedures**
→ Verify `config/sops.json` is wrapped in `{ "sops": [...] }`, not a bare array.

**MCP tools not loading**
→ Check `config/features.json` has `"mcp": { "enabled": true }`. Verify the MCP server is running and reachable at the URL in `config/mcp-config.json`. Each server entry needs `"enabled": true`.

**Agent responding twice or not debouncing**
→ The debounce is 1.5 seconds. Multiple very rapid messages should batch into one turn. If you see duplicate responses, check that only one instance of the agent is running.

**Poor response quality / hallucinations**
→ Raise `knowledgeBase.similarityThreshold` (try 0.7, 0.85) to inject only high-relevance docs. Add more documents covering the questions being asked. Add SOPs to guide specific scenarios.

**Slack handoff not triggering**
→ Verify `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID` are set. Confirm `humanHandoff.slackEnabled: true` in `company.json`. Check that the bot is invited to the channel.

**Embeddings not updating after doc changes**
→ The cache auto-invalidates by content hash. If it seems stuck: `rm -rf embeddings/` to force full regeneration.

**Dashboard port in use**
→ `PORT=3001 cd dashboard && bun dev`

---

## Security Notes

- Store secrets in `.env.local` only ,  it is gitignored
- The iMessage agent requires Full Disk Access to read the Messages SQLite database. Only run it on machines you control.
- The upload endpoint restricts file types and sanitizes filenames with `path.basename()` to prevent path traversal
- Never ask customers for passwords or full payment card numbers over iMessage ,  this is enforced in the system prompt and by the SOPs

---

## License

MIT ,  see individual package licenses for `@photon-ai/imessage-kit` and `openai`.
