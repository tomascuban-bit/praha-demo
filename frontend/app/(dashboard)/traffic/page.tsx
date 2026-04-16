'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Car, Gauge } from 'lucide-react'
import { useTrafficTrend, useTrafficByDetector, useTrafficHourly } from '@/lib/api'
import { formatCount, formatSpeed, COLORS } from '@/lib/constants'

const DAY_OPTIONS = [7, 14, 30, 90]

export default function TrafficPage() {
  const [days, setDays] = useState(30)
  const { data: trend, isLoading: trendLoading } = useTrafficTrend(days)
  const { data: byDetector, isLoading: detectorLoading } = useTrafficByDetector(days)
  const { data: hourly } = useTrafficHourly(days)

  const trendOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
    },
    legend: {
      data: ['Vehicles', 'Avg Speed (km/h)'],
      textStyle: { color: COLORS.brandSecondary, fontSize: 11 },
      top: 0,
      right: 0,
    },
    grid: { left: 16, right: 16, bottom: 24, top: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 11, color: '#94a3b8', rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: [
      { type: 'value', name: 'Vehicles', axisLabel: { fontSize: 11, color: '#94a3b8' } },
      { type: 'value', name: 'km/h', axisLabel: { fontSize: 11, color: '#94a3b8' } },
    ],
    series: [
      {
        name: 'Vehicles',
        type: 'bar',
        data: trend?.map(d => d.vehicles) ?? [],
        itemStyle: { color: COLORS.brandPrimary, borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Avg Speed (km/h)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: trend?.map(d => d.avg_speed ?? 0) ?? [],
        itemStyle: { color: COLORS.warning },
        lineStyle: { color: COLORS.warning, width: 2 },
      },
    ],
  }

  const hourlyOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: COLORS.border, textStyle: { color: COLORS.brandSecondary, fontSize: 12 } },
    grid: { left: 16, right: 16, bottom: 24, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { fontSize: 10, color: '#94a3b8' },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#94a3b8' } },
    series: [{
      name: 'Avg Vehicles/h',
      type: 'line',
      smooth: true,
      data: Array.from({ length: 24 }, (_, h) => {
        const pt = hourly?.find(p => Number(p.hour) === h)
        return pt?.avg_vehicles ?? 0
      }),
      itemStyle: { color: COLORS.brandPrimary },
      lineStyle: { color: COLORS.brandPrimary, width: 2 },
      areaStyle: { color: COLORS.brandPrimary + '20' },
    }],
  }

  const topDetectors = (byDetector ?? []).slice(0, 10)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Car size={20} className="text-brand-primary" />
            <h1 className="text-2xl font-bold text-brand-secondary">Prague Traffic</h1>
          </div>
          <p className="text-sm text-gray-500">Traffic intensity and speed from Golemio detector stations</p>
        </div>
        <div className="flex gap-2">
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${days === d ? 'bg-brand-primary text-white' : 'bg-white border border-border text-gray-600 hover:border-brand-primary/50'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Daily Vehicles & Speed</h2>
          {trendLoading ? (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          ) : (
            <ReactECharts option={trendOption} style={{ height: 224 }} />
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Average Traffic by Hour of Day</h2>
          <ReactECharts option={hourlyOption} style={{ height: 224 }} />
        </div>
      </div>

      {/* Top detectors */}
      <div className="bg-white rounded-2xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-brand-secondary">Busiest Detectors — Last {days} Days</h2>
        </div>
        {detectorLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-surface rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Detector</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Road</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg Speed</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Vehicles</th>
                </tr>
              </thead>
              <tbody>
                {topDetectors.map((d, i) => (
                  <tr key={d.detector_id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-brand-secondary">{d.name || d.detector_id}</div>
                      <div className="text-xs text-gray-400 font-mono">{d.detector_id}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-sm">{d.road || '—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 text-warning font-medium">
                        <Gauge size={12} />
                        {d.avg_speed ? formatSpeed(d.avg_speed) : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-brand-primary">
                      {formatCount(d.total_vehicles)}
                    </td>
                  </tr>
                ))}
                {topDetectors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                      No data available — check Keboola pipeline
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
