import { useRef, useEffect } from 'react'
import { store } from '../data/store'

const WIDTH = 1280
const HEIGHT = 652
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const RING_COUNT = 6
const BASE_RADIUS = 40
const RADIUS_STEP = 35
const BASE_OPACITY = 0.15
const FONT = "'JetBrains Mono', monospace"
const CYAN = '#00e5ff'
const RED = '#ef233c'
const STAT_PADDING = 36
const BACKGROUND_COLOR = '#010208'

interface RingState {
  baseRadius: number
  phase: number
  frequency: number
  currentRadius: number
  spikeAmount: number
}

interface SpikeState {
  active: boolean
  startTime: number
  duration: number
}

interface FlashState {
  active: boolean
  startTime: number
  duration: number
}

const rings: RingState[] = []
const spikeState: SpikeState = { active: false, startTime: 0, duration: 800 }
const flashState: FlashState = { active: false, startTime: 0, duration: 600 }
let lastCriticalCVECount = 0
let lastKEVCount = 0
let noiseOffsetX = 0
let noiseOffsetY = 0

function initializeRings() {
  rings.length = 0
  for (let index = 0; index < RING_COUNT; index++) {
    rings.push({
      baseRadius: BASE_RADIUS + index * RADIUS_STEP,
      phase: (Math.PI * 2 * index) / RING_COUNT,
      frequency: 0.4 + index * 0.08,
      currentRadius: BASE_RADIUS + index * RADIUS_STEP,
      spikeAmount: 0,
    })
  }
}

function getPulseFrequencyMultiplier(): number {
  const cveCount = store.cvesPublishedToday
  const baseFrequency = 0.5
  const maxFrequency = 2.0
  const normalized = Math.min(1, cveCount / 100)
  return baseFrequency + normalized * (maxFrequency - baseFrequency)
}

function checkForCriticalCVE(): boolean {
  const criticalCVEs = store.recentCVEs.filter(cve => cve.severity === 'CRITICAL')
  const currentCount = criticalCVEs.length
  if (currentCount > lastCriticalCVECount) {
    lastCriticalCVECount = currentCount
    return true
  }
  lastCriticalCVECount = currentCount
  return false
}

function checkForKEVAddition(): boolean {
  const currentCount = store.kevAdditionsThisWeek
  if (currentCount > lastKEVCount) {
    lastKEVCount = currentCount
    return true
  }
  lastKEVCount = currentCount
  return false
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  context.fillStyle = BACKGROUND_COLOR
  context.fillRect(0, 0, WIDTH, HEIGHT)

  noiseOffsetX += (Math.random() - 0.5) * 0.3
  noiseOffsetY += (Math.random() - 0.5) * 0.3
  const noiseAlpha = 0.012 + Math.sin(now * 0.001) * 0.004
  context.fillStyle = `rgba(0, 229, 255, ${noiseAlpha})`
  context.fillRect(
    noiseOffsetX - 2,
    noiseOffsetY - 2,
    WIDTH + 4,
    HEIGHT + 4,
  )
}

function drawRings(context: CanvasRenderingContext2D, now: number) {
  const frequencyMultiplier = getPulseFrequencyMultiplier()
  const isFlashing = flashState.active && (now - flashState.startTime) < flashState.duration
  const flashProgress = isFlashing ? (now - flashState.startTime) / flashState.duration : 1

  for (let index = 0; index < rings.length; index++) {
    const ring = rings[index]
    if (!ring) continue
    const breathAmount = Math.sin(now * 0.001 * ring.frequency * frequencyMultiplier + ring.phase) * 12
    const spikeDecay = ring.spikeAmount * Math.max(0, 1 - (now - spikeState.startTime) / spikeState.duration)
    const targetRadius = ring.baseRadius + breathAmount + (spikeState.active ? spikeDecay : 0)
    ring.currentRadius += (targetRadius - ring.currentRadius) * 0.08

    const ringOpacity = BASE_OPACITY - index * 0.015
    const adjustedOpacity = Math.max(0.03, ringOpacity)

    let ringColor: string
    if (isFlashing && flashProgress < 0.5) {
      const flashIntensity = 1 - flashProgress * 2
      const redComponent = Math.round(239 * flashIntensity)
      const greenComponent = Math.round(35 * flashIntensity + 229 * (1 - flashIntensity))
      const blueComponent = Math.round(60 * flashIntensity + 255 * (1 - flashIntensity))
      ringColor = `rgba(${redComponent}, ${greenComponent}, ${blueComponent}, ${adjustedOpacity})`
    } else {
      ringColor = `rgba(0, 229, 255, ${adjustedOpacity})`
    }

    context.beginPath()
    context.arc(CENTER_X, CENTER_Y, ring.currentRadius, 0, Math.PI * 2)
    context.strokeStyle = ringColor
    context.lineWidth = 1.5
    context.stroke()

    const glowOpacity = adjustedOpacity * 0.3
    context.beginPath()
    context.arc(CENTER_X, CENTER_Y, ring.currentRadius, 0, Math.PI * 2)
    context.strokeStyle = ringColor.replace(String(adjustedOpacity), String(glowOpacity))
    context.lineWidth = 4
    context.stroke()
  }
}

function triggerSpike(now: number) {
  spikeState.active = true
  spikeState.startTime = now
  for (const ring of rings) {
    ring.spikeAmount = ring.baseRadius * 0.3
  }
}

function triggerFlash(now: number) {
  flashState.active = true
  flashState.startTime = now
}

function drawCornerStat(
  context: CanvasRenderingContext2D,
  positionX: number,
  positionY: number,
  label: string,
  value: number,
  isElevated: boolean,
  alignment: CanvasTextAlign,
) {
  const valueColor = isElevated ? RED : CYAN

  context.font = `14px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.3)'
  context.textAlign = alignment
  context.textBaseline = 'alphabetic'
  context.letterSpacing = '3px'
  context.fillText(label, positionX, positionY)
  context.letterSpacing = '0px'

  context.font = `bold 40px ${FONT}`
  context.fillStyle = valueColor
  context.textAlign = alignment
  context.textBaseline = 'top'
  context.fillText(String(value), positionX, positionY + 6)
}

function drawStats(context: CanvasRenderingContext2D) {
  drawCornerStat(
    context,
    STAT_PADDING,
    STAT_PADDING + 12,
    'CVEs TODAY',
    store.cvesPublishedToday,
    store.cvesPublishedToday > 50,
    'left',
  )

  drawCornerStat(
    context,
    WIDTH - STAT_PADDING,
    STAT_PADDING + 12,
    'KEV THIS WEEK',
    store.kevAdditionsThisWeek,
    store.kevAdditionsThisWeek > 5,
    'right',
  )

  drawCornerStat(
    context,
    STAT_PADDING,
    HEIGHT - STAT_PADDING - 40,
    'ACTIVE C2',
    store.activeC2Count,
    store.activeC2Count > 20,
    'left',
  )

  drawCornerStat(
    context,
    WIDTH - STAT_PADDING,
    HEIGHT - STAT_PADDING - 40,
    'SERVICES DOWN',
    store.degradedServiceCount,
    store.degradedServiceCount > 0,
    'right',
  )
}

function drawCenterDot(context: CanvasRenderingContext2D, now: number) {
  const pulseAlpha = 0.4 + Math.sin(now * 0.003) * 0.2
  context.beginPath()
  context.arc(CENTER_X, CENTER_Y, 3, 0, Math.PI * 2)
  context.fillStyle = `rgba(0, 229, 255, ${pulseAlpha})`
  context.fill()
}

export function PulseScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    if (rings.length === 0) {
      initializeRings()
    }

    lastCriticalCVECount = store.recentCVEs.filter(cve => cve.severity === 'CRITICAL').length
    lastKEVCount = store.kevAdditionsThisWeek

    let rafID = 0

    const frame = () => {
      const now = performance.now()

      if (checkForCriticalCVE()) {
        triggerSpike(now)
      }

      if (checkForKEVAddition()) {
        triggerFlash(now)
      }

      if (spikeState.active && (now - spikeState.startTime) > spikeState.duration) {
        spikeState.active = false
      }

      if (flashState.active && (now - flashState.startTime) > flashState.duration) {
        flashState.active = false
      }

      drawBackground(context, now)
      drawRings(context, now)
      drawCenterDot(context, now)
      drawStats(context)

      rafID = requestAnimationFrame(frame)
    }

    rafID = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafID)
  }, [])

  return (
    <canvas
      ref={canvasReference}
      className="absolute inset-0 w-full h-full"
      style={{ background: BACKGROUND_COLOR }}
    />
  )
}
