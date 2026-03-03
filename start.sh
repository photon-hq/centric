#!/bin/bash

# TaxPro Customer Support Agent Quick Start Script

echo "🚀 TaxPro Customer Support Agent"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Please create a .env file with your OpenAI API key:"
    echo "  cp .env.example .env"
    echo "  # Then edit .env and add your API key"
    echo ""
    exit 1
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env; then
    echo "⚠️  OPENAI_API_KEY not configured in .env"
    echo ""
    echo "Please edit .env and add your OpenAI API key:"
    echo "  OPENAI_API_KEY=sk-your-actual-key-here"
    echo ""
    exit 1
fi

echo "✅ Configuration looks good!"
echo ""
echo "Starting agent..."
echo "(Press Ctrl+C to stop)"
echo ""

# Load environment variables and start the agent
export $(cat .env | grep -v '^#' | xargs)
bun run tax-support-agent.ts
