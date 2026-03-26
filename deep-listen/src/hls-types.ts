// Type declarations for hls.js loaded from CDN
// These mirror the essential API surface we use

export interface HlsConfig {
  liveDurationInfinity: boolean
  enableWorker: boolean
  lowLatencyMode: boolean
  backBufferLength: number
  maxBufferLength: number
  maxMaxBufferLength: number
}

export interface HlsErrorData {
  fatal: boolean
  type: string
  details: string
}

export interface HlsEvents {
  MANIFEST_PARSED: string
  ERROR: string
}

export interface HlsInstance {
  loadSource: (url: string) => void
  attachMedia: (media: HTMLMediaElement) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  destroy: () => void
}

export interface HlsConstructor {
  new (config: Partial<HlsConfig>): HlsInstance
  isSupported: () => boolean
  Events: HlsEvents
}
