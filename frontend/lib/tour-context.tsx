'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface TourContextValue {
  isOpen: boolean
  openTour: () => void
  closeTour: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be inside TourProvider')
  return ctx
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const openTour  = useCallback(() => setIsOpen(true), [])
  const closeTour = useCallback(() => {
    setIsOpen(false)
    setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])

  return (
    <TourContext.Provider value={{ isOpen, openTour, closeTour, triggerRef }}>
      {children}
    </TourContext.Provider>
  )
}
