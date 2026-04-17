'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface KaiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  hasError?: boolean
  retryText?: string
}

interface KaiChatState {
  isOpen: boolean
  messages: KaiMessage[]
  isLoading: boolean
  openChat: () => void
  closeChat: () => void
  sendMessage: (text: string, chatId?: string) => Promise<void>
  clearMessages: () => void
  chatId: string | null
}

const KaiChatContext = createContext<KaiChatState | null>(null)

export function KaiChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<KaiMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const clearMessages = useCallback(() => { setMessages([]); setChatId(null) }, [])

  const sendMessage = useCallback(async (text: string, existingChatId?: string) => {
    if (!text.trim()) {
      console.error('[KAI] sendMessage called with empty text — handler not properly guarded')
      return
    }
    const userMsg: KaiMessage = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: KaiMessage = { id: assistantId, role: 'assistant', content: '', isStreaming: true }
    setMessages(prev => [...prev, assistantMsg])

    const setError = (msg: string) => {
      console.error('[KAI] Error:', msg)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: msg, isStreaming: false, hasError: true, retryText: text }
          : m
      ))
    }

    try {
      const currentChatId = existingChatId || chatId || `chat-${Date.now()}`
      if (!chatId) setChatId(currentChatId)

      const body = {
        id: currentChatId,
        message: {
          id: userMsg.id,
          role: 'user',
          parts: [{ type: 'text', text }],
        },
        selectedChatModel: 'chat-model',
        selectedVisibilityType: 'private',
      }

      const startResp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!startResp.ok) {
        const errBody = await startResp.text().catch(() => '')
        setError(`Odpověď se nepodařilo načíst. Zkuste to prosím znovu. (${startResp.status})`)
        console.error('[KAI] Chat start failed:', startResp.status, errBody)
        return
      }
      const { stream_id } = await startResp.json()

      // Poll for events
      let cursor = 0
      let fullContent = ''

      while (true) {
        const pollResp = await fetch(`/api/chat/${stream_id}/poll?cursor=${cursor}`)
        if (!pollResp.ok) {
          setError('Odpověď se nepodařilo načíst. Zkuste to prosím znovu.')
          break
        }
        const { events, cursor: newCursor, done, error: streamError } = await pollResp.json()

        if (streamError) {
          console.error('[KAI] Stream error from backend:', streamError)
          setError('Odpověď se nepodařilo načíst. Zkuste to prosím znovu.')
          break
        }

        cursor = newCursor

        for (const eventStr of events) {
          const lines = eventStr.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const parts = parsed?.message?.parts || parsed?.delta?.parts || []
              for (const part of parts) {
                if (part.type === 'text' && part.text) {
                  fullContent += part.text
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  ))
                }
              }
            } catch {}
          }
        }

        if (done) break
        await new Promise(r => setTimeout(r, 200))
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, isStreaming: false } : m
      ))
    } catch (err) {
      setError('Odpověď se nepodařilo načíst. Zkuste to prosím znovu.')
    } finally {
      setIsLoading(false)
    }
  }, [chatId])

  return (
    <KaiChatContext.Provider value={{ isOpen, messages, isLoading, openChat, closeChat, sendMessage, clearMessages, chatId }}>
      {children}
    </KaiChatContext.Provider>
  )
}

export function useKaiChat() {
  const ctx = useContext(KaiChatContext)
  if (!ctx) throw new Error('useKaiChat must be used within KaiChatProvider')
  return ctx
}
