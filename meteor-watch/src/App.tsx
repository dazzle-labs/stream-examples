import { useEffect, useRef, useCallback } from 'react'
import { useMeteorData } from './useMeteorData'
import { TitleBar, StatsBar, RadiantMap } from './Overlays'
import { initAudio } from './sound'
import { initParticles } from './particles'
import type { AudioEngine } from './sound'

export function App() {
  const { points, stats } = useMeteorData()

  const audioRef = useRef<AudioEngine | null>(null)
  const particleCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const prevPointsLenRef = useRef<number>(0)

  // Initialize audio engine on mount
  useEffect(() => {
    const engine = initAudio()
    audioRef.current = engine
    if (engine) {
      engine.startDrone()
    }
  }, [])

  // Initialize particle system when canvas is available
  useEffect(() => {
    const canvas = particleCanvasRef.current
    if (!canvas) return

    const system = initParticles(canvas)

    // Particle animation loop
    const tick = (time: number) => {
      const dt = lastTimeRef.current > 0 ? time - lastTimeRef.current : 16
      lastTimeRef.current = time

      system.update(dt)
      system.render()

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Detect data refreshes and play tick sound
  useEffect(() => {
    if (points.length > 0 && prevPointsLenRef.current > 0 && points.length !== prevPointsLenRef.current) {
      audioRef.current?.playTick()
    }
    prevPointsLenRef.current = points.length
  }, [points])

  // Cluster count increase triggers resolve sound
  const handleClusterCountChange = useCallback(() => {
    audioRef.current?.playClusterResolve()
  }, [])

  return (
    <div className="relative w-[1280px] h-[720px] bg-black overflow-hidden">
      <RadiantMap points={points} onClusterCountChange={handleClusterCountChange} />

      {/* Particle layer (between chart and vignette) */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ width: 1280, height: 720 }}
      />

      {/* Animated vignette overlay */}
      <div
        className="absolute inset-0 z-15 pointer-events-none animate-vignette-breathe"
        style={{
          background: 'radial-gradient(ellipse 70% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* CRT scan line */}
      <div
        className="absolute inset-0 z-16 pointer-events-none overflow-hidden"
        style={{ opacity: 0.03 }}
      >
        <div
          className="animate-scan-line"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'rgba(255,255,255,0.8)',
            top: 0,
          }}
        />
      </div>

      <TitleBar stats={stats} />
      <StatsBar stats={stats} />
    </div>
  )
}
