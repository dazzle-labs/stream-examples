import { useState, useEffect, useRef, useCallback } from 'react'
import { Vessel, REGION_BOUNDS } from '../types'

declare global {
  interface Window {
    __AISSTREAM_API_KEY?: string
  }
}

function getApiKey(): string {
  const envKey = import.meta.env.VITE_AISSTREAM_API_KEY as string | undefined
  if (envKey && envKey.length > 0) return envKey

  if (window.__AISSTREAM_API_KEY && window.__AISSTREAM_API_KEY.length > 0) {
    return window.__AISSTREAM_API_KEY
  }

  const metaTag = document.querySelector('meta[name="aisstream-api-key"]')
  if (metaTag) {
    const content = metaTag.getAttribute('content')
    if (content && content.length > 0) return content
  }

  return ''
}

const STORAGE_KEY = 'hormuz-watch-vessels'
const STALE_VESSEL_TIMEOUT = 12 * 60 * 60 * 1000
const RECONNECT_DELAY = 5000
const SAVE_THROTTLE = 5000
const isDev = import.meta.env.DEV

function loadFromStorage(): Map<string, Vessel> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Map()

    const entries: Array<[string, Vessel]> = JSON.parse(stored)
    const cutoff = Date.now() - STALE_VESSEL_TIMEOUT
    const map = new Map<string, Vessel>()
    for (const [mmsi, vessel] of entries) {
      if (vessel.timestamp >= cutoff) {
        map.set(mmsi, vessel)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

function saveToStorage(vessels: Map<string, Vessel>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(vessels.entries())))
  } catch {
    // storage full or unavailable
  }
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'no-key' | 'unavailable'

export function useVesselStream(): {
  vessels: Map<string, Vessel>
  vesselCount: number
  connectionStatus: ConnectionStatus
} {
  const [vessels, setVessels] = useState<Map<string, Vessel>>(() => loadFromStorage())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const websocketRef = useRef<WebSocket | null>(null)
  const staleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const throttledSave = useCallback((vesselMap: Map<string, Vessel>) => {
    if (saveThrottleRef.current) return
    saveThrottleRef.current = setTimeout(() => {
      saveToStorage(vesselMap)
      saveThrottleRef.current = null
    }, SAVE_THROTTLE)
  }, [])

  const processMessage = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw) as {
        MessageType?: string
        Message?: Record<string, {
          Latitude: number
          Longitude: number
          Sog: number
          Cog: number
          TrueHeading: number
        }>
        MetaData?: {
          MMSI: number
          ShipName: string
          ShipType: number
          latitude: number
          longitude: number
        }
      }

      const metadata = data.MetaData
      if (!metadata) return

      const messageType = data.MessageType ?? ''
      const position = data.Message?.[messageType]
        ?? data.Message?.['PositionReport']
        ?? data.Message?.['StandardClassBPositionReport']
        ?? data.Message?.['ExtendedClassBPositionReport']

      const latitude = position?.Latitude ?? metadata.latitude
      const longitude = position?.Longitude ?? metadata.longitude
      if (!latitude || !longitude) return
      if (latitude < REGION_BOUNDS.minLat || latitude > REGION_BOUNDS.maxLat) return
      if (longitude < REGION_BOUNDS.minLon || longitude > REGION_BOUNDS.maxLon) return

      if (!mountedRef.current) return

      const mmsi = String(metadata.MMSI)
      setConnectionStatus('connected')
      setVessels(previous => {
        const updated = new Map(previous)
        const existing = updated.get(mmsi)
        const newTrail: Array<[number, number]> = existing
          ? [...existing.trail.slice(-9), [longitude, latitude]]
          : [[longitude, latitude]]

        updated.set(mmsi, {
          mmsi,
          name: (metadata.ShipName ?? '').trim(),
          shipType: metadata.ShipType ?? 0,
          latitude,
          longitude,
          speed: position?.Sog ?? 0,
          course: position?.Cog ?? 0,
          heading: position?.TrueHeading ?? 0,
          timestamp: Date.now(),
          trail: newTrail,
        })
        throttledSave(updated)
        return updated
      })
    } catch {
      // ignore
    }
  }, [throttledSave])

  const connect = useCallback(() => {
    const apiKey = getApiKey()
    if (!apiKey) {
      setConnectionStatus('no-key')
      return
    }

    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }

    setConnectionStatus('connecting')

    try {
      const wsUrl = isDev
        ? `ws://${window.location.hostname}:5198`
        : 'wss://stream.aisstream.io/v0/stream'
      const socket = new WebSocket(wsUrl)
      websocketRef.current = socket

      socket.onopen = () => {
        socket.send(JSON.stringify({
          Apikey: apiKey,
          BoundingBoxes: [[[REGION_BOUNDS.minLat, REGION_BOUNDS.minLon], [REGION_BOUNDS.maxLat, REGION_BOUNDS.maxLon]]],
          FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
        }))
      }

      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          processMessage(event.data)
        } else if (event.data instanceof Blob) {
          event.data.text().then(processMessage).catch(() => {})
        }
      }

      socket.onerror = () => { socket.close() }

      socket.onclose = () => {
        websocketRef.current = null
        if (!mountedRef.current) return
        setConnectionStatus(previous =>
          previous === 'connected' ? 'disconnected' : 'unavailable',
        )
        reconnectRef.current = setTimeout(() => {
          if (mountedRef.current) connect()
        }, RECONNECT_DELAY)
      }
    } catch {
      setConnectionStatus('unavailable')
    }
  }, [processMessage])

  const handleVesselEvent = useCallback((event: Event) => {
    try {
      const detail = (event as CustomEvent).detail
      if (!detail) return

      const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail
      if (parsed.type === 'vessel-batch' && Array.isArray(parsed.vessels)) {
        const incoming: Vessel[] = parsed.vessels
          .filter((vessel: Vessel) =>
            vessel.latitude >= REGION_BOUNDS.minLat && vessel.latitude <= REGION_BOUNDS.maxLat
            && vessel.longitude >= REGION_BOUNDS.minLon && vessel.longitude <= REGION_BOUNDS.maxLon,
          )
          .map((vessel: Vessel) => ({
            ...vessel,
            trail: [[vessel.longitude, vessel.latitude] as [number, number]],
            timestamp: vessel.timestamp || Date.now(),
          }))

        if (incoming.length > 0) {
          setConnectionStatus('connected')
          setVessels(previous => {
            const updated = new Map(previous)
            for (const vessel of incoming) {
              const existing = updated.get(vessel.mmsi)
              const trail = existing
                ? [...existing.trail.slice(-9), [vessel.longitude, vessel.latitude] as [number, number]]
                : [[vessel.longitude, vessel.latitude] as [number, number]]
              updated.set(vessel.mmsi, { ...vessel, trail })
            }
            throttledSave(updated)
            return updated
          })
        }
      }
    } catch {
      // ignore
    }
  }, [throttledSave])

  useEffect(() => {
    mountedRef.current = true
    connect()

    window.addEventListener('vessel-update', handleVesselEvent)

    staleCleanupRef.current = setInterval(() => {
      const cutoff = Date.now() - STALE_VESSEL_TIMEOUT
      setVessels(previous => {
        const cleaned = new Map<string, Vessel>()
        for (const [mmsi, vessel] of previous) {
          if (vessel.timestamp >= cutoff) cleaned.set(mmsi, vessel)
        }
        if (cleaned.size === previous.size) return previous
        saveToStorage(cleaned)
        return cleaned
      })
    }, 5 * 60 * 1000)

    return () => {
      mountedRef.current = false
      window.removeEventListener('vessel-update', handleVesselEvent)
      if (websocketRef.current) { websocketRef.current.close(); websocketRef.current = null }
      if (staleCleanupRef.current) { clearInterval(staleCleanupRef.current) }
      if (reconnectRef.current) { clearTimeout(reconnectRef.current) }
      if (saveThrottleRef.current) { clearTimeout(saveThrottleRef.current) }
    }
  }, [connect])

  return { vessels, vesselCount: vessels.size, connectionStatus }
}
