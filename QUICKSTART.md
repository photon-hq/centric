# 🚀 Quick Start Guide

Get your AI customer support agent running in 3 simple steps!

---

## Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

---

## Step 2: Run the Startup Script

```bash
# Make sure you're in the project directory
cd PhotonCustomerSupport

# Start the agent system
./start.sh
```

**What happens:**
- ✅ Checks for API key (creates `.env.local` if needed)
- 🔧 Detects if setup is complete
- 🌐 Launches the interactive dashboard
- 🚀 Opens browser automatically

---

## Step 3: Complete Setup (First Time Only)

### If This Is Your First Run:

The dashboard will open to the **Setup Wizard** at `http://localhost:3000/config`

**Follow these steps:**

1. **Enter your website URL** (e.g., `https://yourcompany.com`)
   
2. **Configure scraper options:**
   - ✅ Include subdomains (optional)
   - 🔢 Max depth: 2-5 levels

3. **Click "Start Scraping"**
   - Watch progress in real-time
   - Wait for completion (usually 1-5 minutes)

4. **Test in the chat interface**
   - Click the home icon or go to `http://localhost:3000`
   - Try asking questions about your business
   - Verify the AI knows your content

5. **Deploy to iMessage** (optional)
   - Click "Launch iMessage Agent" button
   - Now it responds to iMessages automatically!

### If Setup Is Already Complete:

The dashboard opens at `http://localhost:3000` ready to use:
- 💬 **Test with chat** - Try questions immediately
- 📱 **Launch iMessage** - One-click deployment
- ⚙️ **Update config** - Modify settings anytime

---

## 🎨 Dashboard Features

### Main Page (`/`)
- **Chat Interface**: Test your agent instantly
- **iMessage Control**: Start/stop button with live status
- **Quick Prompts**: Example questions to try
- **Status Indicators**: See document count and setup status

### Config Page (`/config`)
- **Website Scraper**: Automatic knowledge base builder
- **Real-time Progress**: Watch as pages are scraped
- **Configuration**: Website URL, subdomain options, depth
- **Document Upload**: Upload text files, images, or PDFs (AI extracts text automatically)
- **Document Management**: Clear scraped content if needed

---

## 🔧 Common Tasks

### Update Your Knowledge Base
```bash
./start.sh
# Then visit http://localhost:3000/config
# Re-scrape your website to get latest content
```

### Test Chat Responses
```bash
./start.sh
# Chat interface is on the main page
```

### Deploy to iMessage
```bash
./start.sh
# Click "Launch iMessage Agent" button
# Agent runs in background responding to messages
```

### Stop iMessage Agent
```bash
# Click "Stop iMessage Agent" button in dashboard
# Or press Ctrl+C in terminal if running agent directly
```

---

## 📱 iMessage Setup (macOS only)

To receive real iMessages:

1. **Enable iMessage on Mac:**
   - Open Messages app
   - Sign in with Apple ID
   - Ensure iMessage is active

2. **Grant Full Disk Access:**
   - System Settings → Privacy & Security
   - Full Disk Access → Add your Terminal or IDE
   - Restart Terminal/IDE

3. **Launch Agent:**
   - Use dashboard button to start
   - Or run `bun run support-agent.ts` directly

4. **Test:**
   - Send iMessage to your Mac's number
   - Agent responds automatically

---

## 🎯 Recommended Workflow

### Development & Testing:
1. Start with `./start.sh`
2. Use web chat interface
3. Iterate on configuration
4. Test thoroughly

### Production Deployment:
1. Verify chat responses are good
2. Click "Launch iMessage Agent"
3. Monitor dashboard for status
4. Agent handles real customers

---

## 💡 Tips

- **First time?** Complete setup wizard before testing
- **Testing?** Use web chat - it's faster than iMessage
- **Going live?** Launch iMessage from dashboard button
- **Need changes?** Update config anytime and re-scrape
- **Multiple sites?** Scrape subdomains for complete coverage

---

## 🆘 Troubleshooting

### "API Key Not Found"
- Edit `.env.local` and add: `OPENAI_API_KEY=sk-...`
- Get key from https://platform.openai.com/api-keys

### "No Documents Found"
- Go to `/config` and scrape your website
- Or manually add `.md` files to `documents/` folder

### "iMessage Won't Start"
- Check Full Disk Access is granted
- Restart Terminal/IDE after granting access
- Ensure Messages app is signed in

### "Agent Not Responding"
- Check iMessage status in dashboard
- Verify agent process is running
- Check terminal output for errors

---

## 📚 Next Steps

- ✅ **Completed setup?** Try the [examples](./EXAMPLES.md)
- 🔧 **Want to customize?** Read the [full README](./README.md)
- 🏢 **Different industry?** Check [config examples](./config/examples/)
- 📖 **Technical details?** See [architecture docs](./docs/)

---

**Need help?** Open an issue or check the documentation!
1. **Test in Dashboard** → Fast iteration, instant feedback
2. **Refine logic** → Adjust prompts, products, negotiation
3. **Deploy to iMessage** → Use for real customers

### For Production:
1. **Run iMessage Agent** → Handle customer messages
2. **Use Dashboard** → Test new features before deploying

---

## 💡 Quick Test Prompts

Try these in either interface:

### Basic Questions
```
"What documents do I need to file my taxes?"
"When is the tax deadline?"
"Do you help with business taxes?"
```

### Product Inquiries
```
"How much does individual tax filing cost?"
"Tell me about your tax planning service"
"What services do you offer?"
```

### Price Negotiation
```
"That's too expensive"
"Can you do better?"
"I have a budget of $200"
"That works for me, I'll take it"
```

### Complex Questions
```
"I'm self-employed, do I need to pay quarterly taxes?"
"What if I get audited?"
"I need to file taxes for 2023, can you help?"
```

---

## 🔧 Troubleshooting

### Dashboard Issues

**"Cannot find module"**
→ Run `cd dashboard && bun install`

**"OPENAI_API_KEY is required"**
→ Create `.env.local` with your API key

**Port 3000 in use**
→ Run `PORT=3001 bun dev`

### iMessage Issues

**"Cannot read iMessage database"**
→ Grant Full Disk Access to your Terminal/IDE

**Messages not responding**
→ Check console for errors, ensure agent is running

---

## 📚 Full Documentation

- **Dashboard**: [dashboard/README.md](dashboard/README.md)
- **iMessage Agent**: [README.md](README.md)
- **Conversation Examples**: [EXAMPLES.md](EXAMPLES.md)

---

## 🎨 Highlights

### RAG Knowledge Base
- 3 comprehensive tax documents included
- Semantic search with embeddings
- Automatic caching (fast subsequent loads)

### Product Catalog
- 8 tax services configured
- Fixed and negotiable pricing
- Intelligent negotiation (15% discount range)

### AI Features
- GPT-4o powered responses
- Context-aware conversations
- Professional tax advice tone
- Product recommendations

---

## 🚦 Next Steps

1. **Choose your interface** (Dashboard or iMessage)
2. **Add your OpenAI API key**
3. **Start testing!**

Have questions? Check the full READMEs or [EXAMPLES.md](EXAMPLES.md) for conversation samples.

**Happy testing! 🎉**
