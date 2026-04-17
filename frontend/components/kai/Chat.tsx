'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Trash2, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useKaiChat } from '@/lib/kai-context'

export function Chat() {
  const { messages, isLoading, closeChat, sendMessage, clearMessages } = useKaiChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-[420px] shrink-0 bg-white border-l border-border flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-brand-secondary">Asistent KAI</div>
            <div className="text-[11px] text-gray-400">Ptejte se na data mobility Prahy</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
            title="Vymazat konverzaci"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={closeChat}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-secondary hover:bg-gray-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-3">
              <Bot size={22} className="text-brand-primary" />
            </div>
            <p className="text-sm font-medium text-brand-secondary mb-1">Zeptejte se KAI na cokoliv</p>
            <p className="text-xs text-gray-400 max-w-48">
              Ptejte se na trendy cyklistiky, špičky provozu nebo konkrétní trasy v Praze.
            </p>
            <div className="mt-4 space-y-2 w-full max-w-xs">
              {[
                'Které počítadlo kol má největší provoz?',
                'Kdy je v Praze špička cyklistů?',
                'Kde najdu volné parkování v Praze?',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-surface border border-border text-gray-600 hover:border-brand-primary/30 hover:text-brand-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-brand-primary text-white rounded-br-md'
                    : msg.hasError
                      ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-md'
                      : 'bg-surface border border-border text-brand-secondary rounded-bl-md'
                  }`}
              >
                {msg.role === 'assistant' ? (
                  msg.hasError ? (
                    <div className="space-y-2">
                      <p className="text-xs">{msg.content}</p>
                      {msg.retryText && (
                        <button
                          onClick={() => sendMessage(msg.retryText!)}
                          className="text-xs underline text-red-600 hover:text-red-800"
                        >
                          Zkusit znovu
                        </button>
                      )}
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none prose-p:my-1 prose-pre:text-xs">
                      {msg.content || (msg.isStreaming ? '▊' : '')}
                    </ReactMarkdown>
                  )
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zeptejte se na data mobility Prahy…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-brand-secondary placeholder:text-gray-400 focus:outline-none focus:border-brand-primary transition-colors"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">Powered by Keboola KAI</p>
      </div>
    </motion.div>
  )
}
