# 🚀 Quick Start Guide

This project includes **TWO ways** to test the TaxPro AI Support Agent:

## 1️⃣ Web Dashboard (Recommended for Testing)

The easiest way to test the agent - no iMessage setup needed!

### Setup (2 minutes)

```bash
# Navigate to dashboard
cd dashboard

# Create environment file
cp .env.example .env.local

# Add your OpenAI API key to .env.local
# OPENAI_API_KEY=sk-your-actual-key-here

# Start the dashboard
./start.sh
# Or: bun dev
```

### Access

Open your browser to: **http://localhost:3000**

### What You'll See

- 🎨 Beautiful chat interface
- 📚 Quick test prompts
- 💬 Real-time AI responses
- 🛍️ Product catalog info
- 💰 Price negotiation demo

**Perfect for:**
- Development and testing
- Demo presentations
- Rapid iteration on prompts
- No phone number required

---

## 2️⃣ iMessage Agent (Production)

Use the agent through Apple Messages for real customer support.

### Setup (5 minutes)

```bash
# In main directory (not dashboard)
cd /Users/world/Desktop/Projects/PhotonCustomerSupport

# Create environment file
cp .env.example .env

# Add your OpenAI API key to .env
# OPENAI_API_KEY=sk-your-actual-key-here

# Grant Full Disk Access
# System Settings → Privacy & Security → Full Disk Access
# Add your Terminal or IDE

# Start the agent
./start.sh
# Or: bun run start
```

### How to Use

1. Send iMessage to your Mac's phone number
2. Agent automatically responds
3. Handles multiple conversations simultaneously

**Perfect for:**
- Production customer support
- Real customer interactions
- Multi-customer handling
- Native iMessage experience

---

## 📊 Feature Comparison

| Feature | Web Dashboard | iMessage Agent |
|---------|---------------|----------------|
| **Setup Time** | 2 minutes | 5 minutes |
| **Requirements** | Browser only | macOS + Full Disk Access |
| **Testing** | Instant | Need phone/iMessage |
| **Interface** | Modern web UI | Native Messages |
| **Use Case** | Development | Production |
| **Multi-user** | Single session | Multiple customers |

---

## 🎯 Recommended Workflow

### For Development:
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
