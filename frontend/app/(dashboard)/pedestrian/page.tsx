'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Footprints } from 'lucide-react'
import {
  usePedestrianKpis,
  usePedestrianTrend,
  usePedestrianByCounter,
  usePedestrianHourly,
  usePedestrianComparison,
} from '@/lib/api'
import { formatCount, pluralize, COLORS } from '@/lib/constants'

const DAY_OPTIONS = [7, 14, 30, 90]
const PED_COLOR = '#6366f1'

export default function PedestrianPage() {
  const [days, setDays] = useState(30)
  const { data: kpis } = usePedestrianKpis()
  const { data: trend, isLoading: trendLoading } = usePedestrianTrend(days)
  const { data: byCounter, isLoading: counterLoading } = usePedestrianByCounter(days)
  const { data: hourly } = usePedestrianHourly(days)
  const { data: comparison } = usePedestrianComparison(days)

  const availableDays = trend && trend.length > 0 ? trend.length : null
  const dataLimited = availableDays !== null && availableDays < days

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
      name: 'Chodci',
      type: 'bar',
      data: trend?.map(d => d.pedestrians) ?? [],
      itemStyle: { color: PED_COLOR, borderRadius: [3, 3, 0, 0] },
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
      name: 'Prům. chodci',
      type: 'line',
      smooth: true,
      data: Array.from({ length: 24 }, (_, h) => {
        const pt = hourly?.find(p => Number(p.hour) === h)
        return pt?.avg_pedestrians ?? 0
      }),
      itemStyle: { color: PED_COLOR },
      lineStyle: { color: PED_COLOR, width: 2 },
      areaStyle: { color: PED_COLOR + '25' },
    }],
  }

  const comparisonOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: COLORS.border, textStyle: { color: COLORS.brandSecondary, fontSize: 12 } },
    legend: { data: ['Cyklisté', 'Chodci'], bottom: 0, textStyle: { fontSize: 11, color: '#64748b' } },
    grid: { left: 16, right: 16, bottom: 36, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: comparison?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 10, color: '#94a3b8', rotate: days > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#94a3b8' } },
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
        itemStyle: { color: PED_COLOR },
        lineStyle: { color: PED_COLOR, width: 2 },
        areaStyle: { color: PED_COLOR + '20' },
      },
    ],
  }

  const byCounterOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      formatter: (params: { dataIndex: number }[]) => {
        const c = (byCounter ?? [])[params[0].dataIndex]
        return `<span style="font-weight:600">${c?.name || c?.counter_id}</span><br/>Chodci: <b>${(c?.total_pedestrians ?? 0).toLocaleString('cs-CZ')}</b>`
      },
    },
    grid: { left: 8, right: 16, bottom: 8, top: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, color: '#94a3b8' },
      splitLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'category',
      data: (byCounter ?? []).map(c => c.name || c.counter_id),
      axisLabel: { fontSize: 11, color: '#64748b', width: 160, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 18,
      data: (byCounter ?? []).map(c => ({
        value: c.total_pedestrians,
        itemStyle: { color: PED_COLOR, borderRadius: [0, 3, 3, 0] },
      })),
    }],
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Footprints size={20} style={{ color: PED_COLOR }} />
            <h1 className="text-2xl font-bold text-brand-secondary">Chodci v Praze</h1>
          </div>
          <p className="text-sm text-gray-500">Data ze 6 sdílených stezek Golemio — počítadla měřící cyklisty i chodce</p>
        </div>
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
                    ? 'text-white'
                    : exceeds
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-surface',
                ].join(' ')}
                style={days === d ? { backgroundColor: PED_COLOR } : {}}
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Chodci za posl. 7 dní', value: kpis ? formatCount(kpis.total_7d) : '—', desc: 'Součet všech průchodů na 6 sdílených stezkách' },
          { label: 'Průměr / den', value: kpis ? formatCount(kpis.avg_per_day) : '—', desc: 'Průměrný denní počet chodců' },
          { label: 'Špičková hodina', value: kpis?.peak_hour != null ? `${kpis.peak_hour}:00` : '—', desc: 'Hodina s nejvyšším průměrným provozem' },
          { label: 'Aktivní stanice', value: kpis ? String(kpis.active_counters) : '—', desc: 'Počítadla s daty o chodnících' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-border p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: PED_COLOR + '18' }}>
              <Footprints size={18} style={{ color: PED_COLOR }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-secondary tabular-nums">{k.value}</div>
              <div className="text-sm font-medium text-gray-600 mt-0.5">{k.label}</div>
              <div className="text-xs text-gray-400 mt-1 leading-relaxed">{k.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend + Hourly charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Denní počet chodců</h2>
          {trendLoading ? (
            <div className="h-56 animate-pulse bg-surface rounded-xl" />
          ) : (
            <ReactECharts option={trendOption} style={{ height: 224 }} />
          )}
        </div>
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="text-sm font-semibold text-brand-secondary mb-4">Průměr podle hodiny dne</h2>
          <ReactECharts option={hourlyOption} style={{ height: 224 }} />
        </div>
      </div>

      {/* Comparison chart */}
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

      {/* By counter bar chart */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-brand-secondary">
            Počet chodců dle stanice — posl. {dataLimited ? availableDays : days} dní
            {dataLimited && <span className="ml-1 font-normal text-gray-400">(z {days} požadovaných)</span>}
          </h2>
        </div>
        {counterLoading ? (
          <div className="h-48 animate-pulse bg-surface rounded-xl" />
        ) : (
          <ReactECharts option={byCounterOption} style={{ height: 200 }} />
        )}
      </div>
    </div>
  )
}
