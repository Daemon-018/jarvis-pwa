"""
J.A.R.V.I.S. Backend Server
Proxies chat to Hermes Agent API server for full agent capabilities.
Falls back to direct OpenRouter API when Hermes is not running.
"""
import os
import json
import time
import uuid
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from flask_cors import CORS
import httpx

# ─── Config ──────────────────────────────────────────────────
HERMES_API = os.environ.get("HERMES_API_URL", "http://localhost:8642")
HERMES_KEY = os.environ.get("HERMES_API_KEY", "jarvis-secret-2024")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("JARVIS_MODEL", "openrouter/owl-alpha")
PORT = int(os.environ.get("JARVIS_PORT", "8765"))
SYSTEM_PROMPT = """You are J.A.R.V.I.S., an advanced AI assistant. You have access to a terminal, file system, web search, and many other tools. Use them when needed to help the user. Be concise, precise, and helpful."""

app = Flask(__name__, static_folder="../dist", static_url_path="")
CORS(app)

# Track Hermes sessions
hermes_sessions = {}


def check_hermes():
    """Check if Hermes API server is running."""
    try:
        r = httpx.get(f"{HERMES_API}/health", timeout=3.0)
        return r.status_code == 200
    except:
        return False


def chat_via_hermesis(messages, custom_prompt=""):
    """Send chat through Hermes agent API with full tool access."""
    prompt = custom_prompt if custom_prompt else SYSTEM_PROMPT
    headers = {
        "Authorization": f"Bearer {HERMES_KEY}",
        "Content-Type": "application/json",
    }

    # Build OpenAI-compatible format
    api_messages = [{"role": "system", "content": prompt}]
    for msg in messages:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            api_messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        r = httpx.post(
            f"{HERMES_API}/v1/chat/completions",
            headers=headers,
            json={
                "model": "hermes-agent",
                "messages": api_messages,
                "max_tokens": 4096,
                "temperature": 0.7,
            },
            timeout=120.0,
        )

        if r.status_code == 200:
            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"response": content, "backend": "hermes", "model": "hermes-agent"}
        else:
            return None
    except Exception:
        return None


def chat_via_openrouter(messages, custom_prompt=""):
    """Fallback: direct OpenRouter API call (no tools)."""
    prompt = custom_prompt if custom_prompt else SYSTEM_PROMPT
    api_key = OPENROUTER_KEY
    if not api_key:
        # Try loading from Hermes .env
        env_path = os.path.expanduser("~/.hermes/.env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("OPENROUTER_API_KEY=") and not line.startswith("#"):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")

    if not api_key:
        return {"response": "No API key configured. Set OPENROUTER_API_KEY or start Hermes gateway.", "error": "no_key"}

    api_messages = [{"role": "system", "content": prompt}]
    for msg in messages:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            api_messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        r = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://jarvis-pwa.local",
                "X-Title": "J.A.R.V.I.S. PWA",
            },
            json={
                "model": DEFAULT_MODEL,
                "messages": api_messages,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
            timeout=60.0,
        )

        if r.status_code == 200:
            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"response": content, "backend": "openrouter", "model": DEFAULT_MODEL}
        else:
            error_data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error", {}).get("message", f"API error: {r.status_code}")
            return {"response": f"API Error: {error_msg}", "error": "api_error"}
    except httpx.TimeoutException:
        return {"response": "Request timed out. Try again.", "error": "timeout"}
    except Exception as e:
        return {"response": f"Error: {str(e)}", "error": "server_error"}


# ─── Health Check ────────────────────────────────────────────
@app.route("/api/health")
def health():
    hermes_online = check_hermes()
    return jsonify({
        "status": "online",
        "hermes": "connected" if hermes_online else "disconnected",
        "model": DEFAULT_MODEL,
        "timestamp": time.time(),
    })


# ─── Chat Endpoint ───────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    messages = data.get("messages", [])
    custom_prompt = data.get("system_prompt", "")

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Try Hermes first (full agent with tools)
    if check_hermes():
        result = chat_via_hermesis(messages, custom_prompt)
        if result:
            return jsonify(result)

    # Fallback to direct OpenRouter
    result = chat_via_openrouter(messages, custom_prompt)
    return jsonify(result)


# ─── Hermes Status ───────────────────────────────────────────
@app.route("/api/hermes/status")
def hermes_status():
    online = check_hermes()
    return jsonify({
        "online": online,
        "url": HERMES_API,
        "tools_available": online,
    })


# ─── Serve Frontend (production mode) ────────────────────────
@app.route("/")
@app.route("/<path:path>")
def serve_frontend(path=""):
    dist_dir = app.static_folder
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    index_path = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(dist_dir, "index.html")
    return jsonify({"message": "J.A.R.V.I.S. API Server running. Build frontend: npm run build"}), 200


# ─── Main ────────────────────────────────────────────────────
if __name__ == "__main__":
    hermes_online = check_hermes()
    if hermes_online:
        print("Hermes API: CONNECTED (full agent mode)")
    else:
        print("Hermes API: not running (fallback to OpenRouter)")
        print("  Start Hermes gateway for full tool access:")
        print("  hermes gateway run")

    print(f"Model: {DEFAULT_MODEL}")
    print(f"Starting J.A.R.V.I.S. server on port {PORT}")
    print(f"Open http://localhost:{PORT} in your browser")

    app.run(host="0.0.0.0", port=PORT, debug=False)
