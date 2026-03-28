import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { Emotion } from '../types'
import { loadVrm, loadIdleAnimation, getModelBounds } from './loader'
import * as expressions from './expressions'
import * as blinker from './blinker'
import * as lipSync from './lipSync'
import * as lookAt from './lookAt'

const IDLE_ANIMATION_URL = './models/idle_loop.vrma'

interface VrmStageProps {
  modelUrl: string
  emotion: Emotion
  speaking: boolean
  onReady: () => void
  onError?: () => void
}

export function VrmStage({ modelUrl, emotion, speaking, onReady, onError }: VrmStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vrmRef = useRef<VRM | null>(null)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const frameRef = useRef(0)
  const emotionRef = useRef<Emotion>(emotion)
  const speakingRef = useRef(speaking)

  emotionRef.current = emotion
  speakingRef.current = speaking

  const handleReady = useCallback(() => {
    onReady()
  }, [onReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(25, 16 / 9, 0.1, 100)
    camera.position.set(0, 1.35, 1.8)
    camera.lookAt(0, 1.25, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(1280, 720)
    renderer.setPixelRatio(1)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.outputColorSpace = THREE.SRGBColorSpace
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    // Three-point lighting
    const ambient = new THREE.AmbientLight(0x9999cc, 0.6)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffeedd, 1.2)
    key.position.set(2, 3, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6688ff, 0.4)
    rim.position.set(-2, 2, -2)
    scene.add(rim)

    const clock = new THREE.Clock()
    let elapsedTotal = 0

    loadVrm(modelUrl)
      .then(async (vrm) => {
        scene.add(vrm.scene)

        // Auto-frame camera: chest-up portrait framing
        const { center, size } = getModelBounds(vrm)
        const fovRad = (camera.fov * Math.PI) / 180
        const frameHeight = size.y * 0.45
        const cameraZ = (frameHeight / 2) / Math.tan(fovRad / 2)
        const lookY = center.y + size.y * 0.3
        camera.position.set(0, lookY, Math.abs(cameraZ))
        camera.lookAt(0, lookY, 0)

        // Load and play idle animation
        const clip = await loadIdleAnimation(IDLE_ANIMATION_URL, vrm)
        if (clip) {
          const mixer = new THREE.AnimationMixer(vrm.scene)
          mixer.clipAction(clip).play()
          mixerRef.current = mixer
        }

        vrmRef.current = vrm
        handleReady()
      })
      .catch((err: unknown) => {
        console.error('VRM load error:', err)
        onError?.()
      })

    const animate = (): void => {
      frameRef.current = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      elapsedTotal += delta

      const vrm = vrmRef.current
      if (vrm) {
        // 1. Animation mixer (skeletal idle loop)
        mixerRef.current?.update(delta)

        // 2. Procedural overlays (expressions, blink, lip sync, gaze, gestures)
        expressions.setEmotion(emotionRef.current)
        expressions.update(vrm, delta)
        blinker.update(vrm, delta)
        lipSync.update(vrm, delta)
        lookAt.update(vrm, elapsedTotal, speakingRef.current)

        // 3. Manual update order for correct dependency chain
        vrm.humanoid.update()
        vrm.expressionManager?.update()
        if (vrm.nodeConstraintManager) vrm.nodeConstraintManager.update()
        if (vrm.springBoneManager) vrm.springBoneManager.update(delta)
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [modelUrl, handleReady])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10"
    />
  )
}
