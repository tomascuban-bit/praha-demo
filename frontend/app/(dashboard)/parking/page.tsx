'use client'

import ReactECharts from 'echarts-for-react'
import { ParkingCircle, Car, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  useParkingSummary,
  useParkingByOperator,
  useParkingLots,
  useParkingDistribution,
} from '@/lib/api'
import { COLORS } from '@/lib/constants'

const FILL_COLORS: Record<string, string> = {
  '0–25% full':   '#2DC653',
  '25–50% full':  '#86efac',
  '50–75% full':  '#f59e0b',
  '75–90% full':  '#f97316',
  '90–100% full': '#ef4444',
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
  const { data: operators } = useParkingByOperator()
  const { data: lots } = useParkingLots()
  const { data: distribution } = useParkingDistribution()

  // Stacked bar: operators
  const operatorChart = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
    },
    legend: {
      data: ['Free', 'Occupied'],
      top: 0,
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    grid: { left: 16, right: 16, bottom: 0, top: 28, containLabel: true },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#94a3b8' } },
    yAxis: {
      type: 'category',
      data: (operators ?? []).map(o => o.label),
      axisLabel: { fontSize: 11, color: '#475569' },
    },
    series: [
      {
        name: 'Free',
        type: 'bar',
        stack: 'total',
        data: (operators ?? []).map(o => o.free_spots),
        itemStyle: { color: '#2DC653', borderRadius: 0 },
        label: { show: false },
      },
      {
        name: 'Occupied',
        type: 'bar',
        stack: 'total',
        data: (operators ?? []).map(o => o.occupied_spots),
        itemStyle: { color: '#D62828', borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: 'right',
          formatter: (p: { dataIndex: number }) => {
            const op = operators?.[p.dataIndex]
            return op ? `${op.pct_full}% full` : ''
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
      formatter: '{b}: {c} lots ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: '#64748b', fontSize: 11 },
    },
    series: [{
      name: 'Fill level',
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
      label: 'Total Lots',
      value: summary.total_lots,
      sub: `across ${new Set((lots ?? []).map(l => l.source)).size} operators`,
      icon: <ParkingCircle size={18} />,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
    },
    {
      label: 'Total Capacity',
      value: summary.total_spots.toLocaleString(),
      sub: `${summary.free_spots.toLocaleString()} spots free`,
      icon: <Car size={18} />,
      color: 'text-brand-secondary',
      bg: 'bg-brand-secondary/10',
    },
    {
      label: 'City-wide Free',
      value: `${summary.pct_free}%`,
      sub: `${summary.lots_empty} lots under 25% full`,
      icon: <CheckCircle2 size={18} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Nearly Full (>90%)',
      value: summary.lots_full,
      sub: `${summary.lots_available} lots at 25–90%`,
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
          <h1 className="text-2xl font-bold text-brand-secondary">Parking Occupancy</h1>
        </div>
        <p className="text-sm text-gray-500">
          Real-time availability from 98 monitored lots across Czech cities — Prague, Liberec, Hradec Králové, Pilsen, and Bedřichov ski resort.
          Data via Golemio open data platform, refreshed every ~2 hours.
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
        {/* Operator stacked bar — wider */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-1">Capacity by Operator</h2>
          <p className="text-xs text-gray-400 mb-4">Free vs occupied spots per parking network</p>
          {operators ? (
            <ReactECharts
              option={operatorChart}
              style={{ height: Math.max(200, (operators.length * 44)) }}
            />
          ) : (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          )}
        </div>

        {/* Donut — narrower */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-1">Lots by Fill Level</h2>
          <p className="text-xs text-gray-400 mb-4">How full are individual lots right now?</p>
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
            <h2 className="text-sm font-semibold text-brand-secondary">All Lots — by Occupancy</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sorted fullest first</p>
          </div>
          {lots && (
            <span className="text-xs text-gray-400">{lots.length} lots</span>
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Lot ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Operator</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Free</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Occupancy</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Updated</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.parking_id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-gray-500 max-w-[180px] truncate">{lot.parking_id}</td>
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
        <h3 className="text-sm font-semibold text-brand-secondary mb-2">About This Data</h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-600 leading-relaxed">
          <div>
            <span className="font-medium text-brand-secondary">Multiple cities</span> — Golemio aggregates
            parking data from several Czech city operators: TSK Prague (city garages), Smart4City Prague (P+R),
            KORID Liberec (park-and-ride), ISP Hradec Králové, PMDP Pilsen, and even the Bedřichov ski resort.
          </div>
          <div>
            <span className="font-medium text-brand-secondary">Single snapshot</span> — Each pipeline run
            captures a point-in-time reading. Data refreshes every 2 hours via the Golemio v3
            parking-measurements endpoint. Historical trends require adding more frequent pipeline runs.
          </div>
        </div>
      </div>
    </div>
  )
}
