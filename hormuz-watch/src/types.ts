export interface Vessel {
  mmsi: string
  name: string
  latitude: number
  longitude: number
  speed: number
  course: number
  heading: number
  shipType: number
  timestamp: number
  trail: Array<[number, number]>
}

export type VesselType = 'tanker' | 'container' | 'bulk' | 'cargo' | 'other'

export function classifyVessel(shipType: number): VesselType {
  if (shipType >= 80 && shipType <= 89) return 'tanker'
  if (shipType >= 70 && shipType <= 79) return 'cargo'
  if (shipType >= 60 && shipType <= 69) return 'container'
  if (shipType >= 40 && shipType <= 49) return 'bulk'
  return 'other'
}

export const VESSEL_COLORS: Record<VesselType, string> = {
  tanker: '#f59e0b',
  container: '#3b82f6',
  bulk: '#22c55e',
  cargo: '#a78bfa',
  other: '#94a3b8',
}

export interface TransitDay {
  date: string
  total: number
  tanker: number
  container: number
  dryBulk: number
  generalCargo: number
  roro: number
  capacityTons: number
}

export interface PredictionMarket {
  name: string
  probability: number
  change1h: number
  volume: number
  slug: string
}

export interface CommodityPrice {
  ticker: string
  label: string
  price: number
  changePercent: number
  sparkline: number[]
}

export interface Headline {
  id: string
  title: string
  source: string
  timestamp: number
  category: 'news' | 'military' | 'osint'
}

export const REGION_BOUNDS = {
  minLon: 48,
  maxLon: 61,
  minLat: 22,
  maxLat: 30,
}

export const NORMAL_DAILY_TRANSITS = 138

export const CRISIS_START = new Date('2026-02-28T00:00:00Z')
