'use client'

import ReactECharts from 'echarts-for-react'
import { ParkingCircle, Car, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  useParkingSummary,
  useParkingLots,
  useParkingDistribution,
} from '@/lib/api'
import { COLORS } from '@/lib/constants'

const FILL_COLORS: Record<string, string> = {
  '0–25 % obsazeno':    '#2DC653',
  '25–50 % obsazeno':   '#86efac',
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
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: fillColor(pct) }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

export default function ParkingPage() {
  const { data: summary, isLoading: summaryLoading } = useParkingSummary()
  const { data: lots } = useParkingLots()
  const { data: distribution } = useParkingDistribution()

  // Horizontal stacked bar: individual lots (sorted fullest first = inverse axis)
  const lotsChart = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
    },
    legend: {
      data: ['Volná', 'Obsazená'],
      top: 0,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    grid: { left: 16, right: 80, bottom: 0, top: 28, containLabel: true },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94a3b8' } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: (lots ?? []).map(l => l.name || `P+R …${l.parking_id.slice(-6)}`),
      axisLabel: { fontSize: 11, color: '#475569' },
    },
    series: [
      {
        name: 'Volná',
        type: 'bar',
        stack: 'total',
        data: (lots ?? []).map(l => l.free_spots),
        itemStyle: { color: '#2DC653', borderRadius: 0 },
      },
      {
        name: 'Obsazená',
        type: 'bar',
        stack: 'total',
        data: (lots ?? []).map(l => l.occupied_spots),
        itemStyle: { color: '#D62828', borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          formatter: (p: { dataIndex: number }) => {
            const lot = lots?.[p.dataIndex]
            return lot ? `${lot.pct_full.toFixed(0)}%` : ''
          },
          fontSize: 10,
          color: '#64748b',
        },
      },
    ],
  }

  // Donut: distribution by lot count
  const distributionChart = {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
      formatter: '{b}: {c} parkovišť ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: '#64748b', fontSize: 11 },
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

      {/* KPI cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
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
        <div className="lg:col-span-3 bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-1">Obsazenost podle parkoviště</h2>
          <p className="text-xs text-gray-400 mb-4">Volná vs obsazená místa na každém P+R parkovišti</p>
          {lots ? (
            <ReactECharts
              option={lotsChart}
              style={{ height: Math.max(200, (lots.length * 36)) }}
            />
          ) : (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          )}
        </div>

        {/* Donut — narrower */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6">
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
      <div className="bg-white rounded-2xl border border-border">
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Název / ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Provozovatel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kapacita</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Volná</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Obsazenost</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Aktualizace</th>
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
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{lot.total_spots}</td>
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
