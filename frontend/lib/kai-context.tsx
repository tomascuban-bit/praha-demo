'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

// ── Types ──

export interface ToolIndicator {
  callId: string
  name: string
  completed: boolean
}

export interface KaiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolIndicators: ToolIndicator[]
  suggestions: string[]
  isError?: boolean
}

interface PendingApproval {
  approvalId: string
}

interface KaiContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  messages: KaiMessage[]
  isStreaming: boolean
  pendingApproval: PendingApproval | null
  sendMessage: (text: string) => Promise<void>
  handleApproval: (approved: boolean) => Promise<void>
  newChat: () => void
}

const KaiContext = createContext<KaiContextValue | null>(null)

export function useKai() {
  const ctx = useContext(KaiContext)
  if (!ctx) throw new Error('useKai must be inside KaiProvider')
  return ctx
}

// ── SSE helpers ──

function* parseSSEChunk(text: string): Generator<{ type: string; data: Record<string, unknown> }> {
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const raw = line.slice(5).trim()
    if (raw === '[DONE]') continue
    try {
      const data = JSON.parse(raw)
      yield { type: (data.type as string) || 'unknown', data }
    } catch { /* skip */ }
  }
}

function extractSuggestions(text: string): { body: string; suggestions: string[] } {
  const m = text.trimEnd().match(/\n```[^\n]*\n((?:\s*[-*]\s+.+\n?)+)\s*```\s*$/)
  if (m) {
    return {
      body: text.slice(0, m.index).trimEnd(),
      suggestions: m[1].trim().split('\n')
        .map(l => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean),
    }
  }
  return { body: text, suggestions: [] }
}

// ── Provider ──

export function KaiProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen]               = useState(false)
  const [messages, setMessages]           = useState<KaiMessage[]>([])
  const [isStreaming, setIsStreaming]     = useState(false)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null)

  const chatIdRef      = useRef(crypto.randomUUID())
  const streamingIdRef = useRef<string | null>(null)
  const toolNamesRef   = useRef<Record<string, string>>({})

  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  const newChat = useCallback(() => {
    chatIdRef.current = crypto.randomUUID()
    toolNamesRef.current = {}
    streamingIdRef.current = null
    setMessages([])
    setPendingApproval(null)
  }, [])

  // Add a new message and return its id
  const pushMsg = useCallback((msg: KaiMessage) => {
    setMessages(prev => [...prev, msg])
    return msg.id
  }, [])

  // Update the message matching streamingIdRef
  const patchStreaming = useCallback((updater: (m: KaiMessage) => KaiMessage) => {
    const id = streamingIdRef.current
    if (!id) return
    setMessages(prev => prev.map(m => m.id === id ? updater(m) : m))
  }, [])

  const removeStreaming = useCallback(() => {
    const id = streamingIdRef.current
    if (!id) return
    setMessages(prev => prev.filter(m => m.id !== id))
    streamingIdRef.current = null
  }, [])

  // Core SSE reader — shared by sendMessage and handleApproval
  const readStream = useCallback(async (url: string, body?: object) => {
    const msgId = crypto.randomUUID()
    streamingIdRef.current = msgId
    pushMsg({ id: msgId, role: 'assistant', content: '', toolIndicators: [], suggestions: [] })

    let accumulated = ''
    let gotText = false

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => 'Chyba připojení')
        patchStreaming(m => ({ ...m, content: err, isError: true }))
        streamingIdRef.current = null
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()!

        for (const part of parts) {
          if (!part.trim()) continue
          for (const { type, data } of parseSSEChunk(part + '\n\n')) {

            if (type === 'text-delta' && data.delta) {
              accumulated += data.delta as string
              gotText = true
              patchStreaming(m => ({ ...m, content: accumulated }))

            } else if (type === 'tool-call') {
              const callId = (data.toolCallId as string) || ''
              const name   = (data.toolName as string | null) || null
              const state  = (data.state as string) || ''
              if (name) toolNamesRef.current[callId] = name
              const displayName = name || toolNamesRef.current[callId] || 'nástroj'

              if (state === 'input-available') {
                patchStreaming(m => ({
                  ...m,
                  toolIndicators: [...m.toolIndicators, { callId, name: displayName, completed: false }],
                }))
              } else if (state === 'output-available') {
                patchStreaming(m => ({
                  ...m,
                  toolIndicators: m.toolIndicators.map(t =>
                    t.callId === callId ? { ...t, completed: true } : t
                  ),
                }))
              }

            } else if (type === 'tool-approval-request') {
              setPendingApproval({ approvalId: data.approvalId as string })
              // Streaming pauses — wait for user
              streamingIdRef.current = null
              setIsStreaming(false)
              return

            } else if (type === 'error') {
              patchStreaming(m => ({ ...m, content: `Chyba: ${data.message}`, isError: true }))
            }
          }
        }
      }
    } catch (err) {
      patchStreaming(m => ({ ...m, content: 'Chyba připojení. Zkuste to znovu.', isError: true }))
      console.error('KAI stream error:', err)
    }

    if (!gotText && !pendingApproval) {
      removeStreaming()
    } else if (gotText) {
      const { body: cleanBody, suggestions } = extractSuggestions(accumulated)
      patchStreaming(m => ({ ...m, content: cleanBody, suggestions }))
    }
    streamingIdRef.current = null
  }, [pushMsg, patchStreaming, removeStreaming, pendingApproval])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    setIsStreaming(true)
    pushMsg({ id: crypto.randomUUID(), role: 'user', content: text, toolIndicators: [], suggestions: [] })

    await readStream('/api/chat', {
      id: chatIdRef.current,
      message: {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      selectedChatModel: 'chat-model',
      selectedVisibilityType: 'private',
    })
    setIsStreaming(false)
  }, [isStreaming, pushMsg, readStream])

  const handleApproval = useCallback(async (approved: boolean) => {
    if (!pendingApproval) return
    const { approvalId } = pendingApproval
    setPendingApproval(null)
    setIsStreaming(true)
    const action = approved ? 'approve' : 'reject'
    await readStream(`/api/chat/${chatIdRef.current}/${action}/${approvalId}`)
    setIsStreaming(false)
  }, [pendingApproval, readStream])

  return (
    <KaiContext.Provider value={{
      isOpen, open, close, toggle,
      messages, isStreaming, pendingApproval,
      sendMessage, handleApproval, newChat,
    }}>
      {children}
    </KaiContext.Provider>
  )
}
