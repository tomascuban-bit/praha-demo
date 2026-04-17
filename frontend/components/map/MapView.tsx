'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, LayerGroup } from 'react-leaflet'
import type { MapDataResponse } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

const { BaseLayer, Overlay } = LayersControl

const AQ_COLORS: Record<number, string> = {
  1: '#00c853', // Excellent
  2: '#64dd17', // Very Good
  3: '#ffd600', // Good
  4: '#ff6d00', // Satisfactory
  5: '#d50000', // Poor
  6: '#6a0dad', // Bad
  7: '#37474f', // Very Bad
}
const AQ_LABELS: Record<number, string> = {
  1: 'Excellent', 2: 'Very Good', 3: 'Good',
  4: 'Satisfactory', 5: 'Poor', 6: 'Bad', 7: 'Very Bad',
}

function aqColor(idx: number | null) {
  if (!idx || idx < 1) return '#9e9e9e'
  return AQ_COLORS[Math.min(idx, 7)] ?? '#9e9e9e'
}

function bikeRadius(count: number) {
  if (count === 0) return 6
  if (count < 500) return 8
  if (count < 2000) return 11
  if (count < 5000) return 14
  return 17
}

interface Props {
  data: MapDataResponse
}

export default function MapView({ data }: Props) {
  useEffect(() => {
    // Fix leaflet default icon path issue in Next.js
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

        <Overlay checked name="🟢 Bicycle Counters">
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
                  Route: {c.route || '—'}<br />
                  Last 7 days: <strong>{c.count_7d.toLocaleString()} cyclists</strong><br />
                  <span style={{ fontSize: 11, color: '#666' }}>
                    {Math.round(c.count_7d / maxCount * 100)}% of busiest counter
                  </span>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </Overlay>

        <Overlay checked name="🟡 Air Quality Stations">
          <LayerGroup>
            {data.air_quality.map(s => (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lon]}
                radius={9}
                pathOptions={{
                  color: aqColor(s.aq_index),
                  fillColor: aqColor(s.aq_index),
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <strong>{s.name}</strong><br />
                  District: {s.district}<br />
                  AQ Index: <strong style={{ color: aqColor(s.aq_index) }}>
                    {s.aq_index != null ? `${s.aq_index} — ${AQ_LABELS[s.aq_index] ?? 'Unknown'}` : 'No data'}
                  </strong><br />
                  <span style={{ fontSize: 11, color: '#666' }}>Updated: {s.updated_at ? new Date(s.updated_at).toLocaleTimeString() : '—'}</span>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </Overlay>
      </LayersControl>
    </MapContainer>
  )
}
