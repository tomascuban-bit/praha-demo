'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bike, BarChart2, Map, ParkingCircle } from 'lucide-react'

const TABS = [
  { href: '/',         label: 'Overview',  icon: LayoutDashboard },
  { href: '/cycling',  label: 'Cycling',   icon: Bike },
  { href: '/parking',  label: 'Parking',   icon: ParkingCircle },
  { href: '/map',      label: 'City Map',  icon: Map },
  { href: '/custom',   label: 'Reports',   icon: BarChart2 },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-border">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex gap-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all
                  ${active
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-brand-secondary hover:border-gray-200'
                  }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
