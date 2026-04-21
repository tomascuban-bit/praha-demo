'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type {
  HealthResponse,
  PlatformInfo,
  UserMeResponse,
  KpisResponse,
  OverviewChartResponse,
  BicycleCounter,
  CyclingTrendPoint,
  CyclingByCounter,
  HourlyPoint,
  DataSchemaResponse,
  DimensionValue,
  QueryDataResponse,
  MapDataResponse,
  ParkingResponse,
  ParkingDashboardSummary,
  ParkingByOperator,
  ParkingLot,
  ParkingDistributionPoint,
  PedestrianKpis,
  PedestrianTrendPoint,
  PedestrianByCounter,
  PedestrianHourlyPoint,
  PedestrianComparisonPoint,
} from './types'


async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...options })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${url} — ${body}`)
  }
  return res.json()
}

// ─── Core ────────────────────────────────────────────────────────────────────

export function useHealthCheck() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => apiFetch('/api/health'),
    staleTime: 30_000,
  })
}

export function useCurrentUser() {
  return useQuery<UserMeResponse>({
    queryKey: ['me'],
    queryFn: () => apiFetch('/api/me'),
    staleTime: 10 * 60 * 1000,
  })
}

export function usePlatformInfo() {
  return useQuery<PlatformInfo>({
    queryKey: ['platform'],
    queryFn: () => apiFetch('/api/platform'),
    staleTime: 60 * 60 * 1000,
  })
}

// ─── Overview ────────────────────────────────────────────────────────────────

export function useKpis() {
  return useQuery<KpisResponse>({
    queryKey: ['kpis'],
    queryFn: () => apiFetch('/api/kpis'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOverviewChart(days: number = 30) {
  return useQuery<OverviewChartResponse>({
    queryKey: ['overview-chart', days],
    queryFn: () => apiFetch(`/api/overview-chart?days=${days}`),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}

// ─── Cycling ─────────────────────────────────────────────────────────────────

export function useCyclingCounters() {
  return useQuery<BicycleCounter[]>({
    queryKey: ['cycling-counters'],
    queryFn: () => apiFetch('/api/cycling/counters'),
    staleTime: 60 * 60 * 1000,
  })
}

export function useCyclingTrend(days: number) {
  return useQuery<CyclingTrendPoint[]>({
    queryKey: ['cycling-trend', days],
    queryFn: () => apiFetch(`/api/cycling/trend?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCyclingByCounter(days: number) {
  return useQuery<CyclingByCounter[]>({
    queryKey: ['cycling-by-counter', days],
    queryFn: () => apiFetch(`/api/cycling/by-counter?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCyclingHourly(days: number) {
  return useQuery<HourlyPoint[]>({
    queryKey: ['cycling-hourly', days],
    queryFn: () => apiFetch(`/api/cycling/hourly?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Pedestrian ──────────────────────────────────────────────────────────────

export function usePedestrianKpis() {
  return useQuery<PedestrianKpis>({
    queryKey: ['pedestrian-kpis'],
    queryFn: () => apiFetch('/api/pedestrian/kpis'),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePedestrianTrend(days: number) {
  return useQuery<PedestrianTrendPoint[]>({
    queryKey: ['pedestrian-trend', days],
    queryFn: () => apiFetch(`/api/pedestrian/trend?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePedestrianByCounter(days: number) {
  return useQuery<PedestrianByCounter[]>({
    queryKey: ['pedestrian-by-counter', days],
    queryFn: () => apiFetch(`/api/pedestrian/by-counter?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePedestrianHourly(days: number) {
  return useQuery<PedestrianHourlyPoint[]>({
    queryKey: ['pedestrian-hourly', days],
    queryFn: () => apiFetch(`/api/pedestrian/hourly?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePedestrianComparison(days: number) {
  return useQuery<PedestrianComparisonPoint[]>({
    queryKey: ['pedestrian-comparison', days],
    queryFn: () => apiFetch(`/api/pedestrian/comparison?days=${days}`),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export function useMapData() {
  return useQuery<MapDataResponse>({
    queryKey: ['map-data'],
    queryFn: () => apiFetch('/api/map-data'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useParking() {
  return useQuery<ParkingResponse>({
    queryKey: ['parking'],
    queryFn: () => apiFetch('/api/environment/parking'),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Parking dashboard ───────────────────────────────────────────────────────

export function useParkingSummary() {
  return useQuery<ParkingDashboardSummary>({
    queryKey: ['parking-summary'],
    queryFn: () => apiFetch('/api/parking/summary'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useParkingByOperator() {
  return useQuery<ParkingByOperator[]>({
    queryKey: ['parking-by-operator'],
    queryFn: () => apiFetch('/api/parking/by-operator'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useParkingLots() {
  return useQuery<ParkingLot[]>({
    queryKey: ['parking-lots'],
    queryFn: () => apiFetch('/api/parking/lots'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useParkingDistribution() {
  return useQuery<ParkingDistributionPoint[]>({
    queryKey: ['parking-distribution'],
    queryFn: () => apiFetch('/api/parking/distribution'),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Report builder ──────────────────────────────────────────────────────────

export function useDataSchema() {
  return useQuery<DataSchemaResponse>({
    queryKey: ['data-schema'],
    queryFn: () => apiFetch('/api/data-schema'),
    staleTime: Infinity,
  })
}

export function useQueryData(params: {
  source: string
  dimension: string
  measures: string[]
  days?: number
  filterCol?: string
  filterVal?: string
  granularity?: string
  topN?: number
  sortDir?: string
} | null) {
  return useQuery<QueryDataResponse | null>({
    queryKey: ['query-data', params?.source, params?.dimension, params?.measures, params?.days, params?.filterCol, params?.filterVal, params?.granularity, params?.topN, params?.sortDir],
    queryFn: () => {
      if (!params) return null
      const qs = new URLSearchParams({
        source: params.source,
        dimension: params.dimension,
        measures: params.measures.join(','),
      })
      if (params.days) qs.set('days', String(params.days))
      if (params.filterCol && params.filterVal) {
        qs.set('filter_col', params.filterCol)
        qs.set('filter_val', params.filterVal)
      }
      if (params.granularity) qs.set('granularity', params.granularity)
      if (params.topN) qs.set('top_n', String(params.topN))
      if (params.sortDir) qs.set('sort_dir', params.sortDir)
      return apiFetch<QueryDataResponse>(`/api/query-data?${qs}`)
    },
    enabled: !!params && !!params.dimension && params.measures.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDimensionValues(source: string | null, column: string | null) {
  return useQuery<DimensionValue[]>({
    queryKey: ['dimension-values', source, column],
    queryFn: () => apiFetch<DimensionValue[]>(`/api/dimension-values?source=${source}&column=${column}`),
    enabled: !!source && !!column,
    staleTime: 10 * 60 * 1000,
  })
}
