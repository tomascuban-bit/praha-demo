'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup } from 'react-leaflet'
import type { MapDataResponse } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

const { BaseLayer, Overlay } = LayersControl

function parkingColor(pct: number): string {
  if (pct < 25) return '#2DC653'
  if (pct < 50) return '#74c69d'
  if (pct < 75) return '#f59e0b'
  if (pct < 90) return '#f97316'
  return '#ef4444'
}

function bikeIconSize(count: number): number {
  if (count === 0) return 28
  if (count < 500)  return 32
  if (count < 2000) return 38
  if (count < 5000) return 44
  return 50
}

interface Props {
  data: MapDataResponse
}

export default function MapView({ data }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet')

  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const maxCount = Math.max(...data.bicycle_counters.map(c => c.count_7d), 1)

  // Build bike icons keyed by counter id — teal for shared bike+pedestrian, green for bike-only
  const bikeIcons = useMemo(() => new Map(
    data.bicycle_counters.map(c => {
      const sz = bikeIconSize(c.count_7d)
      const bg = c.has_pedestrian ? '#6366f1' : '#2DC653'
      const emoji = c.has_pedestrian ? '🚲🚶' : '🚲'
      const fontSize = c.has_pedestrian ? Math.round(sz * 0.35) : Math.round(sz * 0.5)
      const chip = c.has_pedestrian
        ? `<div style="background:rgba(255,255,255,0.92);border-radius:3px;padding:1px 4px;font-size:9px;font-weight:600;color:#444;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.15)">🚲 ${(c.count_7d / 1000).toFixed(1)}k / 🚶 ${(c.pedestrian_7d / 1000).toFixed(1)}k</div>`
        : ''
      return [c.id, L.divIcon({
        html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:${sz}px;height:${sz}px;background:${bg};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;line-height:1">${emoji}</div>
          ${chip}
        </div>`,
        iconSize: [sz + (c.has_pedestrian ? 40 : 0), sz + 16],
        iconAnchor: [sz / 2 + (c.has_pedestrian ? 20 : 0), sz / 2],
        popupAnchor: [0, -sz / 2],
        className: '',
      })]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [data.bicycle_counters])

  // Build parking icons keyed by parking_id
  const parkingIcons = useMemo(() => new Map(
    (data.parking ?? []).map(p => {
      const col = parkingColor(p.pct_full)
      return [p.parking_id, L.divIcon({
        html: `<div style="width:30px;height:30px;background:${col};border-radius:6px;border:2.5px solid white;box-shadow:0 2px 7px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:white;letter-spacing:-0.5px">P</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
        className: '',
      })]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [data.parking])

  return (
    <MapContainer
      center={[50.075, 14.437]}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <LayersControl position="topright">
        <BaseLayer checked name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
        </BaseLayer>
        <BaseLayer name="CartoDB Light">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          />
        </BaseLayer>

        <Overlay checked name="🚲 Počítadla kol">
          <LayerGroup>
            {data.bicycle_counters.map(c => (
              <Marker
                key={c.id}
                position={[c.lat, c.lon]}
                icon={bikeIcons.get(c.id)!}
              >
                <Popup>
                  <strong>{c.name}</strong><br />
                  Trasa: {c.route || '—'}<br />
                  Posledních 7 dní: <strong>{c.count_7d.toLocaleString('cs-CZ')} cyklistů</strong><br />
                  {c.has_pedestrian && (
                    <>
                      <span style={{ color: '#6366f1', fontSize: 11 }}>
                        🚶 Chodci (7 dní): <strong>{c.pedestrian_7d.toLocaleString('cs-CZ')}</strong>
                      </span>
                      <br />
                    </>
                  )}
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {Math.round(c.count_7d / maxCount * 100)} % nejfrekventovanějšího počítadla
                  </span>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </Overlay>

        <Overlay checked name="🅿️ P+R parkoviště">
          <LayerGroup>
            {(data.parking ?? []).map(p => (
              <Marker
                key={p.parking_id}
                position={[p.lat, p.lon]}
                icon={parkingIcons.get(p.parking_id)!}
              >
                <Popup>
                  <strong>{p.name}</strong><br />
                  Volná místa: <strong>{p.free_spots}</strong> / {p.total_spots}<br />
                  <div style={{ margin: '4px 0 2px', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', width: 140 }}>
                    <div style={{ height: '100%', width: `${Math.min(p.pct_full, 100)}%`, background: parkingColor(p.pct_full), borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <span style={{ color: parkingColor(p.pct_full), fontWeight: 'bold' }}>
                    {p.pct_full.toFixed(0)} % obsazeno
                  </span>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </Overlay>

      </LayersControl>
    </MapContainer>
  )
}

export function MapLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-[#2DC653] border-2 border-white shadow-sm flex items-center justify-center text-[8px]">🚲</div>
        <span>Pouze cyklisté</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-[#6366f1] border-2 border-white shadow-sm flex items-center justify-center text-[7px]">🚲🚶</div>
        <span>Cyklisté + chodci</span>
      </div>
    </div>
  )
}
