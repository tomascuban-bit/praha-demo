'use client'

import dynamic from 'next/dynamic'
import { useMapData, useParking } from '@/lib/api'

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading map…</div>
)})

const AQ_LABELS: Record<number, string> = {
  1: 'Excellent', 2: 'Very Good', 3: 'Good',
  4: 'Satisfactory', 5: 'Poor', 6: 'Bad', 7: 'Very Bad',
}

export default function MapPage() {
  const { data: mapData, isLoading } = useMapData()
  const { data: parking } = useParking()

  const aqWithData = mapData?.air_quality.filter(s => s.aq_index != null) ?? []
  const avgAq = aqWithData.length
    ? aqWithData.reduce((sum, s) => sum + s.aq_index!, 0) / aqWithData.length
    : null
  const roundedAq = avgAq != null ? Math.round(avgAq) : null

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {/* Stats bar */}
      <div className="flex gap-6 px-6 py-3 bg-white border-b border-border text-sm flex-shrink-0">
        <div>
          <span className="text-gray-500">Bicycle counters</span>{' '}
          <strong className="text-brand-secondary">{mapData?.bicycle_counters.length ?? '—'}</strong>
        </div>
        <div>
          <span className="text-gray-500">AQ stations</span>{' '}
          <strong className="text-amber-600">{mapData?.air_quality.length ?? '—'}</strong>
        </div>
        {roundedAq != null && (
          <div>
            <span className="text-gray-500">Avg AQ index</span>{' '}
            <strong className="text-amber-600">{roundedAq} — {AQ_LABELS[roundedAq] ?? 'Unknown'}</strong>
          </div>
        )}
        {parking?.summary?.total_spots ? (
          <div className="ml-auto">
            <span className="text-gray-500">Parking</span>{' '}
            <strong className="text-green-600">{parking.summary.pct_free}% free</strong>
            <span className="text-gray-400 ml-1">({parking.summary.free_spots.toLocaleString()} / {parking.summary.total_spots.toLocaleString()} spots)</span>
          </div>
        ) : null}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading city data…
          </div>
        ) : mapData ? (
          <MapView data={mapData} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No map data available
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-6 px-6 py-2 bg-white border-t border-border text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-[#2DC653]" />
          Bicycle counters — size = 7-day count
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
          Air quality (green→red = good→poor)
        </div>
        <div className="ml-auto">Use layer control (top right) to toggle layers</div>
      </div>
    </div>
  )
}
