#!/bin/bash

# Photon Dashboard Start Script

echo "🌐 Photon Customer Support Dashboard"
echo "=================================="
echo ""

# Prefer environment from parent project directory (../.env.local or ../.env)
PARENT_ENV="../.env.local"
ALT_PARENT_ENV="../.env"

if [ -f "$PARENT_ENV" ]; then
    ENV_FILE="$PARENT_ENV"
elif [ -f "$ALT_PARENT_ENV" ]; then
    ENV_FILE="$ALT_PARENT_ENV"
else
    echo "⚠️  No environment file found in parent folder (../.env.local or ../.env)"
    echo ""
    echo "Please add your OpenAI API key to ../.env.local or ../.env"
    echo "  cp ../.env.example ../.env.local"
    echo "  # Then edit ../.env.local and add your API key"
    echo ""
    exit 1
fi

# Check if OPENAI_API_KEY is set in the parent env file
if ! grep -q "OPENAI_API_KEY=sk-" "$ENV_FILE"; then
    echo "⚠️  OPENAI_API_KEY not configured in ${ENV_FILE}"
    echo ""
    echo "Please edit ${ENV_FILE} and add your OpenAI API key:" 
    echo "  OPENAI_API_KEY=sk-your-actual-key-here"
    echo ""
    exit 1
fi

# Export parent env variables for the dashboard process
set -o allexport
source "$ENV_FILE"
set +o allexport

echo "✅ Configuration looks good!"
echo ""
echo "Starting Next.js development server..."
echo "Dashboard will be available at: http://localhost:3000"
echo ""
echo "(Press Ctrl+C to stop)"
echo ""

bun dev
