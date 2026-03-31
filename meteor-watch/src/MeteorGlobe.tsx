import { useEffect, useRef } from 'react'
import type { MeteorPoint } from './types'
import { initGlobe, renderGlobe, getSunPosition, W, H, ROT_PER } from './globe'
import type { GlobeState } from './globe'
import { renderHeatmap } from './meteors'

interface MeteorGlobeProps {
  points: readonly MeteorPoint[]
}

export function MeteorGlobe({ points }: MeteorGlobeProps) {
  const glRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const globeRef = useRef<GlobeState | null>(null)
  const pointsRef = useRef(points)
  const startTimeRef = useRef(0)

  pointsRef.current = points

  useEffect(() => {
    const glCanvas = glRef.current
    const overlayCanvas = overlayRef.current
    if (!glCanvas || !overlayCanvas) return

    glCanvas.width = W
    glCanvas.height = H
    overlayCanvas.width = W
    overlayCanvas.height = H

    const globe = initGlobe(glCanvas)
    if (!globe) return
    globeRef.current = globe

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    startTimeRef.current = performance.now()
    let rafId = 0

    const animate = () => {
      const now = performance.now()
      const elapsed = now - startTimeRef.current
      const cLon = ((elapsed % ROT_PER) / ROT_PER) * 360
      const sun = getSunPosition()

      renderGlobe(globe, now, cLon, sun.lat, sun.lon)

      ctx.clearRect(0, 0, W, H)
      renderHeatmap(ctx, pointsRef.current, cLon)

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <>
      <canvas ref={glRef} className="absolute inset-0" style={{ width: W, height: H }} />
      <canvas ref={overlayRef} className="absolute inset-0" style={{ width: W, height: H }} />
    </>
  )
}
