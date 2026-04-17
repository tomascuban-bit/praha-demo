'use client'

import { useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { BarChart2, Play, RefreshCw, Download, FileDown } from 'lucide-react'
import { useDataSchema, useQueryData } from '@/lib/api'
import { COLORS } from '@/lib/constants'

interface ChartConfig {
  source: string
  dimension: string
  measures: string[]
}

export default function ReportBuilderPage() {
  const chartRef = useRef<ReactECharts>(null)

  const { data: schema } = useDataSchema()
  const [config, setConfig] = useState<ChartConfig | null>(null)
  const [pending, setPending] = useState<Partial<ChartConfig>>({})
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')

  const { data: result, isLoading, refetch } = useQueryData(config)

  // Restore state from URL on mount (window.location avoids Suspense requirement)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const src = sp.get('src')
    const dim = sp.get('dim')
    const msr = sp.get('msr')
    const ct = sp.get('ct') as 'bar' | 'line' | null
    if (src && dim && msr) {
      const cfg: ChartConfig = { source: src, dimension: dim, measures: [msr] }
      setPending(cfg)
      setConfig(cfg)
      if (ct === 'bar' || ct === 'line') setChartType(ct)
    }
  }, [])

  const sources = schema?.sources ?? []
  const selectedSource = sources.find(s => s.id === pending.source)

  const isReady = !!(pending.source && pending.dimension && pending.measures?.length)
  const missingFields = !pending.source ? 'zdroj dat' : !pending.dimension ? 'dimenzi' : 'ukazatel'

  const handleRun = () => {
    if (!isReady) return
    const cfg = pending as ChartConfig
    setConfig(cfg)
    const params = new URLSearchParams({
      src: cfg.source,
      dim: cfg.dimension,
      msr: cfg.measures[0],
      ct: chartType,
    })
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  const handleDownloadCsv = () => {
    if (!result) return
    const lines = [result.headers.join(','), ...result.rows.map(r => r.join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `praha-data-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPng = () => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
    const a = document.createElement('a')
    a.href = url
    a.download = `praha-graf-${Date.now()}.png`
    a.click()
  }

  const chartOption = (() => {
    if (!result || !result.headers.length) return null
    const [, ...measureHeaders] = result.headers
    const categories = result.rows.map(r => r[0])
    const series = measureHeaders.map((name, idx) => ({
      name,
      type: chartType,
      data: result.rows.map(r => parseFloat(r[idx + 1]) || 0),
      itemStyle: { color: COLORS.chart[idx % COLORS.chart.length], borderRadius: chartType === 'bar' ? [3, 3, 0, 0] : 0 },
      smooth: chartType === 'line',
    }))
    return {
      tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: COLORS.border, textStyle: { color: COLORS.brandSecondary, fontSize: 12 } },
      legend: { data: measureHeaders, textStyle: { color: COLORS.brandSecondary, fontSize: 11 }, top: 0 },
      grid: { left: 16, right: 16, bottom: 40, top: 36, containLabel: true },
      xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 10, color: '#94a3b8', rotate: categories.length > 20 ? 40 : 0 }, axisLine: { lineStyle: { color: COLORS.border } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#94a3b8' } },
      series,
    }
  })()

  const CHART_LABELS: Record<string, string> = { bar: 'Sloupcový', line: 'Čárový' }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={20} className="text-brand-primary" />
          <h1 className="text-2xl font-bold text-brand-secondary">Sestavy</h1>
        </div>
        <p className="text-sm text-gray-500">Vytvořte vlastní grafy z dat pražské mobility — bez kódu</p>
      </div>

      {/* Builder panel */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="grid md:grid-cols-4 gap-4">
          {/* Source */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zdroj dat</label>
            <select
              value={pending.source ?? ''}
              onChange={e => setPending({ source: e.target.value, dimension: undefined, measures: [] })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary transition-colors"
            >
              <option value="">Vyberte zdroj…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Dimension */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Seskupit dle</label>
            <select
              value={pending.dimension ?? ''}
              onChange={e => setPending(p => ({ ...p, dimension: e.target.value }))}
              disabled={!selectedSource}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-50"
            >
              <option value="">Vyberte dimenzi…</option>
              {selectedSource?.dimensions.map(d => <option key={d.column} value={d.column}>{d.label}</option>)}
            </select>
          </div>

          {/* Measures */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ukazatel</label>
            <select
              value={pending.measures?.[0] ?? ''}
              onChange={e => setPending(p => ({ ...p, measures: [e.target.value] }))}
              disabled={!selectedSource}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-50"
            >
              <option value="">Vyberte ukazatel…</option>
              {selectedSource?.measures.map(m => <option key={m.column} value={m.column}>{m.label}</option>)}
            </select>
          </div>

          {/* Chart type + Run */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Typ grafu</label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden flex-1">
                {(['bar', 'line'] as const).map((t, i) => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={[
                      'flex-1 py-2 text-xs font-medium transition-all',
                      i > 0 ? 'border-l border-border' : '',
                      chartType === t ? 'bg-brand-primary text-white' : 'bg-surface text-gray-600 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {CHART_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleRun}
                  disabled={!isReady}
                  title={!isReady ? `Vyberte ${missingFields}` : undefined}
                  className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <Play size={13} />
                  Spustit
                </button>
                {!isReady && (
                  <span className="text-[10px] text-gray-400">Vyberte {missingFields}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart result */}
      <div className="bg-white rounded-2xl border border-border">
        {isLoading ? (
          <div className="p-6">
            <div className="h-72 animate-pulse bg-surface rounded-xl" />
          </div>
        ) : chartOption ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-brand-secondary">
                {result?.headers.join(' × ')}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPng}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors"
                  title="Stáhnout graf jako PNG"
                >
                  <Download size={12} />
                  PNG
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors"
                  title="Stáhnout data jako CSV"
                >
                  <FileDown size={12} />
                  CSV
                </button>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <RefreshCw size={12} />
                  Obnovit
                </button>
              </div>
            </div>
            <ReactECharts ref={chartRef} option={chartOption} style={{ height: 320 }} />
          </div>
        ) : config ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart2 size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Žádná data pro tuto kombinaci</p>
            <p className="text-xs text-gray-300 mt-1">Zkuste jiný zdroj nebo dimenzi</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart2 size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Vyberte zdroj dat, dimenzi a ukazatel</p>
            <p className="text-xs text-gray-300 mt-1">K dispozici jsou data cyklistiky v Praze</p>
          </div>
        )}
      </div>

      {/* Raw data table */}
      {result && result.rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-secondary">Surová data ({result.rows.length} řádků)</h2>
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors"
            >
              <FileDown size={12} />
              Stáhnout CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border">
                  {result.headers.map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface/50">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2.5 text-xs tabular-nums text-brand-secondary">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
