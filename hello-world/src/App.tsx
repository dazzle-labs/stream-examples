import { useState, useEffect, useCallback } from 'react'
import { HelloWorld } from './scenes/HelloWorld'
import { Terminal } from './scenes/Terminal'
import { HowItWorks } from './scenes/HowItWorks'
import { KineticTypography } from './scenes/KineticTypography'
import { GoLive } from './scenes/GoLive'

const SCENE_DURATION = 12_000
const FADE_DURATION = 2_000
const TOTAL_CYCLE = SCENE_DURATION + FADE_DURATION

const scenes = [HelloWorld, Terminal, HowItWorks, KineticTypography, GoLive] as const

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export function App() {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [opacity, setOpacity] = useState(0)

  const tick = useCallback(() => {
    const now = performance.now()
    const cycleTime = now % (scenes.length * TOTAL_CYCLE)
    const currentScene = Math.floor(cycleTime / TOTAL_CYCLE) % scenes.length
    const elapsed = cycleTime - currentScene * TOTAL_CYCLE

    let alpha = 1
    if (elapsed < FADE_DURATION) {
      alpha = elapsed / FADE_DURATION
    } else if (elapsed > SCENE_DURATION) {
      alpha = 1 - (elapsed - SCENE_DURATION) / FADE_DURATION
    }

    setSceneIndex(currentScene)
    setOpacity(smoothstep(alpha))
  }, [])

  useEffect(() => {
    let raf: number
    const loop = () => {
      tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tick])

  const Scene = scenes[sceneIndex]
  if (!Scene) return null

  return (
    <div className="relative w-[1280px] h-[720px] bg-black overflow-hidden">
      <div
        style={{ opacity }}
        className="absolute inset-0"
      >
        <Scene />
      </div>
    </div>
  )
}
