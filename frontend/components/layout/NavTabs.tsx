'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Bike, Footprints, BarChart2, Map, ParkingCircle } from 'lucide-react'

const TABS = [
  { href: '/',            label: 'Přehled',     icon: LayoutDashboard, tourId: 'tab-overview' },
  { href: '/cycling',     label: 'Cyklistika',  icon: Bike,            tourId: 'tab-cycling'  },
  { href: '/pedestrian',  label: 'Chodci',      icon: Footprints,      tourId: 'tab-pedestrian' },
  { href: '/parking',     label: 'Parkování',   icon: ParkingCircle,   tourId: 'tab-parking'  },
  { href: '/map',         label: 'Mapa města',  icon: Map,             tourId: 'tab-map'      },
  { href: '/custom',      label: 'Reporty',     icon: BarChart2,       tourId: 'tab-custom'   },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-border">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex gap-1">
          {TABS.map(({ href, label, icon: Icon, tourId }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                data-tour-id={tourId}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all
                  ${active
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-brand-secondary hover:border-gray-200 dark:hover:border-slate-600'
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
