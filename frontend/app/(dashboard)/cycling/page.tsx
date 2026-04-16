'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Bike } from 'lucide-react'
import { useCyclingTrend, useCyclingByCounter, useCyclingHourly } from '@/lib/api'
import { formatCount, COLORS } from '@/lib/constants'

const DAY_OPTIONS = [7, 14, 30, 90]

export default function CyclingPage() {
  const [days, setDays] = useState(30)
  const { data: trend, isLoading: trendLoading } = useCyclingTrend(days)
  const { data: byCounter, isLoading: counterLoading } = useCyclingByCounter(days)
  const { data: hourly } = useCyclingHourly(days)

  const trendOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: COLORS.border, textStyle: { color: COLORS.brandSecondary, fontSize: 12 } },
    grid: { left: 16, right: 16, bottom: 24, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 11, color: '#94a3b8', rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#94a3b8' } },
    series: [{
      name: 'Cyclists',
      type: 'bar',
      data: trend?.map(d => d.cyclists) ?? [],
      itemStyle: { color: COLORS.brandAccent, borderRadius: [3, 3, 0, 0] },
    }],
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
      name: 'Avg Cyclists',
      type: 'line',
      smooth: true,
      data: Array.from({ length: 24 }, (_, h) => {
        const pt = hourly?.find(p => Number(p.hour) === h)
        return pt?.avg_cyclists ?? 0
      }),
      itemStyle: { color: COLORS.brandAccent },
      lineStyle: { color: COLORS.brandAccent, width: 2 },
      areaStyle: { color: COLORS.brandAccent + '25' },
    }],
  }

  const topCounters = (byCounter ?? []).slice(0, 10)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bike size={20} className="text-brand-accent" />
            <h1 className="text-2xl font-bold text-brand-secondary">Cycling in Prague</h1>
          </div>
          <p className="text-sm text-gray-500">Bicycle counter data from Golemio — hourly induction loop measurements</p>
        </div>
        <div className="flex gap-2">
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${days === d ? 'bg-brand-accent text-white' : 'bg-white border border-border text-gray-600 hover:border-brand-accent/50'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Daily Cyclist Count</h2>
          {trendLoading ? (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          ) : (
            <ReactECharts option={trendOption} style={{ height: 224 }} />
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Average by Hour of Day</h2>
          <ReactECharts option={hourlyOption} style={{ height: 224 }} />
        </div>
      </div>

      {/* Top counters table */}
      <div className="bg-white rounded-2xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-brand-secondary">Top Bicycle Counters — Last {days} Days</h2>
        </div>
        {counterLoading ? (
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Counter</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Route</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Cyclists</th>
                </tr>
              </thead>
              <tbody>
                {topCounters.map((c, i) => (
                  <tr key={c.counter_id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-brand-secondary">{c.name || c.counter_id}</div>
                      <div className="text-xs text-gray-400 font-mono">{c.counter_id}</div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-sm">{c.route || '—'}</td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-brand-accent">
                      {formatCount(c.total_cyclists)}
                    </td>
                  </tr>
                ))}
                {topCounters.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
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
