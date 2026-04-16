'use client'

import { useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'
import { Chat } from '@/components/kai/Chat'
import { useKaiChat } from '@/lib/kai-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, closeChat } = useKaiChat()

  const handleClickOutside = useCallback(() => {
    if (isOpen) closeChat()
  }, [isOpen, closeChat])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <NavTabs />
      <div className="flex flex-1 overflow-hidden">
        <main
          className="flex-1 min-w-0 overflow-y-auto"
          onMouseDown={isOpen ? handleClickOutside : undefined}
        >
          {children}
        </main>
        <AnimatePresence>
          {isOpen && <Chat />}
        </AnimatePresence>
      </div>
    </div>
  )
}
