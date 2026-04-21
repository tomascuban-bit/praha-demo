'use client'

import dynamic from 'next/dynamic'
import { useMapData, useParkingSummary } from '@/lib/api'

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full text-gray-400 text-sm">Načítání mapy…</div>
)})

export default function MapPage() {
  const { data: mapData, isLoading } = useMapData()
  const { data: parkingSummary } = useParkingSummary()

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Stats bar */}
      <div className="flex gap-6 px-6 py-3 bg-white dark:bg-slate-900 border-b border-border text-sm flex-shrink-0">
        <div>
          <span className="text-gray-500">Počítadla kol</span>{' '}
          <strong className="text-brand-secondary">{mapData?.bicycle_counters.length ?? '—'}</strong>
        </div>
        <div>
          <span className="text-gray-500">P+R parkoviště na mapě</span>{' '}
          <strong className="text-brand-secondary">{mapData?.parking?.length ?? '—'}</strong>
        </div>
        {parkingSummary?.total_spots ? (
          <div className="ml-auto">
            <span className="text-gray-500">Parkování</span>{' '}
            <strong className="text-green-600">{parkingSummary.pct_free} % volných</strong>
            <span className="text-gray-400 ml-1">({parkingSummary.free_spots.toLocaleString('cs-CZ')} / {parkingSummary.total_spots.toLocaleString('cs-CZ')} míst)</span>
          </div>
        ) : null}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Načítání dat…
          </div>
        ) : mapData ? (
          <MapView data={mapData} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Žádná data mapy k dispozici
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 px-6 py-2 bg-white dark:bg-slate-900 border-t border-border text-xs text-gray-500 dark:text-slate-400 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-full bg-[#2DC653] items-center justify-center text-[10px]">🚲</span>
          Pouze cyklisté
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-full bg-[#6366f1] items-center justify-center text-[8px]">🚲🚶</span>
          Cyklisté + chodci — velikost = počet za 7 dní
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-5 h-5 rounded-[4px] bg-[#2DC653] items-center justify-center text-[10px] font-bold text-white">P</span>
          <span className="inline-flex w-5 h-5 rounded-[4px] bg-[#f59e0b] items-center justify-center text-[10px] font-bold text-white">P</span>
          <span className="inline-flex w-5 h-5 rounded-[4px] bg-[#ef4444] items-center justify-center text-[10px] font-bold text-white">P</span>
          P+R parkoviště — barva = obsazenost (zelená→červená)
        </div>
        <div className="ml-auto">Přepínání vrstev — ovládání vpravo nahoře</div>
      </div>
    </div>
  )
}
