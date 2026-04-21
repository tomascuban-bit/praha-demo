'use client'

import { useEffect, useRef, useState } from 'react'
import { X, RotateCcw, Send, Bot, Check, XIcon } from 'lucide-react'
import { useKai, type KaiMessage } from '@/lib/kai-context'

// ── Simple markdown renderer (bold, inline code, code blocks, newlines) ──
function Markdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const body = part.slice(3, -3).replace(/^\w*\n/, '')
          return <pre key={i} className="bg-slate-100 dark:bg-slate-700 rounded p-2 text-xs overflow-x-auto my-1 whitespace-pre-wrap">{body}</pre>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-slate-100 dark:bg-slate-700 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part.split('\n').map((line, j, arr) => (
          <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
        ))}</span>
      })}
    </span>
  )
}

// ── Single message bubble ──
function MessageBubble({ msg, isStreaming }: { msg: KaiMessage; isStreaming: boolean }) {
  const isUser = msg.role === 'user'
  const isCurrentlyStreaming = isStreaming && msg.role === 'assistant' && msg.content === '' && msg.toolIndicators.length === 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Bubble */}
        <div className={[
          'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-brand-primary text-white rounded-tr-sm'
            : msg.isError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-tl-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-brand-secondary dark:text-slate-200 rounded-tl-sm',
        ].join(' ')}>
          {isCurrentlyStreaming ? (
            <span className="inline-flex gap-1 items-center py-0.5">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
            </span>
          ) : isUser ? (
            <span>{msg.content}</span>
          ) : (
            <Markdown text={msg.content} />
          )}
          {/* Streaming cursor */}
          {isStreaming && msg.role === 'assistant' && msg.content && !msg.suggestions.length && (
            <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />
          )}
        </div>

        {/* Tool indicators */}
        {msg.toolIndicators.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {msg.toolIndicators.map((t, i) => (
              <div key={i} className={[
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg',
                t.completed
                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
              ].join(' ')}>
                {t.completed ? <Check size={11} /> : (
                  <span className="w-2.5 h-2.5 border border-current rounded-full border-t-transparent animate-spin" />
                )}
                {t.completed ? `${t.name} dokončeno` : `Volám ${t.name}…`}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main panel ──
export function KaiPanel() {
  const { isOpen, close, messages, isStreaming, pendingApproval, sendMessage, handleApproval, newChat } = useKai()
  const [input, setInput] = useState('')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // Last assistant message for suggestions
  const lastMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const suggestions = (!isStreaming && lastMsg?.suggestions) ? lastMsg.suggestions : []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const submit = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={close}
        />
      )}

      {/* Panel */}
      <div className={[
        'fixed top-0 right-0 h-screen z-50 w-96 flex flex-col',
        'bg-white dark:bg-slate-900 border-l border-border shadow-2xl',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}>

        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Bot size={15} />
            </div>
            <span className="text-sm font-semibold text-brand-secondary">KAI Asistent</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={newChat}
              title="Nový chat"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand-secondary hover:bg-surface dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={close}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand-secondary hover:bg-surface dark:hover:bg-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Bot size={22} />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-secondary">KAI — Keboola AI Asistent</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">Ptejte se na data v projektu, počítadla, parkoviště nebo nechejte KAI data prozkoumat za vás.</p>
              </div>
              <div className="w-full space-y-1.5 mt-2">
                {['Kolik cyklistů projelo tento týden?', 'Která parkoviště jsou teď plná?', 'Ukaž trend posledních 30 dní'].map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border hover:border-brand-primary/30 hover:bg-brand-primary/5 text-gray-500 hover:text-brand-secondary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} />
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Approval bar */}
        {pendingApproval && (
          <div className="px-4 pb-3 shrink-0">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-2">
                KAI chce provést akci — schvalte nebo zamítněte:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproval(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors"
                >
                  <Check size={12} /> Schválit
                </button>
                <button
                  onClick={() => handleApproval(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  <XIcon size={12} /> Zamítnout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 shrink-0">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface dark:bg-slate-800 px-3 py-2 focus-within:border-brand-primary transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isStreaming || !!pendingApproval}
              placeholder="Napište zprávu… (Enter = odeslat)"
              className="flex-1 bg-transparent text-sm text-brand-secondary dark:text-slate-200 placeholder:text-gray-300 dark:placeholder:text-slate-600 resize-none outline-none max-h-28 overflow-y-auto"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={submit}
              disabled={!input.trim() || isStreaming || !!pendingApproval}
              className="w-7 h-7 rounded-xl bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 mb-0.5"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
