'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Bike } from 'lucide-react'
import { useCyclingTrend, useCyclingByCounter, useCyclingHourly, usePedestrianComparison } from '@/lib/api'
import { formatCount, pluralize, chartDefaults, COLORS } from '@/lib/constants'
import { useTheme } from '@/lib/theme'

const DAY_OPTIONS = [7, 14, 30, 90]

export default function CyclingPage() {
  const [days, setDays] = useState(30)
  const { data: trend, isLoading: trendLoading } = useCyclingTrend(days)
  const { data: byCounter, isLoading: counterLoading } = useCyclingByCounter(days)
  const { data: hourly } = useCyclingHourly(days)
  const { data: comparison } = usePedestrianComparison(days)
  const { theme } = useTheme()
  const ct = chartDefaults(theme === 'dark')

  const trendOption = {
    tooltip: { trigger: 'axis', backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder, textStyle: { color: ct.tooltipText, fontSize: 12 } },
    grid: { left: 16, right: 16, bottom: 24, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 11, color: ct.axisLabel, rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: ct.axisLine } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: ct.axisLabel } },
    series: [{
      name: 'Cyklisté',
      type: 'bar',
      data: trend?.map(d => d.cyclists) ?? [],
      itemStyle: { color: COLORS.brandAccent, borderRadius: [3, 3, 0, 0] },
    }],
  }

  const hourlyOption = {
    tooltip: { trigger: 'axis', backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder, textStyle: { color: ct.tooltipText, fontSize: 12 } },
    grid: { left: 16, right: 16, bottom: 24, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { fontSize: 10, color: ct.axisLabel },
      axisLine: { lineStyle: { color: ct.axisLine } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: ct.axisLabel } },
    series: [{
      name: 'Prům. cyklisté',
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

  const comparisonOption = {
    tooltip: { trigger: 'axis', backgroundColor: ct.tooltipBg, borderColor: ct.tooltipBorder, textStyle: { color: ct.tooltipText, fontSize: 12 } },
    legend: { data: ['Cyklisté', 'Chodci'], bottom: 0, textStyle: { fontSize: 11, color: ct.dimLabel } },
    grid: { left: 16, right: 16, bottom: 36, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: comparison?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 10, color: ct.axisLabel, rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: ct.axisLine } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: ct.axisLabel } },
    series: [
      {
        name: 'Cyklisté',
        type: 'line',
        smooth: true,
        data: comparison?.map(d => d.cyclists) ?? [],
        itemStyle: { color: COLORS.brandAccent },
        lineStyle: { color: COLORS.brandAccent, width: 2 },
        areaStyle: { color: COLORS.brandAccent + '20' },
      },
      {
        name: 'Chodci',
        type: 'line',
        smooth: true,
        data: comparison?.map(d => d.pedestrians) ?? [],
        itemStyle: { color: '#6366f1' },
        lineStyle: { color: '#6366f1', width: 2 },
        areaStyle: { color: '#6366f120' },
      },
    ],
  }

  // Detect how many days of data are actually available
  const availableDays = trend && trend.length > 0 ? trend.length : null
  const dataLimited = availableDays !== null && availableDays < days

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bike size={20} className="text-brand-accent" />
            <h1 className="text-2xl font-bold text-brand-secondary">Cyklistika v Praze</h1>
          </div>
          <p className="text-sm text-gray-500">Data z počítadel kol Golemio — hodinová měření indukčních smyček</p>
        </div>
        {/* Segmented range control */}
        <div className="flex rounded-xl border border-border overflow-hidden bg-white shrink-0">
          {DAY_OPTIONS.map((d, i) => {
            const exceeds = availableDays !== null && d > availableDays
            return (
              <button
                key={d}
                onClick={() => setDays(d)}
                title={exceeds ? `K dispozici pouze ${availableDays} dní dat` : undefined}
                className={[
                  'px-3 py-1.5 text-xs font-medium transition-all',
                  i > 0 ? 'border-l border-border' : '',
                  days === d
                    ? 'bg-brand-accent text-white'
                    : exceeds
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-surface',
                ].join(' ')}
              >
                {d} dní
              </button>
            )
          })}
        </div>
      </div>

      {/* Data availability notice */}
      {dataLimited && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <span>⚠</span>
          <span>Data dostupná pouze za poslední <strong>{availableDays} {availableDays !== null && pluralize(availableDays, { one: 'den', few: 'dny', many: 'dní' })}</strong>. Rozsah <strong>{days} dní</strong> bude dostupný po delším sběru dat.</span>
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Denní počet cyklistů</h2>
          {trendLoading ? (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          ) : (
            <ReactECharts option={trendOption} style={{ height: 224 }} />
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Průměr podle hodiny dne</h2>
          <ReactECharts option={hourlyOption} style={{ height: 224 }} />
        </div>
      </div>

      {/* Cyclist vs pedestrian comparison */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-brand-secondary">Cyklisté vs. chodci na sdílených stezkách</h2>
          <p className="text-xs text-gray-400 mt-0.5">Srovnání denních průjezdů na 6 počítadlech, která měří oba typy pohybu</p>
        </div>
        {comparison && comparison.length > 0 ? (
          <ReactECharts option={comparisonOption} style={{ height: 240 }} />
        ) : (
          <div className="h-60 flex items-center justify-center text-gray-400 text-sm">Žádná data k dispozici</div>
        )}
      </div>

      {/* Top counters table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-brand-secondary">
            Nejaktivnější počítadla — posl. {dataLimited ? availableDays : days} dní
            {dataLimited && <span className="ml-1 font-normal text-gray-400">(z {days} požadovaných)</span>}
          </h2>
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Počítadlo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Trasa</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Celkem cyklistů</th>
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
                    <td className="px-4 py-3.5 text-gray-500 dark:text-slate-400 text-sm">{c.route || '—'}</td>
                    <td className="px-6 py-3.5 text-right font-semibold tabular-nums text-brand-accent">
                      {formatCount(c.total_cyclists)}
                    </td>
                  </tr>
                ))}
                {topCounters.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                      Žádná data — zkontrolujte pipeline Keboola
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
