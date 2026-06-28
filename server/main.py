"""
J.A.R.V.I.S. Backend Server
Relays chat messages to OpenRouter API and streams responses.
"""
import os
import json
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import httpx

# ─── Config ──────────────────────────────────────────────────
API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("JARVIS_MODEL", "openrouter/owl-alpha")
PORT = int(os.environ.get("JARVIS_PORT", "8765"))
SYSTEM_PROMPT = """You are J.A.R.V.I.S., an advanced AI assistant inspired by Iron Man's AI system. 
You are helpful, knowledgeable, precise, and slightly witty. You communicate clearly and efficiently.
You can help with coding, research, analysis, creative writing, and general questions.
Keep responses focused and actionable. Use a professional but friendly tone."""

app = Flask(__name__, static_folder="../dist", static_url_path="")
CORS(app)

# ─── Health Check ────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "online", "model": DEFAULT_MODEL, "timestamp": time.time()})

# ─── Chat Endpoint ───────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", DEFAULT_MODEL)

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    if not API_KEY:
        return jsonify({
            "response": "Server not configured. OPENROUTER_API_KEY is not set. Please set it in the environment variables or .env file.",
            "error": "missing_api_key"
        }), 200

    # Build message list with system prompt
    api_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            api_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    try:
        response = httpx.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://jarvis-pwa.local",
                "X-Title": "J.A.R.V.I.S. PWA",
            },
            json={
                "model": model,
                "messages": api_messages,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
            timeout=60.0,
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error", {}).get("message", f"API error: {response.status_code}")
            return jsonify({"response": f"API Error: {error_msg}", "error": "api_error"}), 200

        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "No response from AI.")

        return jsonify({"response": content, "model": model})

    except httpx.TimeoutException:
        return jsonify({"response": "Request timed out. The AI is taking too long to respond. Please try again.", "error": "timeout"}), 200
    except httpx.ConnectError:
        return jsonify({"response": "Cannot connect to the AI service. Please check your internet connection.", "error": "connection_error"}), 200
    except Exception as e:
        return jsonify({"response": f"Unexpected error: {str(e)}", "error": "server_error"}), 200

# ─── Models Endpoint ─────────────────────────────────────────
@app.route("/api/models", methods=["GET"])
def models():
    if not API_KEY:
        return jsonify({"models": []})
    try:
        response = httpx.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=15.0,
        )
        if response.status_code == 200:
            data = response.json()
            model_list = [
                {"id": m["id"], "name": m.get("name", m["id"])}
                for m in data.get("data", [])[:50]
            ]
            return jsonify({"models": model_list})
        return jsonify({"models": []})
    except:
        return jsonify({"models": []})

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
    return jsonify({"message": "J.A.R.V.I.S. API Server running. Build the frontend with: npm run build"}), 200

# ─── Main ────────────────────────────────────────────────────
if __name__ == "__main__":
    # Load API key from .env if available
    env_path = os.path.expanduser("~/.hermes/.env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENROUTER_API_KEY=") and not line.startswith("#"):
                    API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                    print("Loaded API key from ~/.hermes/.env")

    if not API_KEY:
        print("WARNING: OPENROUTER_API_KEY not set!")
        print("Set it via: export OPENROUTER_API_KEY=your_key")
        print("Or add it to ~/.hermes/.env")
    else:
        print("API key configured")

    print(f"Model: {DEFAULT_MODEL}")
    print(f"Starting J.A.R.V.I.S. server on port {PORT}")
    print(f"Open http://localhost:{PORT} in your browser")

    app.run(host="0.0.0.0", port=PORT, debug=False)
