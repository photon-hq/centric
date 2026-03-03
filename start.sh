#!/bin/bash

# Photon Customer Support Agent - Main Orchestrator
# This script manages the complete setup, testing, and deployment flow

set -e  # Exit on error

echo "🚀 Photon Customer Support Agent"
echo "=================================="
echo ""

# ============================================================================
# Step 1: Check Environment Configuration
# ============================================================================

check_env() {
    # Check if .env or .env.local exists
    if [ -f .env.local ]; then
        ENV_FILE=".env.local"
    elif [ -f .env ]; then
        ENV_FILE=".env"
    else
        echo "⚠️  No environment file found!"
        echo ""
        echo "Creating .env.local file..."
        cat > .env.local << 'EOF'
# OpenAI API Configuration
OPENAI_API_KEY=

# Add your OpenAI API key above (get one at https://platform.openai.com/api-keys)
EOF
        echo "✅ Created .env.local"
        echo ""
        echo "⚠️  Please add your OpenAI API key to .env.local"
        echo "   Get your API key at: https://platform.openai.com/api-keys"
        echo ""
        echo "Then run ./start.sh again"
        exit 1
    fi

    # Check if OPENAI_API_KEY is set
    if ! grep -q "OPENAI_API_KEY=sk-" "$ENV_FILE" 2>/dev/null; then
        echo "⚠️  OPENAI_API_KEY not configured in $ENV_FILE"
        echo ""
        echo "Please edit $ENV_FILE and add your OpenAI API key:"
        echo "  OPENAI_API_KEY=sk-your-actual-key-here"
        echo ""
        echo "Get your API key at: https://platform.openai.com/api-keys"
        exit 1
    fi

    echo "✅ Environment configuration found"
}

# ============================================================================
# Step 2: Check if Setup is Complete
# ============================================================================

check_setup_complete() {
    local config_file="config/scraper.config.json"
    
    # Check if scraper config has a website URL
    if [ -f "$config_file" ]; then
        local website_url=$(node -e "try { const c = require('./$config_file'); console.log(c.websiteUrl || ''); } catch(e) { console.log(''); }" 2>/dev/null || echo "")
        
        if [ -n "$website_url" ] && [ "$website_url" != "" ]; then
            # Check if any documents exist (scraped or manual)
            local doc_count=$(find documents -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$doc_count" -gt 0 ]; then
                echo "✅ Configuration complete ($doc_count documents found)"
                return 0
            fi
        fi
    fi
    
    return 1
}

# ============================================================================
# Step 3: Launch Dashboard
# ============================================================================

launch_dashboard() {
    local mode=$1
    
    if [ "$mode" = "setup" ]; then
        echo ""
        echo "📋 First-time setup required"
        echo "=================================="
        echo ""
        echo "Opening setup dashboard..."
        echo "You'll be able to:"
        echo "  1️⃣  Scrape your website to build a knowledge base"
        echo "  2️⃣  Test the AI agent with chat"
        echo "  3️⃣  Launch iMessage integration when ready"
        echo ""
        echo "Dashboard starting at: http://localhost:3000/config"
    else
        echo ""
        echo "✅ Ready to go!"
        echo "=================================="
        echo ""
        echo "Opening dashboard..."
        echo "Available features:"
        echo "  💬 Test your agent with chat"
        echo "  📱 Launch/stop iMessage integration"
        echo "  ⚙️  Update knowledge base configuration"
        echo ""
        echo "Dashboard starting at: http://localhost:3000"
    fi
    
    echo ""
    echo "(Press Ctrl+C to stop)"
    echo ""
    
    # Go to dashboard directory and start
    cd dashboard
    
    # Auto-open browser after a short delay (in background)
    if [ "$mode" = "setup" ]; then
        (sleep 3 && open "http://localhost:3000/config" 2>/dev/null || true) &
    else
        (sleep 3 && open "http://localhost:3000" 2>/dev/null || true) &
    fi
    
    # Start the dashboard
    bun dev
}

# ============================================================================
# Main Execution
# ============================================================================

check_env

if check_setup_complete; then
    launch_dashboard "ready"
else
    launch_dashboard "setup"
fi
