#!/bin/bash
# J.A.R.V.I.S. PWA - Start Script
# Starts the backend server (serves frontend + API)

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   J.A.R.V.I.S. — AI Assistant${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if already running
if curl -s http://localhost:8765/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ J.A.R.V.I.S. is already running at http://localhost:8765${NC}"
    exit 0
fi

# Build frontend if dist/ doesn't exist
if [ ! -d "dist" ]; then
    echo -e "${CYAN}Building frontend...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Build failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Frontend built${NC}"
fi

# Load API key from Hermes .env
HERMES_ENV="$HOME/.hermes/.env"
if [ -f "$HERMES_ENV" ]; then
    export $(grep -v '^#' "$HERMES_ENV" | grep OPENROUTER_API_KEY | xargs)
    echo -e "${GREEN}✓ API key loaded from Hermes${NC}"
fi

# Check API key
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${RED}⚠ WARNING: OPENROUTER_API_KEY not set${NC}"
    echo -e "  Set it: export OPENROUTER_API_KEY=your_key"
    echo -e "  Or add to ~/.hermes/.env"
fi

# Start server
echo -e "${CYAN}Starting server on port 8765...${NC}"
python3 server/main.py
