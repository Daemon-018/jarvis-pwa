# J.A.R.V.I.S. — AI Assistant PWA

A ChatGPT-style AI chat application with JARVIS-inspired dark theme, built as a Progressive Web App.

## Features

- ChatGPT/Gemini-style chat interface
- Dark/Light theme (JARVIS-inspired)
- Voice input support (browser speech recognition)
- Multiple chat sessions with history
- PWA — install on your home screen like a native app
- Connects to OpenRouter API for AI responses
- Works on mobile and desktop

## Quick Start

```bash
# Start the server
./start.sh

# Or manually:
# 1. Build frontend
npm run build

# 2. Start backend
python3 server/main.py

# 3. Open in browser
# http://localhost:8765
```

## Architecture

```
Frontend (React + Vite + PWA)
    ↓ /api/chat
Backend (Flask)
    ↓ OpenRouter API
AI Model (owl-alpha, Claude, GPT, etc.)
```

## Configuration

Set your API key before running:

```bash
export OPENROUTER_API_KEY=***# Or add to ~/.hermes/.env (auto-loaded)
```

Change model:
```bash
export JARVIS_MODEL=openrouter/owl-alpha
```

Change port:
```bash
export JARVIS_PORT=8765
```

## Install as App (PWA)

1. Open http://localhost:8765 in Chrome
2. Tap the three-dot menu → "Install app" or "Add to Home Screen"
3. JARVIS will appear as a standalone app on your device

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + PWA
- **Backend**: Python Flask
- **AI**: OpenRouter API (any model)
- **Styling**: Custom CSS with CSS variables

## License

MIT
