'use client'

import { useCurrentUser, usePlatformInfo } from '@/lib/api'
import { ExternalLink } from 'lucide-react'

export default function Header() {
  const { data: user } = useCurrentUser()
  const { data: platform } = usePlatformInfo()

  const projectUrl = platform?.connection_url && platform?.project_id
    ? `${platform.connection_url}/admin/projects/${platform.project_id}`
    : null

  return (
    <header className="bg-white border-b border-border sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="6" fill="#1F8FFF"/>
            <rect x="6" y="7" width="5" height="14" fill="white" rx="0.5"/>
            <path d="M12 7 L22 7 L15.5 14 L12 14Z" fill="white"/>
            <path d="M12 14 L15.5 14 L22 21 L12 21Z" fill="white"/>
          </svg>
          <div>
            <span className="font-semibold text-brand-secondary text-sm">Keboola Demo App</span>
            <span className="ml-2 text-xs text-gray-400 hidden sm:inline">Přehled mobility Prahy</span>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium uppercase tracking-wide">
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
