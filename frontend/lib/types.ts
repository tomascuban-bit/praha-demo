/*
 * API response types — keep in sync with backend routers.
 */

export interface HealthResponse {
  status: string
  tables_loaded: number
  tables: Array<{ short_name: string; row_count: number; table_id: string }>
}

export interface PlatformInfo {
  connection_url: string | null
  project_id: string | null
}

export interface UserMeResponse {
  email: string
  role?: string
  is_authenticated?: boolean
}

// KPI card
export interface KpiItem {
  label: string
  value: number
  description: string
  formula?: string
  sources?: string[]
  icon?: string
}
export type KpisResponse = KpiItem[]

// Overview chart
export interface OverviewChartPoint {
  date: string
  cyclists: number
  vehicles: number
}
export type OverviewChartResponse = OverviewChartPoint[]

// Bicycle counters
export interface BicycleCounter {
  id: string
  name: string
  latitude?: string
  longitude?: string
  route?: string
}

export interface CyclingTrendPoint {
  date: string
  cyclists: number
}

export interface CyclingByCounter {
  counter_id: string
  total_cyclists: number
  name?: string
  latitude?: string
  longitude?: string
  route?: string
}

export interface HourlyPoint {
  hour: number
  avg_cyclists?: number
  avg_vehicles?: number
}

// Traffic detectors
export interface TrafficDetector {
  id: string
  name: string
  latitude?: string
  longitude?: string
  road?: string
}

export interface TrafficTrendPoint {
  date: string
  vehicles: number
  avg_speed: number | null
}

export interface TrafficByDetector {
  detector_id: string
  total_vehicles: number
  avg_speed: number
  name?: string
  latitude?: string
  longitude?: string
  road?: string
}

// Report builder
export interface DataSchemaSource {
  id: string
  label: string
  supports_period: boolean
  dimensions: Array<{ column: string; label: string; is_date?: boolean }>
  measures: Array<{ column: string; label: string }>
}

export interface DataSchemaResponse {
  sources: DataSchemaSource[]
}

export interface QueryDataResponse {
  headers: string[]
  rows: string[][]
}
