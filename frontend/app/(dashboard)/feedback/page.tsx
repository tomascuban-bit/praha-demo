'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react'

type Status = 'idle' | 'sending' | 'success' | 'error' | 'not_configured'

export default function FeedbackPage() {
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus]   = useState<Status>('idle')

  const canSubmit = email.trim().length > 0 && message.trim().length >= 5 && status !== 'sending'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('sending')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_email: email.trim(), message: message.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('success')
      } else if (data.reason === 'not_configured') {
        setStatus('not_configured')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-secondary transition-colors mb-8"
      >
        <ArrowLeft size={15} />
        Zpět na přehled
      </Link>

      <h1 className="text-2xl font-bold text-brand-secondary mb-1">Zpětná vazba</h1>
      <p className="text-sm text-gray-500 mb-8">
        Máte nápad, komentář nebo jste narazili na chybu? Napište nám.
      </p>

      {status === 'success' ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 size={48} className="text-green-500" />
          <div>
            <p className="text-lg font-semibold text-brand-secondary">Odesláno, díky!</p>
            <p className="text-sm text-gray-400 mt-1">Vaše zpětná vazba byla úspěšně odeslána.</p>
          </div>
          <Link
            href="/"
            className="mt-4 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
          >
            Zpět na dashboard
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Váš e-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              className="w-full rounded-xl border border-border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-brand-secondary placeholder:text-gray-300 focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Zpráva
            </label>
            <textarea
              required
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Napište svůj komentář, nápad nebo hlášení chyby…"
              className="w-full rounded-xl border border-border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-brand-secondary placeholder:text-gray-300 focus:outline-none focus:border-brand-primary transition-colors resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{message.length} znaků</p>
          </div>

          {(status === 'error' || status === 'not_configured') && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                {status === 'not_configured'
                  ? 'Odesílání e-mailů není nakonfigurováno. Kontaktujte správce aplikace.'
                  : 'Nepodařilo se odeslat zprávu. Zkuste to prosím znovu.'}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {status === 'sending' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Odesílám…
              </>
            ) : (
              <>
                <Send size={15} />
                Odeslat zpětnou vazbu
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
