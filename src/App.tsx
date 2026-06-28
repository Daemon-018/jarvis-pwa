import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Mic, MicOff, Plus, MessageSquare, Settings, Trash2,
  Zap, Menu, X, Sun, Moon, Sparkles
} from 'lucide-react'
import './App.css'

// ─── Types ───────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
}

// ─── Main App ────────────────────────────────────────────────
function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('jarvis-sessions')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem('jarvis-active') || null } catch { return null }
  })
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('jarvis-api-url') || 'http://localhost:8765')
  const [darkMode, setDarkMode] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Save sessions
  useEffect(() => {
    localStorage.setItem('jarvis-sessions', JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    if (activeId) localStorage.setItem('jarvis-active', activeId)
  }, [activeId])

  useEffect(() => {
    localStorage.setItem('jarvis-api-url', apiUrl)
  }, [apiUrl])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeId])

  // Active session
  const activeSession = sessions.find(s => s.id === activeId)

  // New chat
  const newChat = useCallback(() => {
    const session: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [{
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m J.A.R.V.I.S., your AI assistant. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }],
      createdAt: new Date().toLocaleDateString(),
    }
    setSessions(prev => [session, ...prev])
    setActiveId(session.id)
    setSidebarOpen(false)
  }, [])

  // Delete chat
  const deleteChat = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeId === id) {
      setActiveId(null)
    }
  }, [activeId])

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    let sessionId = activeId
    let currentMessages: ChatMessage[] = []

    if (!sessionId) {
      // Create new session
      const session: ChatSession = {
        id: Date.now().toString(),
        title: text.slice(0, 40),
        messages: [],
        createdAt: new Date().toLocaleDateString(),
      }
      sessionId = session.id
      setSessions(prev => [session, ...prev])
      setActiveId(sessionId)
    } else {
      currentMessages = sessions.find(s => s.id === sessionId)?.messages || []
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    // Add user message
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length <= 1 ? text.slice(0, 40) : s.title,
            messages: [...s.messages, userMsg],
          }
        : s
    ))
    setInput('')
    setIsLoading(true)

    try {
      // Call backend API
      const chatHistory = [...currentMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          model: 'openrouter/owl-alpha',
        }),
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const data = await res.json()
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || data.content || 'No response.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, aiMsg] } : s
      ))
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Connection error: Unable to reach the AI server at ${apiUrl}.\n\nMake sure the backend server is running.\n\nError: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, errMsg] } : s
      ))
    } finally {
      setIsLoading(false)
    }
  }, [activeId, sessions, isLoading, apiUrl])

  // Voice input
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser.')
      return
    }
    if (isListening) { setIsListening(false); return }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      sendMessage(transcript)
    }
    recognition.start()
  }, [isListening, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // ─── RENDER ──────────────────────────────────────
  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="btn-new-chat" onClick={newChat}>
            <Plus size={16} />
            <span>New Chat</span>
          </button>
          <button className="btn-icon mobile-only" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-sessions">
          {sessions.length === 0 && (
            <div className="sidebar-empty">No conversations yet</div>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${activeId === session.id ? 'active' : ''}`}
              onClick={() => { setActiveId(session.id); setSidebarOpen(false) }}
            >
              <MessageSquare size={14} />
              <span className="session-title">{session.title}</span>
              <button
                className="btn-delete"
                onClick={(e) => { e.stopPropagation(); deleteChat(session.id) }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn-sidebar-action" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main">
        {/* Top Bar */}
        <header className="chat-header">
          <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="header-center">
            <Zap size={16} className="icon-accent" />
            <span className="header-title">J.A.R.V.I.S.</span>
            <span className="header-model">AI Assistant</span>
          </div>
          <button className="btn-icon" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Messages */}
        <div className="chat-messages">
          {!activeSession ? (
            <div className="welcome-screen">
              <div className="welcome-icon">
                <Zap size={40} />
              </div>
              <h1>J.A.R.V.I.S.</h1>
              <p>Your personal AI assistant — ask me anything</p>
              <div className="quick-actions">
                {['Write code', 'Explain a concept', 'Help me brainstorm', 'Summarize text'].map(q => (
                  <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>
                    <Sparkles size={14} />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeSession.messages.map(msg => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="bubble-avatar">
                  {msg.role === 'assistant' ? <Zap size={16} /> : <div className="avatar-user">U</div>}
                </div>
                <div className="bubble-body">
                  <div className="bubble-meta">
                    <span className="bubble-role">{msg.role === 'assistant' ? 'JARVIS' : 'You'}</span>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>
                  <div className="bubble-content">{msg.content}</div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="chat-bubble assistant">
              <div className="bubble-avatar"><Zap size={16} /></div>
              <div className="bubble-body">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message J.A.R.V.I.S..."
              disabled={isLoading}
              className="chat-input"
            />
            <button
              className={`btn-mic ${isListening ? 'listening' : ''}`}
              onClick={toggleVoice}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className="btn-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
            >
              <Send size={18} />
            </button>
          </div>
          <p className="input-disclaimer">J.A.R.V.I.S. can make mistakes. Verify important info.</p>
        </div>
      </main>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="btn-icon" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="setting-group">
                <label>API Server URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder="http://localhost:8765"
                />
                <small>Backend server URL for AI responses</small>
              </div>
              <div className="setting-group">
                <label>Theme</label>
                <div className="theme-toggle">
                  <button className={darkMode ? 'active' : ''} onClick={() => setDarkMode(true)}>Dark</button>
                  <button className={!darkMode ? 'active' : ''} onClick={() => setDarkMode(false)}>Light</button>
                </div>
              </div>
              <div className="setting-group">
                <label>Clear All Chats</label>
                <button className="btn-danger" onClick={() => { setSessions([]); setActiveId(null); setSettingsOpen(false) }}>
                  <Trash2 size={14} /> Delete All Conversations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
