'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { TOUR_KEY, TOUR_STEPS } from '@/lib/tour-steps'
import { useTour } from '@/lib/tour-context'

const OPEN_DELAY_MS = 800
const SPOTLIGHT_PAD = 6

interface Rect { top: number; left: number; width: number; height: number }

// Center point with zero size — box-shadow covers entire screen, no visible hole
const centerRect = (): Rect => ({
  top:    window.innerHeight / 2,
  left:   window.innerWidth  / 2,
  width:  0,
  height: 0,
})

export default function TourGuide() {
  const { isOpen, openTour, closeTour } = useTour()
  const [step, setStep]                 = useState(0)
  const [rect, setRect]                 = useState<Rect | null>(null)
  const modalRef                         = useRef<HTMLDivElement>(null)
  const titleId                          = useId()
  const stepRef                          = useRef(step)
  stepRef.current = step

  // Auto-open once on first visit — localStorage read inside useEffect (SSR-safe)
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(openTour, OPEN_DELAY_MS)
      return () => clearTimeout(t)
    }
  }, [openTour])

  // Reset when tour closes
  useEffect(() => {
    if (!isOpen) { setStep(0); setRect(null) }
  }, [isOpen])

  // Always resolves to a Rect — no-target steps use center+0 so box-shadow covers full screen
  const reposition = useCallback(() => {
    const targetId = TOUR_STEPS[stepRef.current]?.targetId
    if (!targetId) { setRect(centerRect()); return }
    const el = document.querySelector(`[data-tour-id="${targetId}"]`)
    if (!el)       { setRect(centerRect()); return }
    const r = el.getBoundingClientRect()
    setRect({
      top:    r.top    - SPOTLIGHT_PAD,
      left:   r.left   - SPOTLIGHT_PAD,
      width:  r.width  + SPOTLIGHT_PAD * 2,
      height: r.height + SPOTLIGHT_PAD * 2,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    reposition()
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [isOpen, step, reposition])

  // Focus modal on open
  useEffect(() => {
    if (isOpen) setTimeout(() => modalRef.current?.focus(), 60)
  }, [isOpen])

  // Actions
  const handleDismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1')
    closeTour()
  }, [closeTour])

  const handleNext = useCallback(() => {
    if (stepRef.current < TOUR_STEPS.length - 1) setStep(s => s + 1)
    else handleDismiss()
  }, [handleDismiss])

  const handlePrev = useCallback(() => {
    setStep(s => Math.max(0, s - 1))
  }, [])

  // Keyboard: arrows + Esc + focus trap
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { handleDismiss(); return }
      if (e.key === 'ArrowRight') { handleNext();    return }
      if (e.key === 'ArrowLeft')  { handlePrev();    return }
      if (e.key !== 'Tab') return

      const modal = modalRef.current
      if (!modal) return
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleDismiss, handleNext, handlePrev])

  if (!isOpen) return null

  const current = TOUR_STEPS[step]
  const isFirst = step === 0
  const isLast  = step === TOUR_STEPS.length - 1
  const Icon    = current.icon

  return (
    <>
      {/* Transparent click-capture — dismisses tour on outside click */}
      <div
        className="fixed inset-0 z-[49]"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/*
        Single unified spotlight div.
        No-target steps: center + 0 size → box-shadow covers entire screen (full dark, no hole).
        Target steps: positioned over element → box-shadow + white ring create visible spotlight.
        Smooth CSS transition between all states — no div-swap snap.
      */}
      <div
        className="fixed rounded-lg pointer-events-none z-[50]"
        style={{
          top:    rect?.top    ?? 0,
          left:   rect?.left   ?? 0,
          width:  rect?.width  ?? 0,
          height: rect?.height ?? 0,
          boxShadow: rect && (rect.width > 0 || rect.height > 0)
            ? '0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 3px rgba(255,255,255,0.6)'
            : '0 0 0 9999px rgba(0,0,0,0.78)',
          transition: 'top 150ms ease, left 150ms ease, width 150ms ease, height 150ms ease',
          opacity: rect !== null ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* Modal — anchored in lower viewport, safely below all header/nav spotlight targets */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4"
        style={{ top: '58vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border outline-none overflow-hidden"
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-100 dark:bg-slate-800">
            <div
              className="h-full bg-brand-primary transition-all duration-300"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* Top row: dots + counter + close */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'rounded-full transition-all duration-200',
                      i === step
                        ? 'bg-brand-primary'
                        : i < step
                        ? 'bg-brand-primary/40'
                        : 'bg-gray-200 dark:bg-slate-700',
                    ].join(' ')}
                    style={{ width: i === step ? 16 : 8, height: 8 }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">
                  {step + 1} / {TOUR_STEPS.length}
                </span>
                <button
                  onClick={handleDismiss}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Zavřít průvodce"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon size={20} className="text-brand-primary" />
              </div>
              <h2 id={titleId} className="text-base font-semibold text-brand-secondary dark:text-white">
                {current.title}
              </h2>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed mb-5">
              {current.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                Přeskočit průvodce
              </button>
              <div className="flex gap-2">
                {!isFirst && (
                  <button
                    onClick={handlePrev}
                    className="px-3 py-1.5 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    ← Zpět
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
                >
                  {isLast ? 'Dokončit ✓' : 'Další →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
