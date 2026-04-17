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

// Map data
export interface BicycleCounterMapPoint {
  id: string
  name: string
  lat: number
  lon: number
  route: string
  count_7d: number
}

export interface MapDataResponse {
  bicycle_counters: BicycleCounterMapPoint[]
}

// Parking
export interface ParkingSummary {
  total_spots: number
  free_spots: number
  occupied_spots: number
  pct_free: number
  num_lots: number
}
export interface ParkingResponse {
  summary: ParkingSummary
  lots: Record<string, unknown>[]
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
