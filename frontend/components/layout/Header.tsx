'use client'

import { useCurrentUser, usePlatformInfo } from '@/lib/api'
import { useKaiChat } from '@/lib/kai-context'
import { MessageSquare, ExternalLink } from 'lucide-react'

export default function Header() {
  const { data: user } = useCurrentUser()
  const { data: platform } = usePlatformInfo()
  const { openChat, isOpen } = useKaiChat()

  const projectUrl = platform?.connection_url && platform?.project_id
    ? `${platform.connection_url}/admin/projects/${platform.project_id}`
    : null

  return (
    <header className="bg-white border-b border-border sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-brand-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <div>
            <span className="font-semibold text-brand-secondary text-sm">Praha Demo</span>
            <span className="ml-2 text-xs text-gray-400 hidden sm:inline">Přehled mobility Prahy</span>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-semibold uppercase tracking-wide">
            Golemio Open Data
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {projectUrl && (
            <a
              href={projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-primary transition-colors"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Keboola projekt</span>
            </a>
          )}

          <button
            onClick={openChat}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isOpen
                ? 'bg-brand-secondary text-white'
                : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white'
              }`}
          >
            <MessageSquare size={15} />
            <span>Zeptat se KAI</span>
          </button>

          {user?.email && (
            <div className="w-7 h-7 rounded-full bg-brand-secondary/10 flex items-center justify-center">
              <span className="text-brand-secondary text-xs font-semibold">
                {user.email[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
