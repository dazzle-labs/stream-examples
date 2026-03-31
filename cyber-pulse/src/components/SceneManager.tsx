import { useState, useEffect, useCallback, useRef, type ComponentType } from 'react'
import { store } from '../data/store'
import { SCENE_ORDER, type SceneName } from '../data/types'
import { WeatherScene } from '../scenes/WeatherScene'
import { PulseScene } from '../scenes/PulseScene'
import { GridScene } from '../scenes/GridScene'
import { FeedScene } from '../scenes/FeedScene'
import { MapScene } from '../scenes/MapScene'
import { NetworkScene } from '../scenes/NetworkScene'
import { LifecycleScene } from '../scenes/LifecycleScene'
import { ConversationScene } from '../scenes/ConversationScene'
import { BreachScene } from '../scenes/BreachScene'
import { FreedomScene } from '../scenes/FreedomScene'
import { BreakingOverlay } from './BreakingOverlay'

const SCENE_COMPONENTS: Record<SceneName, ComponentType> = {
  weather: WeatherScene,
  pulse: PulseScene,
  grid: GridScene,
  feed: FeedScene,
  map: MapScene,
  network: NetworkScene,
  lifecycle: LifecycleScene,
  conversation: ConversationScene,
  breach: BreachScene,
  freedom: FreedomScene,
}

const NOISE_DURATION = 150

export function SceneManager() {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [showNoise, setShowNoise] = useState(false)
  const sceneStartTime = useRef(performance.now())
  const currentIndex = useRef(0)
  const rafHandle = useRef(0)

  const getActiveScenes = useCallback(() => {
    if (store.broadcastMode === 'alert') {
      return SCENE_ORDER.filter(scene => !scene.skipInAlert)
    }
    return SCENE_ORDER
  }, [])

  const getDuration = useCallback((sceneIndex: number) => {
    const activeScenes = getActiveScenes()
    const config = activeScenes[sceneIndex]
    if (!config) return 12000
    if (store.broadcastMode === 'alert') return config.alertDuration || config.patrolDuration
    return config.patrolDuration
  }, [getActiveScenes])

  const advanceScene = useCallback(() => {
    setShowNoise(true)
    setTimeout(() => {
      const activeScenes = getActiveScenes()
      const nextIndex = (currentIndex.current + 1) % activeScenes.length
      currentIndex.current = nextIndex
      setSceneIndex(nextIndex)
      sceneStartTime.current = performance.now()
      setShowNoise(false)
    }, NOISE_DURATION)
  }, [getActiveScenes])

  useEffect(() => {
    const tick = () => {
      const elapsed = performance.now() - sceneStartTime.current
      const duration = getDuration(currentIndex.current)
      if (elapsed >= duration) {
        advanceScene()
      }
      rafHandle.current = requestAnimationFrame(tick)
    }
    rafHandle.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafHandle.current)
  }, [getDuration, advanceScene])

  if (store.broadcastMode === 'breaking' && store.breakingEvent) {
    return <BreakingOverlay />
  }

  const activeScenes = getActiveScenes()
  const config = activeScenes[sceneIndex]
  if (!config) return null

  const SceneComponent = SCENE_COMPONENTS[config.name]

  return (
    <div className="absolute inset-0">
      <SceneComponent />
      {showNoise && (
        <div
          className="absolute inset-0 z-50 pointer-events-none noise-flash"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
            opacity: 0.15,
          }}
        />
      )}
    </div>
  )
}
