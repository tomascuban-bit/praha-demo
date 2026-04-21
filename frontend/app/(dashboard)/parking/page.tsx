'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { ParkingCircle, Car, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  useParkingSummary,
  useParkingLots,
  useParkingDistribution,
} from '@/lib/api'
import { chartDefaults, COLORS } from '@/lib/constants'
import { useTheme } from '@/lib/theme'

type ChartView = 'pct' | 'abs'

const FILL_COLORS: Record<string, string> = {
  '0–25 % obsazeno':    '#2DC653',
  '25–50 % obsazeno':   '#74c69d',
  '50–75 % obsazeno':   '#f59e0b',
  '75–90 % obsazeno':   '#f97316',
  '90–100 % obsazeno':  '#ef4444',
}

function fillColor(pct: number): string {
  if (pct < 25) return '#2DC653'
  if (pct < 50) return '#86efac'
  if (pct < 75) return '#f59e0b'
  if (pct < 90) return '#f97316'
  return '#ef4444'
}

function OccupancyBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: fillColor(pct) }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500 dark:text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

export default function ParkingPage() {
  const { theme } = useTheme()
  const ct = chartDefaults(theme === 'dark')
  const { data: summary, isLoading: summaryLoading } = useParkingSummary()
  const { data: lots } = useParkingLots()
  const { data: distribution } = useParkingDistribution()
  const [chartView, setChartView] = useState<ChartView>('pct')

  // Sort for each view
  const lotsByPct = [...(lots ?? [])].sort((a, b) => b.pct_full - a.pct_full)
  const lotsByCapacity = [...(lots ?? [])].sort((a, b) => b.total_spots - a.total_spots)
  const displayLots = chartView === 'pct' ? lotsByPct : lotsByCapacity

  const lotNames = displayLots.map(l => l.name || `P+R …${l.parking_id.slice(-6)}`)

  // Occupancy (%) view — bars normalized to 100, length = fill %
  const pctChart = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: ct.tooltipBg,
      borderColor: ct.tooltipBorder,
      textStyle: { color: ct.tooltipText, fontSize: 12 },
      formatter: (params: { dataIndex: number }[]) => {
        const lot = displayLots[params[0]?.dataIndex]
        if (!lot) return ''
        return `<b>${lot.name || lot.parking_id}</b><br/>Obsazeno: ${lot.pct_full.toFixed(0)} % (${lot.occupied_spots}/${lot.total_spots} míst)`
      },
    },
    legend: { data: ['Obsazená', 'Volná'], top: 0, textStyle: { color: ct.dimLabel, fontSize: 11 } },
    grid: { left: 16, right: 100, bottom: 0, top: 28, containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { fontSize: 10, color: ct.axisLabel, formatter: '{value} %' } },
    yAxis: { type: 'category', inverse: true, data: lotNames, axisLabel: { fontSize: 11, color: ct.dimLabel } },
    series: [
      {
        name: 'Obsazená',
        type: 'bar',
        stack: 'total',
        data: displayLots.map(l => +l.pct_full.toFixed(1)),
        itemStyle: { color: '#D62828' },
        barMaxWidth: 20,
      },
      {
        name: 'Volná',
        type: 'bar',
        stack: 'total',
        data: displayLots.map(l => +(100 - l.pct_full).toFixed(1)),
        itemStyle: { color: '#2DC653', borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          formatter: (p: { dataIndex: number }) => {
            const l = displayLots[p.dataIndex]
            return l ? `${l.pct_full.toFixed(0)} %  ${l.occupied_spots}/${l.total_spots} míst` : ''
          },
          fontSize: 10,
          color: '#64748b',
        },
        barMaxWidth: 20,
      },
    ],
  }

  // Absolute capacity view — bars = total spots, stacked obsazeno/volno
  const absChart = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: ct.tooltipBg,
      borderColor: ct.tooltipBorder,
      textStyle: { color: ct.tooltipText, fontSize: 12 },
    },
    legend: { data: ['Obsazená', 'Volná'], top: 0, textStyle: { color: ct.dimLabel, fontSize: 11 } },
    grid: { left: 16, right: 16, bottom: 0, top: 28, containLabel: true },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, color: ct.axisLabel } },
    yAxis: { type: 'category', inverse: true, data: lotNames, axisLabel: { fontSize: 11, color: ct.dimLabel } },
    series: [
      {
        name: 'Obsazená',
        type: 'bar',
        stack: 'total',
        data: displayLots.map(l => l.occupied_spots),
        itemStyle: { color: '#D62828' },
        barMaxWidth: 20,
      },
      {
        name: 'Volná',
        type: 'bar',
        stack: 'total',
        data: displayLots.map(l => l.free_spots),
        itemStyle: { color: '#2DC653', borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 20,
      },
    ],
  }

  const lotsChart = chartView === 'pct' ? pctChart : absChart

  // Donut: distribution by lot count
  const distributionChart = {
    tooltip: {
      trigger: 'item',
      backgroundColor: ct.tooltipBg,
      borderColor: ct.tooltipBorder,
      textStyle: { color: ct.tooltipText, fontSize: 12 },
      formatter: '{b}: {c} parkovišť ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: ct.dimLabel, fontSize: 11 },
      formatter: (name: string) => {
        const item = (distribution ?? []).find(d => d.bucket === name)
        return item ? `${name}  (${item.lot_count})` : name
      },
    },
    series: [{
      name: 'Obsazenost',
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
      data: (distribution ?? []).map(d => ({
        name: d.bucket,
        value: d.lot_count,
        itemStyle: { color: FILL_COLORS[d.bucket] ?? '#94a3b8' },
      })),
    }],
  }

  const kpis = summary ? [
    {
      label: 'P+R parkovišť',
      value: summary.total_lots,
      sub: `monitorovaných TSK Praha`,
      icon: <ParkingCircle size={18} />,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
    },
    {
      label: 'Celková kapacita',
      value: summary.total_spots.toLocaleString('cs-CZ'),
      sub: `${summary.free_spots.toLocaleString('cs-CZ')} míst volných`,
      icon: <Car size={18} />,
      color: 'text-brand-secondary',
      bg: 'bg-brand-secondary/10',
    },
    {
      label: 'Volná místa Praha',
      value: `${summary.pct_free} %`,
      sub: `${summary.lots_empty} parkovišť pod 25 % obsazenosti`,
      icon: <CheckCircle2 size={18} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Téměř plná (>90 %)',
      value: summary.lots_full,
      sub: `${summary.lots_available} parkovišť na 25–90 %`,
      icon: <AlertTriangle size={18} />,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
    },
  ] : []

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ParkingCircle size={20} className="text-brand-primary" />
            <h1 className="text-2xl font-bold text-brand-secondary">Obsazenost P+R parkovišť</h1>
          </div>
          <p className="text-sm text-gray-500">
            Aktuální dostupnost z monitorovaných P+R parkovišť TSK Praha.
            Data přes otevřenou platformu Golemio, obnovována každé ~2 hodiny.
          </p>
        </div>
        {summary?.last_updated && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs text-gray-500 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Aktualizováno{' '}
            <span className="font-medium text-brand-secondary">
              {new Date(summary.last_updated).toLocaleString('cs-CZ', {
                timeZone: 'Europe/Prague',
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* KPI cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-border p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white dark:bg-slate-800 rounded-2xl border border-border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-xl ${k.bg} ${k.color} flex items-center justify-center`}>
                {k.icon}
              </div>
              <div>
                <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
                <div className="text-sm font-medium text-gray-600 mt-0.5">{k.label}</div>
                <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Per-lot stacked bar — wider */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-border p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-brand-secondary">Obsazenost podle parkoviště</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {chartView === 'pct' ? 'Délka pruhu = obsazenost v %, seřazeno od nejplnějšího' : 'Délka pruhu = absolutní počet míst, seřazeno dle kapacity'}
              </p>
            </div>
            {/* View toggle — segmented control */}
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              {([['pct', 'Obsazenost (%)'], ['abs', 'Kapacita']] as [ChartView, string][]).map(([v, label], i) => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={[
                    'px-3 py-1.5 text-xs font-medium transition-all',
                    i > 0 ? 'border-l border-border' : '',
                    chartView === v ? 'bg-brand-primary text-white' : 'bg-surface text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {lots ? (
            <ReactECharts
              option={lotsChart}
              style={{ height: Math.max(200, (displayLots.length * 36)) }}
            />
          ) : (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          )}
        </div>

        {/* Donut — narrower */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-1">Parkoviště dle obsazenosti</h2>
          <p className="text-xs text-gray-400 mb-4">Jak jsou jednotlivá parkoviště obsazená právě teď?</p>
          {distribution ? (
            <ReactECharts option={distributionChart} style={{ height: 220 }} />
          ) : (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          )}
        </div>
      </div>

      {/* Lots table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-border">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-secondary">Všechna parkoviště — dle obsazenosti</h2>
            <p className="text-xs text-gray-400 mt-0.5">Seřazeno od nejplnějšího</p>
          </div>
          {lots && (
            <span className="text-xs text-gray-400">{lots.length} parkovišť</span>
          )}
        </div>
        {!lots ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-surface rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Název / ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Provozovatel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Kapacita</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Volná</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Obsazenost</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Aktualizace</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.parking_id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3">
                      {lot.name ? (
                        <div>
                          <div className="font-medium text-brand-secondary">{lot.name}</div>
                          <div className="font-mono text-xs text-gray-400 truncate max-w-[180px]">{lot.parking_id}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-gray-500 max-w-[180px] truncate block">{lot.parking_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-brand-secondary/8 text-brand-secondary">
                        {lot.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-slate-300">{lot.total_spots}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: fillColor(lot.pct_full) }}>
                      {lot.free_spots}
                    </td>
                    <td className="px-6 py-3">
                      <OccupancyBar pct={lot.pct_full} />
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-gray-400">
                      {lot.last_updated ? new Date(lot.last_updated).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data note */}
      <div className="bg-brand-secondary/[0.03] border border-brand-secondary/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-brand-secondary mb-2">O datech</h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-600 leading-relaxed">
          <div>
            <span className="font-medium text-brand-secondary">TSK Praha P+R parkoviště</span> — Golemio agreguje
            data o obsazenosti parkovišť od TSK (Technická správa komunikací hl. m. Prahy).
            Zahrnuje parkoviště P+R ve vybraných lokalitách v Praze.
          </div>
          <div>
            <span className="font-medium text-brand-secondary">Jeden snímek</span> — Každý běh pipeline
            zachytí aktuální stav v daném okamžiku. Data se obnovují každé 2 hodiny přes endpoint
            Golemio v3 parking-measurements. Historické trendy vyžadují přidání pravidelných běhů pipeline.
          </div>
        </div>
      </div>
    </div>
  )
}
