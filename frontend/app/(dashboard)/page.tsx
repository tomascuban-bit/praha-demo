'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Bike, Radio, TrendingUp, Activity, PersonStanding, ParkingCircle } from 'lucide-react'
import { useKpis, useOverviewChart, useParkingLots } from '@/lib/api'
import { formatCount, formatSpeed, pluralize, COLORS } from '@/lib/constants'
import type { KpiItem } from '@/lib/types'

const ICON_MAP: Record<string, React.ReactNode> = {
  bike:    <Bike size={18} />,
  sensor:  <Radio size={18} />,
  trend:   <TrendingUp size={18} />,
  walk:    <PersonStanding size={18} />,
  parking: <ParkingCircle size={18} />,
}

function KpiCard({ item }: { item: KpiItem }) {
  const icon = ICON_MAP[item.icon || ''] ?? <Activity size={18} />
  const isSpeed = item.icon === 'speed'
  const isPercent = (item as KpiItem & { unit?: string }).unit === '%'
  const value = item.value

  let displayValue: string
  if (value == null) {
    displayValue = '—'
  } else if (isSpeed) {
    displayValue = formatSpeed(value)
  } else if (isPercent) {
    displayValue = `${value}%`
  } else {
    displayValue = formatCount(value)
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-brand-secondary tabular-nums">{displayValue}</div>
        <div className="text-sm font-medium text-gray-600 mt-0.5">{item.label}</div>
        <div className="text-xs text-gray-400 mt-1 leading-relaxed">{item.description}</div>
      </div>
    </div>
  )
}

const DAY_OPTIONS = [7, 14, 30, 90]

function parkingColor(pct: number): string {
  if (pct < 25) return '#2DC653'
  if (pct < 50) return '#74c69d'
  if (pct < 75) return '#f59e0b'
  if (pct < 90) return '#f97316'
  return '#ef4444'
}

export default function OverviewPage() {
  const [days, setDays] = useState(30)
  const { data: kpis, isLoading: kpisLoading } = useKpis()
  const { data: chart, isLoading: chartLoading } = useOverviewChart(days)
  const { data: parkingLots, isLoading: parkingLoading } = useParkingLots()
  const availableDays = chart && chart.length > 0 ? chart.length : null

  const sortedLots = parkingLots ? [...parkingLots].sort((a, b) => a.pct_full - b.pct_full) : []
  const parkingLastUpdated = parkingLots?.length
    ? (() => {
        const ts = parkingLots.map(l => l.last_updated).filter(Boolean).sort().at(-1)
        if (!ts) return null
        try {
          return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' })
        } catch { return null }
      })()
    : null

  const parkingChartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      formatter: (params: { dataIndex: number }[]) => {
        const lot = sortedLots[params[0].dataIndex]
        return `<span style="font-weight:600">${lot.name}</span><br/>Obsazeno: <b>${lot.pct_full} %</b><br/>Volná místa: <b>${lot.free_spots}</b> z <b>${lot.total_spots}</b>`
      },
    },
    grid: { left: 8, right: 16, bottom: 8, top: 8, containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value} %', fontSize: 11, color: '#94a3b8' },
      splitLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'category',
      data: sortedLots.map(l => l.name),
      axisLabel: { fontSize: 11, color: '#64748b', width: 160, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 18,
      data: sortedLots.map(lot => ({
        value: lot.pct_full,
        itemStyle: { color: parkingColor(lot.pct_full), borderRadius: [0, 3, 3, 0] },
      })),
    }],
  }

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
    },
    grid: { left: 16, right: 16, bottom: 24, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: chart?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 11, color: '#94a3b8', rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, color: '#94a3b8' },
    },
    series: [
      {
        name: 'Cyklisté',
        type: 'line',
        smooth: true,
        data: chart?.map(d => d.cyclists) ?? [],
        itemStyle: { color: COLORS.brandAccent },
        lineStyle: { color: COLORS.brandAccent, width: 2 },
        areaStyle: { color: COLORS.brandAccent + '20' },
      },
    ],
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-brand-secondary">Přehled mobility Prahy</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aktuální data o cyklistice z{' '}
          <a href="https://api.golemio.cz/docs/public-openapi/" target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">
            otevřené datové platformy Golemio
          </a>
          , doručená přes Keboola.
        </p>
      </div>

      {/* KPI cards */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {kpis?.map(kpi => <KpiCard key={kpi.label} item={kpi} />)}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="text-base font-semibold text-brand-secondary">Denní trend cyklistů</h2>
            <p className="text-xs text-gray-400 mt-0.5">Celkový počet průjezdů kol za den na všech počítadlech Golemio</p>
          </div>
          <div className="flex rounded-xl border border-border overflow-hidden bg-white shrink-0">
            {DAY_OPTIONS.map((d, i) => {
              const exceeds = availableDays !== null && d > availableDays
              return (
                <button
                  key={d}
                  onClick={() => !exceeds && setDays(d)}
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
        {availableDays !== null && availableDays < days && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4">
            <span>⚠</span>
            <span>Data dostupná pouze za poslední <strong>{availableDays} {availableDays !== null && pluralize(availableDays, { one: 'den', few: 'dny', many: 'dní' })}</strong>. Rozsah <strong>{days} dní</strong> bude dostupný po delším sběru dat.</span>
          </div>
        )}
        {chartLoading ? (
          <div className="h-72 animate-pulse bg-surface rounded-xl" />
        ) : (
          <ReactECharts option={chartOption} style={{ height: 288 }} />
        )}
      </div>

      {/* Parking chart */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-brand-secondary">Obsazenost P+R parkovišť</h2>
            <p className="text-xs text-gray-400 mt-0.5">Aktuální stav 17 parkovišť TSK Praha — procento obsazených míst</p>
          </div>
          {parkingLastUpdated && (
            <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Aktualizováno {parkingLastUpdated}
            </span>
          )}
        </div>
        {parkingLoading ? (
          <div className="h-96 animate-pulse bg-surface rounded-xl" />
        ) : (
          <ReactECharts option={parkingChartOption} style={{ height: 420 }} />
        )}
      </div>

      {/* Data sources */}
      <div className="bg-brand-secondary/[0.03] border border-brand-secondary/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-brand-secondary mb-3">O dashboardu</h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-600 leading-relaxed">
          <div>
            <span className="font-medium text-brand-secondary">Počítadla cyklistů a chodců</span> — Golemio API poskytuje
            hodinové počty průjezdů z indukčních smyček instalovaných na pražské cyklistické infrastruktuře.
            Počty chodců pocházejí ze stejných senzorů na sdílených stezkách.
          </div>
          <div>
            <span className="font-medium text-brand-secondary">Parkování</span> — Aktuální obsazenost
            P+R parkovišť TSK Praha. Obnovováno každé 2 hodiny přes pipeline Keboola z otevřených dat Golemio.
          </div>
        </div>
      </div>
    </div>
  )
}
