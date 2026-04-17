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

// Parking dashboard
export interface ParkingDashboardSummary {
  total_lots: number
  total_spots: number
  free_spots: number
  occupied_spots: number
  pct_free: number
  lots_full: number
  lots_available: number
  lots_empty: number
}

export interface ParkingByOperator {
  source: string
  label: string
  lot_count: number
  total_spots: number
  free_spots: number
  occupied_spots: number
  pct_full: number
}

export interface ParkingLot {
  parking_id: string
  source: string
  label: string
  total_spots: number
  free_spots: number
  occupied_spots: number
  pct_full: number
  has_free_spots: boolean
  last_updated: string
}

export interface ParkingDistributionPoint {
  bucket: string
  lot_count: number
  total_spots: number
}

// Parking (legacy environment endpoint)
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
