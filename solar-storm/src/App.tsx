import { useEffect, useRef, useCallback } from 'react'
import { createDataManager } from './data'
import { createRenderer } from './renderer'

function formatSpeed(speed: number): string {
  return `${Math.round(speed)} km/s`
}

function formatBz(bz: number): string {
  const sign = bz >= 0 ? '+' : ''
  return `${sign}${bz.toFixed(1)} nT`
}

function getKpLabel(kp: number): string {
  if (kp >= 8) return 'EXTREME'
  if (kp >= 7) return 'SEVERE'
  if (kp >= 6) return 'STRONG'
  if (kp >= 5) return 'MODERATE'
  if (kp >= 4) return 'MINOR'
  return 'QUIET'
}

function getKpColor(kp: number): string {
  if (kp >= 6) return '#ff4444'
  if (kp >= 5) return '#ffaa33'
  if (kp >= 4) return '#ffdd44'
  return '#00ff88'
}

function getBzColor(bz: number): string {
  if (bz < -10) return '#ff4444'
  if (bz < -5) return '#ffaa33'
  if (bz < 0) return '#ffdd44'
  return '#00ff88'
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null)
  const dataManagerRef = useRef<ReturnType<typeof createDataManager> | null>(null)
  const animFrameRef = useRef<number>(0)
  const kpDisplayRef = useRef<HTMLSpanElement>(null)
  const kpLabelRef = useRef<HTMLSpanElement>(null)
  const kpDotRef = useRef<HTMLSpanElement>(null)
  const speedDisplayRef = useRef<HTMLSpanElement>(null)
  const bzDisplayRef = useRef<HTMLSpanElement>(null)
  const bzDotRef = useRef<HTMLSpanElement>(null)
  const densityDisplayRef = useRef<HTMLSpanElement>(null)
  const lightningDisplayRef = useRef<HTMLSpanElement>(null)

  const animate = useCallback((time: number) => {
    const renderer = rendererRef.current
    const dataManager = dataManagerRef.current
    if (!renderer || !dataManager) return

    const data = dataManager.getData()
    renderer.render(data, time)

    // Update DOM status bar values directly to avoid React re-renders
    if (kpDisplayRef.current) {
      kpDisplayRef.current.textContent = data.kpIndex.toFixed(0)
    }
    if (kpLabelRef.current) {
      kpLabelRef.current.textContent = getKpLabel(data.kpIndex)
      kpLabelRef.current.style.color = getKpColor(data.kpIndex)
    }
    if (kpDotRef.current) {
      kpDotRef.current.style.backgroundColor = getKpColor(data.kpIndex)
    }
    if (speedDisplayRef.current) {
      speedDisplayRef.current.textContent = formatSpeed(data.solarWind.speed)
    }
    if (bzDisplayRef.current) {
      bzDisplayRef.current.textContent = formatBz(data.solarWind.bz)
      bzDisplayRef.current.style.color = getBzColor(data.solarWind.bz)
    }
    if (bzDotRef.current) {
      bzDotRef.current.style.backgroundColor = getBzColor(data.solarWind.bz)
    }
    if (densityDisplayRef.current) {
      densityDisplayRef.current.textContent = `${data.solarWind.density.toFixed(1)} p/cm³`
    }
    if (lightningDisplayRef.current && renderer.getLightningCount) {
      lightningDisplayRef.current.textContent = `${renderer.getLightningCount()} active`
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = createRenderer(canvas)
    rendererRef.current = renderer

    const dataManager = createDataManager()
    dataManagerRef.current = dataManager
    dataManager.start()

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      renderer.destroy()
      dataManager.stop()
    }
  }, [animate])

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        width={1280}
        height={720}
      />

      {/* Status bar — taller, more readable */}
      <div className="status-bar">
        {/* Glowing top border */}
        <div className="status-bar-glow" />

        <div className="status-bar-content">
          {/* Kp Index */}
          <div className="status-field">
            <span
              ref={kpDotRef}
              className="status-dot"
              style={{ backgroundColor: '#00ff88' }}
            />
            <span className="status-label">Geomagnetic Index</span>
            <span
              ref={kpDisplayRef}
              className="status-value"
            >
              —
            </span>
            <span
              ref={kpLabelRef}
              className="status-kp-label"
              style={{ color: '#00ff88' }}
            >
              QUIET
            </span>
          </div>

          <div className="status-separator" />

          {/* Solar Wind Speed */}
          <div className="status-field">
            <span
              className="status-dot"
              style={{ backgroundColor: '#ffaa33' }}
            />
            <span className="status-label">Solar Wind Speed</span>
            <span
              ref={speedDisplayRef}
              className="status-value"
            >
              —
            </span>
          </div>

          <div className="status-separator" />

          {/* Bz */}
          <div className="status-field">
            <span
              ref={bzDotRef}
              className="status-dot"
              style={{ backgroundColor: '#00ff88' }}
            />
            <span className="status-label">Magnetic Field (Bz)</span>
            <span
              ref={bzDisplayRef}
              className="status-value"
              style={{ color: '#00ff88' }}
            >
              —
            </span>
          </div>

          <div className="status-separator" />

          {/* Density */}
          <div className="status-field">
            <span
              className="status-dot"
              style={{ backgroundColor: '#8855ff' }}
            />
            <span className="status-label">Plasma Density</span>
            <span
              ref={densityDisplayRef}
              className="status-value"
            >
              —
            </span>
          </div>

          <div className="status-separator" />

          {/* Lightning */}
          <div className="status-field">
            <span
              className="status-dot"
              style={{ backgroundColor: '#aaddff' }}
            />
            <span className="status-label">Lightning</span>
            <span
              ref={lightningDisplayRef}
              className="status-value"
            >
              —
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
