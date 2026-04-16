'use client'

import { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Bike, Car, Gauge, Radio, TrendingUp, Activity } from 'lucide-react'
import { useKpis, useOverviewChart } from '@/lib/api'
import { formatCount, formatSpeed, COLORS } from '@/lib/constants'
import type { KpiItem } from '@/lib/types'

const ICON_MAP: Record<string, React.ReactNode> = {
  bike:   <Bike size={18} />,
  car:    <Car size={18} />,
  speed:  <Gauge size={18} />,
  sensor: <Radio size={18} />,
  trend:  <TrendingUp size={18} />,
}

function KpiCard({ item }: { item: KpiItem }) {
  const icon = ICON_MAP[item.icon || ''] ?? <Activity size={18} />
  const isSpeed = item.icon === 'speed'
  const displayValue = isSpeed ? formatSpeed(item.value) : formatCount(item.value)

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

export default function OverviewPage() {
  const { data: kpis, isLoading: kpisLoading } = useKpis()
  const { data: chart, isLoading: chartLoading } = useOverviewChart()

  const chartOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: COLORS.border,
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
    },
    legend: {
      data: ['Cyclists', 'Vehicles'],
      textStyle: { color: COLORS.brandSecondary, fontSize: 12 },
      top: 0,
      right: 0,
    },
    grid: { left: 16, right: 16, bottom: 24, top: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: chart?.map(d => d.date) ?? [],
      axisLabel: { fontSize: 11, color: '#94a3b8', rotate: chart && chart.length > 30 ? 30 : 0 },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: [
      { type: 'value', name: 'Cyclists', nameTextStyle: { color: '#94a3b8', fontSize: 11 }, axisLabel: { fontSize: 11, color: '#94a3b8' } },
      { type: 'value', name: 'Vehicles', nameTextStyle: { color: '#94a3b8', fontSize: 11 }, axisLabel: { fontSize: 11, color: '#94a3b8' } },
    ],
    series: [
      {
        name: 'Cyclists',
        type: 'line',
        smooth: true,
        data: chart?.map(d => d.cyclists) ?? [],
        itemStyle: { color: COLORS.brandAccent },
        lineStyle: { color: COLORS.brandAccent, width: 2 },
        areaStyle: { color: COLORS.brandAccent + '20' },
      },
      {
        name: 'Vehicles',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: chart?.map(d => d.vehicles) ?? [],
        itemStyle: { color: COLORS.brandPrimary },
        lineStyle: { color: COLORS.brandPrimary, width: 2 },
        areaStyle: { color: COLORS.brandPrimary + '15' },
      },
    ],
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-brand-secondary">Prague Mobility Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time cycling and traffic data from the{' '}
          <a href="https://api.golemio.cz/docs/public-openapi/" target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">
            Golemio open data platform
          </a>
          , delivered via Keboola.
        </p>
      </div>

      {/* KPI cards */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis?.map(kpi => <KpiCard key={kpi.label} item={kpi} />)}
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="text-base font-semibold text-brand-secondary mb-1">Daily Mobility Trends</h2>
        <p className="text-xs text-gray-400 mb-5">Cyclists (left axis) vs. vehicle passages (right axis)</p>
        {chartLoading ? (
          <div className="h-72 animate-pulse bg-surface rounded-xl" />
        ) : (
          <ReactECharts option={chartOption} style={{ height: 288 }} />
        )}
      </div>

      {/* Data sources */}
      <div className="bg-brand-secondary/[0.03] border border-brand-secondary/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-brand-secondary mb-3">About This Dashboard</h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-600 leading-relaxed">
          <div>
            <span className="font-medium text-brand-secondary">Bicycle Counters</span> — Golemio API provides hourly
            passage counts from induction loop sensors installed on Prague's cycling infrastructure.
            Data is extracted daily via Keboola and stored in Snowflake.
          </div>
          <div>
            <span className="font-medium text-brand-secondary">Traffic Detectors</span> — Prague city traffic monitoring
            stations measure vehicle intensity (vehicles/hour), speed, and occupancy. Extracted via Keboola
            Generic REST extractor from the Golemio REST API.
          </div>
        </div>
      </div>
    </div>
  )
}
