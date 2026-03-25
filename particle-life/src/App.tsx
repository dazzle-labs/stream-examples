import { useEffect, useRef, useState } from 'react'
import { createParticles, stepSimulation, interpolatePositions } from './simulation'
import { generateRandomMatrix, lerpMatrix } from './rules'
import type { AttractionMatrix } from './rules'
import { renderFrame } from './renderer'

const WIDTH = 1280
const HEIGHT = 720
const NUM_SPECIES = 8
const PARTICLE_COUNT = 2000
const MORPH_RATE = 0.005
// Frames between rule transitions: ~30-60 seconds at 60fps
const MIN_TRANSITION_FRAMES = 1800
const MAX_TRANSITION_FRAMES = 3600

// Speed variation: oscillates dt multiplier between 0.5x and 2x over 45-60s
const SPEED_CYCLE_MIN_FRAMES = 2700  // 45s at 60fps
const SPEED_CYCLE_MAX_FRAMES = 3600  // 60s at 60fps

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generation, setGeneration] = useState(1)
  const [fps, setFps] = useState(0)
  const generationRef = useRef(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize simulation state
    const system = createParticles(
      PARTICLE_COUNT,
      NUM_SPECIES,
      WIDTH,
      HEIGHT,
    )

    let currentMatrix: AttractionMatrix = generateRandomMatrix()
    let targetMatrix: AttractionMatrix = generateRandomMatrix()
    let morphProgress = 1.0 // Start fully converged, then begin morphing
    let framesSinceLastTransition = 0
    let nextTransitionAt =
      MIN_TRANSITION_FRAMES +
      Math.floor(Math.random() * (MAX_TRANSITION_FRAMES - MIN_TRANSITION_FRAMES))

    // Speed variation state
    let speedPhase = Math.random() * Math.PI * 2  // random start phase
    let speedCycleFrames = SPEED_CYCLE_MIN_FRAMES +
      Math.floor(Math.random() * (SPEED_CYCLE_MAX_FRAMES - SPEED_CYCLE_MIN_FRAMES))
    let speedFrameCounter = 0

    // Half-rate simulation: simulate every other frame, interpolate in between
    // Start at -1 so first tick (simFrame=0) runs full physics, avoiding
    // interpolation against uninitialized previous positions
    let simFrame = -1

    // FPS tracking
    let fpsFrameCount = 0
    let fpsLastTime = performance.now()

    // Animation start time for zoom cycle
    // Clear canvas to black on first frame
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    let animationId: number

    function tick() {
      // FPS counter — update once per second
      fpsFrameCount++
      const now = performance.now()
      const elapsed = now - fpsLastTime
      if (elapsed >= 1000) {
        const currentFps = Math.round(fpsFrameCount * 1000 / elapsed)
        setFps(currentFps)
        fpsFrameCount = 0
        fpsLastTime = now
      }

      // Rule evolution — morph toward target, then pick new target
      framesSinceLastTransition++

      if (morphProgress < 1.0) {
        morphProgress = Math.min(1.0, morphProgress + MORPH_RATE)
        currentMatrix = lerpMatrix(currentMatrix, targetMatrix, MORPH_RATE)
      }

      if (framesSinceLastTransition >= nextTransitionAt) {
        // Start a new transition
        targetMatrix = generateRandomMatrix()
        morphProgress = 0
        framesSinceLastTransition = 0
        nextTransitionAt =
          MIN_TRANSITION_FRAMES +
          Math.floor(Math.random() * (MAX_TRANSITION_FRAMES - MIN_TRANSITION_FRAMES))
        generationRef.current += 1
        setGeneration(generationRef.current)
      }

      // Compute speed multiplier using smooth sine wave
      speedFrameCounter++
      if (speedFrameCounter >= speedCycleFrames) {
        speedFrameCounter = 0
        speedCycleFrames = SPEED_CYCLE_MIN_FRAMES +
          Math.floor(Math.random() * (SPEED_CYCLE_MAX_FRAMES - SPEED_CYCLE_MIN_FRAMES))
      }
      speedPhase += (Math.PI * 2) / speedCycleFrames
      // Map sine [-1, 1] to [0.15, 0.6] — slow, meditative pace
      const dtMultiplier = 0.375 + 0.225 * Math.sin(speedPhase)

      // Half-rate simulation: run physics every other frame
      simFrame++
      if (simFrame % 2 === 0) {
        // Simulation frame — run full physics step
        stepSimulation(system, currentMatrix, WIDTH, HEIGHT, dtMultiplier)
      } else {
        // Interpolation frame — blend positions
        interpolatePositions(system, 0.5, WIDTH, HEIGHT)
      }

      if (!ctx) return
      renderFrame(ctx, system, WIDTH, HEIGHT)

      animationId = requestAnimationFrame(tick)
    }

    animationId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="relative w-screen h-screen bg-black">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="block w-full h-full"
      />
      <div
        className="absolute bottom-3 left-4 select-none pointer-events-none"
        style={{
          fontFamily: '\'Space Mono\', monospace',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.5,
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
        }}
      >
        <div>PARTICLE LIFE</div>
        <div>
          Gen {generation} &middot; {PARTICLE_COUNT.toLocaleString()} particles &middot; {fps} fps
        </div>
      </div>
      <div
        className="absolute bottom-3 right-4 select-none pointer-events-none"
        style={{
          fontFamily: '\'Space Mono\', monospace',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.15)',
          lineHeight: 1.5,
        }}
      >
        {fps} fps
      </div>
    </div>
  )
}
