'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup } from 'react-leaflet'
import type { MapDataResponse } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

const { BaseLayer, Overlay } = LayersControl

function bikeRadius(count: number) {
  if (count === 0) return 6
  if (count < 500) return 8
  if (count < 2000) return 11
  if (count < 5000) return 14
  return 17
}

function parkingColor(pct: number): string {
  if (pct < 25) return '#2DC653'
  if (pct < 50) return '#86efac'
  if (pct < 75) return '#f59e0b'
  if (pct < 90) return '#f97316'
  return '#ef4444'
}

interface Props {
  data: MapDataResponse
}

export default function MapView({ data }: Props) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet')
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  const maxCount = Math.max(...data.bicycle_counters.map(c => c.count_7d), 1)

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

        <Overlay checked name="🟢 Počítadla kol">
          <LayerGroup>
            {data.bicycle_counters.map(c => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lon]}
                radius={bikeRadius(c.count_7d)}
                pathOptions={{
                  color: '#2DC653',
                  fillColor: '#2DC653',
                  fillOpacity: 0.75,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <strong>{c.name}</strong><br />
                  Trasa: {c.route || '—'}<br />
                  Posledních 7 dní: <strong>{c.count_7d.toLocaleString('cs-CZ')} cyklistů</strong><br />
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {Math.round(c.count_7d / maxCount * 100)} % nejfrekventovanějšího počítadla
                  </span>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </Overlay>

        <Overlay checked name="🅿️ P+R parkoviště">
          <LayerGroup>
            {(data.parking ?? []).map(p => {
              const col = parkingColor(p.pct_full)
              return (
                <CircleMarker
                  key={p.parking_id}
                  center={[p.lat, p.lon]}
                  radius={9}
                  pathOptions={{
                    color: col,
                    fillColor: col,
                    fillOpacity: 0.85,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{p.name}</strong><br />
                    Volná místa: <strong>{p.free_spots}</strong> / {p.total_spots}<br />
                    <span style={{ color: col, fontWeight: 'bold' }}>{p.pct_full.toFixed(0)} % obsazeno</span>
                  </Popup>
                </CircleMarker>
              )
            })}
          </LayerGroup>
        </Overlay>

      </LayersControl>
    </MapContainer>
  )
}
