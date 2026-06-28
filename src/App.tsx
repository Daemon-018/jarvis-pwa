import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Mic, MicOff, Plus, MessageSquare, Settings, Trash2,
  Zap, Menu, X, Sun, Moon, Sparkles, LayoutDashboard, Edit3,
  Clock, Wifi, WifiOff, ChevronRight
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
  const [hermesOnline, setHermesOnline] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem('jarvis-system-prompt') || 'You are J.A.R.V.I.S., an advanced AI assistant. Be helpful, precise, and slightly witty. Use tools when needed.')
  const [dashboardUrl, setDashboardUrl] = useState(() => localStorage.getItem('jarvis-dashboard-url') || 'http://localhost:9119')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check Hermes connection
  useEffect(() => {
    const checkHermes = async () => {
      try {
        const r = await fetch(`${apiUrl}/api/hermes/status`)
        const data = await r.json()
        setHermesOnline(data.online === true)
      } catch {
        setHermesOnline(false)
      }
    }
    checkHermes()
    const interval = setInterval(checkHermes, 15000)
    return () => clearInterval(interval)
  }, [apiUrl])

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

  useEffect(() => {
    localStorage.setItem('jarvis-system-prompt', systemPrompt)
  }, [systemPrompt])

  useEffect(() => {
    localStorage.setItem('jarvis-dashboard-url', dashboardUrl)
  }, [dashboardUrl])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeId])

  // Active session
  const activeSession = sessions.find(s => s.id === activeId)

  // Group sessions by date
  const groupedSessions = () => {
    const today = new Date().toLocaleDateString()
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()
    const groups: { label: string; items: ChatSession[] }[] = []
    const todayItems: ChatSession[] = []
    const yesterdayItems: ChatSession[] = []
    const olderItems: ChatSession[] = []

    sessions.forEach(s => {
      if (s.createdAt === today) todayItems.push(s)
      else if (s.createdAt === yesterday) yesterdayItems.push(s)
      else olderItems.push(s)
    })

    if (todayItems.length) groups.push({ label: 'Today', items: todayItems })
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems })
    if (olderItems.length) groups.push({ label: 'Earlier', items: olderItems })
    return groups
  }

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

  // Open Hermes Dashboard
  const openDashboard = useCallback(() => {
    window.open(dashboardUrl, '_blank')
  }, [dashboardUrl])

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    let sessionId = activeId
    let currentMessages: ChatMessage[] = []

    if (!sessionId) {
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
          system_prompt: systemPrompt,
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
        content: `Connection error: Unable to reach the AI server at ${apiUrl}.\n\nMake sure the backend server is running.\n\nError: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, errMsg] } : s
      ))
    } finally {
      setIsLoading(false)
    }
  }, [activeId, sessions, isLoading, apiUrl, systemPrompt])

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
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ─── Sidebar ─── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Zap size={18} className="icon-accent" />
            <span className="brand-text">JARVIS</span>
          </div>
          <button className="btn-icon mobile-only" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <button className="btn-new-chat" onClick={newChat}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>

        <div className="sidebar-sessions">
          {sessions.length === 0 && (
            <div className="sidebar-empty">
              <MessageSquare size={24} />
              <span>No conversations yet</span>
            </div>
          )}
          {groupedSessions().map(group => (
            <div key={group.label} className="session-group">
              <div className="group-label">{group.label}</div>
              {group.items.map(session => (
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
          ))}
        </div>

        <div className="sidebar-footer">
          {/* Hermes Connection */}
          <div className={`sidebar-connection ${hermesOnline ? 'connected' : 'disconnected'}`}>
            {hermesOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{hermesOnline ? 'Hermes Connected' : 'Hermes Offline'}</span>
          </div>

          {/* Hermes Dashboard */}
          <button className="btn-sidebar-action" onClick={openDashboard}>
            <LayoutDashboard size={14} />
            <span>Hermes Dashboard</span>
            <ChevronRight size={12} className="chevron" />
          </button>

          {/* Settings */}
          <button className="btn-sidebar-action" onClick={() => { setSettingsOpen(true); setSidebarOpen(false) }}>
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Chat Area ─── */}
      <main className="main">
        <header className="chat-header">
          <button className="btn-icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="header-center">
            <Zap size={16} className="icon-accent" />
            <span className="header-title">J.A.R.V.I.S.</span>
            <span className={`header-status ${hermesOnline ? 'connected' : 'offline'}`}>
              {hermesOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="header-actions">
            <button className="btn-icon" onClick={newChat} title="New chat">
              <Plus size={18} />
            </button>
            <button className="btn-icon" onClick={() => setDarkMode(!darkMode)} title="Toggle theme">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
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
              <div className="connection-status">
                <span className={`status-dot ${hermesOnline ? 'online' : 'offline'}`} />
                <span>{hermesOnline ? 'Hermes Connected — Full Agent Mode' : 'Hermes Offline — Basic Chat Mode'}</span>
              </div>
              <div className="quick-actions">
                {hermesOnline
                  ? ['Run terminal command', 'Search the web', 'Read a file', 'Write code'].map(q => (
                      <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>
                        <Sparkles size={14} />
                        {q}
                      </button>
                    ))
                  : ['Explain a concept', 'Help me brainstorm', 'Write code', 'Summarize text'].map(q => (
                      <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>
                        <Sparkles size={14} />
                        {q}
                      </button>
                    ))
                }
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

      {/* ─── Settings Modal ─── */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="btn-icon" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* System Prompt */}
              <div className="setting-group">
                <label><Edit3 size={12} /> System Prompt</label>
                <textarea
                  className="system-prompt-input"
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  placeholder="Enter custom system prompt..."
                  rows={4}
                />
                <small>Customize how JARVIS behaves. Changes apply to new messages.</small>
              </div>

              {/* API Server URL */}
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

              {/* Dashboard URL */}
              <div className="setting-group">
                <label><LayoutDashboard size={12} /> Hermes Dashboard URL</label>
                <input
                  type="text"
                  value={dashboardUrl}
                  onChange={e => setDashboardUrl(e.target.value)}
                  placeholder="http://localhost:9119"
                />
                <small>Opens in new tab when you click Hermes Dashboard</small>
              </div>

              {/* Theme */}
              <div className="setting-group">
                <label>Theme</label>
                <div className="theme-toggle">
                  <button className={darkMode ? 'active' : ''} onClick={() => setDarkMode(true)}>Dark</button>
                  <button className={!darkMode ? 'active' : ''} onClick={() => setDarkMode(false)}>Light</button>
                </div>
              </div>

              {/* Clear Chats */}
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
