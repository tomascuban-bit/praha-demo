'use client'

import { useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { BarChart2, Play, RefreshCw, Download, FileDown, Bookmark, X, Check } from 'lucide-react'
import { useDataSchema, useQueryData, useDimensionValues } from '@/lib/api'
import { COLORS } from '@/lib/constants'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [7, 14, 30, 90] as const
const DAYS_LABELS: Record<number, string> = { 7: '7 dní', 14: '14 dní', 30: '30 dní', 90: '90 dní' }
const CHART_LABELS: Record<string, string> = { bar: 'Sloupcový', line: 'Čárový' }
const GRAN_OPTIONS = ['hour', 'day', 'week', 'month'] as const
const GRAN_LABELS: Record<string, string> = { hour: 'Hodina', day: 'Den', week: 'Týden', month: 'Měsíc' }
const TOPN_OPTIONS = [undefined, 5, 10, 20] as const
const STORAGE_KEY = 'praha-reporty-v1'

type Granularity = typeof GRAN_OPTIONS[number]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartConfig {
  source: string
  dimension: string
  measures: string[]
  days?: number
  filterCol?: string
  filterVal?: string
  granularity?: Granularity
  topN?: number
  sortDir?: 'asc' | 'desc'
}

interface SavedReport {
  id: string
  name: string
  config: ChartConfig
  chartType: 'bar' | 'line'
  savedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cfgToParams(cfg: ChartConfig, ct: string): URLSearchParams {
  const p = new URLSearchParams({ src: cfg.source, dim: cfg.dimension, msr: cfg.measures.join(','), ct })
  if (cfg.days)       p.set('days', String(cfg.days))
  if (cfg.filterCol)  p.set('fc', cfg.filterCol)
  if (cfg.filterVal)  p.set('fv', cfg.filterVal)
  if (cfg.granularity && cfg.granularity !== 'day') p.set('gran', cfg.granularity)
  if (cfg.topN)       p.set('tn', String(cfg.topN))
  if (cfg.sortDir && cfg.sortDir !== 'desc') p.set('sd', cfg.sortDir)
  return p
}

function loadReports(): SavedReport[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportBuilderPage() {
  const chartRef = useRef<ReactECharts>(null)
  const { data: schema } = useDataSchema()

  const [config, setConfig]         = useState<ChartConfig | null>(null)
  const [pending, setPending]       = useState<Partial<ChartConfig>>({})
  const [chartType, setChartType]   = useState<'bar' | 'line'>('bar')
  const [saving, setSaving]         = useState(false)
  const [saveName, setSaveName]     = useState('')
  const [savedReports, setSavedReports] = useState<SavedReport[]>(loadReports)

  const { data: result, isLoading, refetch } = useQueryData(config)

  const sources          = schema?.sources ?? []
  const selectedSource   = sources.find(s => s.id === pending.source)
  const selectedDimension = selectedSource?.dimensions.find(d => d.column === pending.dimension)
  const filterableBy     = selectedDimension?.filterable_by ?? null
  const isDateDim        = selectedDimension?.is_date ?? false

  const { data: filterValues } = useDimensionValues(
    filterableBy ? (pending.source ?? null) : null,
    filterableBy?.column ?? null,
  )

  // Restore from URL on mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const src = sp.get('src'), dim = sp.get('dim'), msr = sp.get('msr')
    const ct = sp.get('ct') as 'bar' | 'line' | null
    if (src && dim && msr) {
      const cfg: ChartConfig = {
        source: src, dimension: dim,
        measures: msr.split(',').filter(Boolean),
        ...(sp.get('days')  ? { days: Number(sp.get('days')) }             : {}),
        ...(sp.get('fc') && sp.get('fv') ? { filterCol: sp.get('fc')!, filterVal: sp.get('fv')! } : {}),
        ...(sp.get('gran')  ? { granularity: sp.get('gran') as Granularity } : {}),
        ...(sp.get('tn')    ? { topN: Number(sp.get('tn')) }               : {}),
        ...(sp.get('sd')    ? { sortDir: sp.get('sd') as 'asc' | 'desc' } : {}),
      }
      setPending(cfg)
      setConfig(cfg)
      if (ct === 'bar' || ct === 'line') setChartType(ct)
    }
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  const isReady      = !!(pending.source && pending.dimension && pending.measures?.length)
  const missingFields = !pending.source ? 'zdroj dat' : !pending.dimension ? 'dimenzi' : 'ukazatel'
  const currentGran  = pending.granularity ?? 'day'
  const currentSort  = pending.sortDir ?? 'desc'
  const currentTopN  = pending.topN

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRun = () => {
    if (!isReady) return
    const cfg = pending as ChartConfig
    setConfig(cfg)
    window.history.replaceState(null, '', `?${cfgToParams(cfg, chartType).toString()}`)
  }

  const toggleMeasure = (col: string) =>
    setPending(p => {
      const cur = p.measures ?? []
      return { ...p, measures: cur.includes(col) ? cur.filter(m => m !== col) : [...cur, col] }
    })

  const persistReports = (list: SavedReport[]) => {
    setSavedReports(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  const handleSave = () => {
    if (!saveName.trim() || !config) return
    persistReports([...savedReports, {
      id: Date.now().toString(),
      name: saveName.trim(),
      config: { ...config },
      chartType,
      savedAt: new Date().toISOString(),
    }])
    setSaving(false)
    setSaveName('')
  }

  const handleDeleteReport = (id: string) =>
    persistReports(savedReports.filter(r => r.id !== id))

  const handleLoadReport = (r: SavedReport) => {
    setPending(r.config)
    setConfig(r.config)
    setChartType(r.chartType)
    window.history.replaceState(null, '', `?${cfgToParams(r.config, r.chartType).toString()}`)
  }

  const handleDownloadCsv = () => {
    if (!result) return
    const lines = [result.headers.join(','), ...result.rows.map(r => r.join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `praha-data-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPng = () => {
    const inst = chartRef.current?.getEchartsInstance()
    if (!inst) return
    const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
    const a = document.createElement('a'); a.href = url; a.download = `praha-graf-${Date.now()}.png`; a.click()
  }

  // ── Chart option ───────────────────────────────────────────────────────────

  const chartOption = (() => {
    if (!result?.headers.length) return null
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
      grid: { left: 16, right: 16, bottom: 40, top: measureHeaders.length > 1 ? 36 : 16, containLabel: true },
      xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 10, color: '#94a3b8', rotate: categories.length > 20 ? 40 : 0 }, axisLine: { lineStyle: { color: COLORS.border } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, color: '#94a3b8' } },
      series,
    }
  })()

  // ── Style helpers ──────────────────────────────────────────────────────────

  const selectCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-40'
  const labelCls  = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'
  const segBtn    = (active: boolean, extra = '') =>
    ['flex-1 py-2 text-xs font-medium transition-all border-l border-border first:border-l-0',
     active ? 'bg-brand-primary text-white' : 'bg-surface text-gray-600 hover:bg-gray-50', extra].join(' ')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={20} className="text-brand-primary" />
          <h1 className="text-2xl font-bold text-brand-secondary">Reporty</h1>
        </div>
        <p className="text-sm text-gray-500">Vytvořte vlastní grafy z dat pražské mobility — bez kódu</p>
      </div>

      {/* Saved reports strip */}
      {savedReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-border px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Uložené reporty</p>
          <div className="flex flex-wrap gap-2">
            {savedReports.map(r => (
              <div key={r.id} className="flex items-center gap-0 rounded-lg border border-border overflow-hidden text-xs">
                <button
                  onClick={() => handleLoadReport(r)}
                  className="px-3 py-1.5 text-brand-secondary hover:text-brand-primary hover:bg-surface transition-colors font-medium"
                >
                  {r.name}
                </button>
                <button
                  onClick={() => handleDeleteReport(r.id)}
                  className="px-2 py-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors border-l border-border"
                  title="Smazat report"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Builder panel */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">

        {/* Row 1: Source / Dimension / Filter / Period */}
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Zdroj dat</label>
            <select value={pending.source ?? ''} onChange={e => setPending({ source: e.target.value })} className={selectCls}>
              <option value="">Vyberte zdroj…</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Seskupit dle</label>
            <select
              value={pending.dimension ?? ''}
              onChange={e => setPending(p => ({ ...p, dimension: e.target.value, filterCol: undefined, filterVal: undefined, granularity: undefined, topN: undefined }))}
              disabled={!selectedSource}
              className={selectCls}
            >
              <option value="">Vyberte dimenzi…</option>
              {selectedSource?.dimensions.map(d => <option key={d.column} value={d.column}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className={[labelCls, !filterableBy ? 'opacity-40' : ''].join(' ')}>
              {filterableBy ? `Filtrovat: ${filterableBy.label}` : 'Filtrovat dle'}
            </label>
            <select
              value={pending.filterVal ?? ''}
              onChange={e => setPending(p => ({ ...p, filterCol: filterableBy?.column, filterVal: e.target.value || undefined }))}
              disabled={!filterableBy}
              className={selectCls}
            >
              <option value="">Vše</option>
              {filterValues?.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className={[labelCls, !selectedSource?.supports_period ? 'opacity-40' : ''].join(' ')}>Období</label>
            {selectedSource?.supports_period ? (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button onClick={() => setPending(p => ({ ...p, days: undefined }))} className={segBtn(!pending.days, 'border-l-0')}>Vše</button>
                {DAYS_OPTIONS.map(d => (
                  <button key={d} onClick={() => setPending(p => ({ ...p, days: d }))} className={segBtn(pending.days === d)}>
                    {DAYS_LABELS[d]}
                  </button>
                ))}
              </div>
            ) : (
              <div className={[selectCls, 'opacity-40 pointer-events-none flex items-center'].join(' ')}>—</div>
            )}
          </div>
        </div>

        {/* Row 2: Measures + Chart type + Run */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Ukazatele</label>
            {selectedSource ? (
              <div className="flex flex-wrap gap-3">
                {selectedSource.measures.map(m => (
                  <label key={m.column} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={pending.measures?.includes(m.column) ?? false}
                      onChange={() => toggleMeasure(m.column)}
                      className="w-4 h-4 rounded accent-brand-primary cursor-pointer"
                    />
                    <span className="text-sm text-brand-secondary group-hover:text-brand-primary transition-colors">{m.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-1">Nejprve vyberte zdroj dat</p>
            )}
          </div>

          <div className="flex items-end gap-2 flex-shrink-0">
            <div>
              <label className={labelCls}>Typ grafu</label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['bar', 'line'] as const).map((t, i) => (
                  <button key={t} onClick={() => setChartType(t)}
                    className={['px-4 py-2 text-xs font-medium transition-all', i > 0 ? 'border-l border-border' : '',
                      chartType === t ? 'bg-brand-primary text-white' : 'bg-surface text-gray-600 hover:bg-gray-50'].join(' ')}>
                    {CHART_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={handleRun} disabled={!isReady}
                title={!isReady ? `Vyberte ${missingFields}` : undefined}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5">
                <Play size={13} />Spustit
              </button>
              {!isReady && <span className="text-[10px] text-gray-400">Vyberte {missingFields}</span>}
            </div>
          </div>
        </div>

        {/* Row 3: Granularity / Sort / Top N (conditional on dimension) */}
        {selectedDimension && (
          <div className="grid md:grid-cols-4 gap-4 pt-4 border-t border-border">
            {/* Granularita — date dims only */}
            <div>
              <label className={[labelCls, !isDateDim ? 'opacity-40' : ''].join(' ')}>Granularita</label>
              {isDateDim ? (
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {GRAN_OPTIONS.map((g, i) => (
                    <button key={g} onClick={() => setPending(p => ({ ...p, granularity: g }))}
                      className={segBtn(currentGran === g, i === 0 ? 'border-l-0' : '')}>
                      {GRAN_LABELS[g]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={[selectCls, 'opacity-40 pointer-events-none flex items-center'].join(' ')}>—</div>
              )}
            </div>

            {/* Řazení — categorical dims only */}
            <div>
              <label className={[labelCls, isDateDim ? 'opacity-40' : ''].join(' ')}>Řazení dle hodnoty</label>
              {!isDateDim ? (
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button onClick={() => setPending(p => ({ ...p, sortDir: 'desc' }))} className={segBtn(currentSort === 'desc', 'border-l-0')}>↓ Největší</button>
                  <button onClick={() => setPending(p => ({ ...p, sortDir: 'asc' }))}  className={segBtn(currentSort === 'asc')}>↑ Nejmenší</button>
                </div>
              ) : (
                <div className={[selectCls, 'opacity-40 pointer-events-none flex items-center'].join(' ')}>—</div>
              )}
            </div>

            {/* Top N — categorical dims only */}
            <div>
              <label className={[labelCls, isDateDim ? 'opacity-40' : ''].join(' ')}>Zobrazit</label>
              {!isDateDim ? (
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {TOPN_OPTIONS.map((n, i) => (
                    <button key={i} onClick={() => setPending(p => ({ ...p, topN: n }))}
                      className={segBtn(currentTopN === n, i === 0 ? 'border-l-0' : '')}>
                      {n ?? 'Vše'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={[selectCls, 'opacity-40 pointer-events-none flex items-center'].join(' ')}>—</div>
              )}
            </div>

            <div />
          </div>
        )}
      </div>

      {/* Chart result */}
      <div className="bg-white rounded-2xl border border-border">
        {isLoading ? (
          <div className="p-6"><div className="h-72 animate-pulse bg-surface rounded-xl" /></div>
        ) : chartOption ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-brand-secondary">{result?.headers.join(' × ')}</h2>
              <div className="flex items-center gap-3">
                {/* Save button / inline form */}
                {!saving ? (
                  <button onClick={() => { setSaving(true); setSaveName('') }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors">
                    <Bookmark size={12} />Uložit
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false) }}
                      placeholder="Název reportu…"
                      className="text-xs border border-border rounded px-2 py-1 w-36 focus:outline-none focus:border-brand-primary"
                    />
                    <button onClick={handleSave} disabled={!saveName.trim()}
                      className="text-green-500 hover:text-green-600 disabled:opacity-30 transition-colors p-1">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setSaving(false)} className="text-gray-300 hover:text-gray-500 transition-colors p-1">
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="w-px h-3 bg-border" />
                <button onClick={handleDownloadPng} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors" title="Stáhnout graf jako PNG">
                  <Download size={12} />PNG
                </button>
                <button onClick={handleDownloadCsv} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors" title="Stáhnout data jako CSV">
                  <FileDown size={12} />CSV
                </button>
                <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors">
                  <RefreshCw size={12} />Obnovit
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
            <p className="text-xs text-gray-300 mt-1">K dispozici jsou data cyklistiky a parkování v Praze</p>
          </div>
        )}
      </div>

      {/* Raw data table */}
      {result && result.rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-secondary">Surová data ({result.rows.length} řádků)</h2>
            <button onClick={handleDownloadCsv} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors">
              <FileDown size={12} />Stáhnout CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border">
                  {result.headers.map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface/50">
                    {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-xs tabular-nums text-brand-secondary">{cell}</td>)}
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
