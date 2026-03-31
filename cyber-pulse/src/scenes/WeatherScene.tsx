import { useRef, useEffect } from 'react'
import { store } from '../data/store'
import type { InfoconLevel } from '../data/types'

const WIDTH = 1280
const HEIGHT = 720
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2 - 30
const GAUGE_RADIUS = 180
const GAUGE_STROKE = 12
const MINI_RADIUS = 40
const MINI_STROKE = 6
const MINI_ORBIT_RADIUS = 300
const ARC_START = Math.PI * 0.75
const ARC_END = Math.PI * 2.25
const ARC_SPAN = ARC_END - ARC_START
const SPARKLINE_HEIGHT = 60
const SPARKLINE_Y = HEIGHT - 80
const SPARKLINE_LEFT = 120
const SPARKLINE_RIGHT = WIDTH - 120
const FONT = "'JetBrains Mono', monospace"
const LERP_SPEED = 0.03

interface SignalDefinition {
  label: string
  getValue: () => number
}

const SIGNALS: SignalDefinition[] = [
  {
    label: 'INFOCON',
    getValue: () => {
      const scores: Record<InfoconLevel, number> = { green: 0, yellow: 30, orange: 60, red: 100 }
      return scores[store.sansInfocon] ?? 0
    },
  },
  {
    label: 'CVE VEL',
    getValue: () => {
      const baseline = JSON.parse(localStorage.getItem('cyber-pulse:baselines') ?? '{}') as Record<string, number>
      const cveBaseline = baseline['dailyCVEs'] ?? 30
      return Math.min(100, Math.max(0, (store.cvesPublishedToday / Math.max(1, cveBaseline)) * 100))
    },
  },
  {
    label: 'KEV RATE',
    getValue: () => {
      const baseline = JSON.parse(localStorage.getItem('cyber-pulse:baselines') ?? '{}') as Record<string, number>
      const kevBaseline = baseline['weeklyKEV'] ?? 3
      return Math.min(100, (store.kevAdditionsThisWeek / Math.max(1, kevBaseline)) * 100)
    },
  },
  {
    label: 'SVC HLTH',
    getValue: () => Math.min(100, (store.degradedServiceCount / 5) * 100),
  },
  {
    label: 'PORT DIV',
    getValue: () => Math.min(100, (store.sansTopPorts.length / 20) * 100),
  },
  {
    label: 'MALWARE',
    getValue: () => Math.min(100, (store.feodoC2s.filter(c2 => c2.status === 'online').length / 50) * 100),
  },
  {
    label: 'SOCIAL',
    getValue: () => Math.min(100, (store.communityPosts.length / 30) * 100),
  },
  {
    label: 'OONI',
    getValue: () => Math.min(100, (store.ooniIncidents.length / 5) * 100),
  },
]

let animatedScore = 0
const animatedSignals: number[] = new Array(8).fill(0)
let needleAngle = ARC_START

function getThreatLabel(score: number): string {
  if (score < 20) return 'CLEAR'
  if (score < 40) return 'ADVISORY'
  if (score < 60) return 'WATCH'
  if (score < 80) return 'WARNING'
  return 'CRITICAL'
}

function getScoreColor(score: number): string {
  if (score < 20) return '#3b82f6'
  if (score < 40) return '#00e5ff'
  if (score < 60) return '#ffbe0b'
  if (score < 80) return '#ff8c00'
  return '#ef233c'
}

function getLabelColor(score: number): string {
  if (score < 20) return 'rgba(59, 130, 246, 0.9)'
  if (score < 40) return 'rgba(0, 229, 255, 0.9)'
  if (score < 60) return 'rgba(255, 190, 11, 0.9)'
  if (score < 80) return 'rgba(255, 140, 0, 0.9)'
  return 'rgba(239, 35, 60, 0.9)'
}

function createArcGradient(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
): CanvasGradient {
  const gradient = context.createConicGradient(ARC_START - Math.PI / 2, centerX, centerY)
  const normalizedSpan = ARC_SPAN / (Math.PI * 2)
  gradient.addColorStop(0, '#3b82f6')
  gradient.addColorStop(normalizedSpan * 0.2, '#00e5ff')
  gradient.addColorStop(normalizedSpan * 0.4, '#ffbe0b')
  gradient.addColorStop(normalizedSpan * 0.7, '#ff8c00')
  gradient.addColorStop(normalizedSpan * 0.9, '#ef233c')
  gradient.addColorStop(normalizedSpan, '#ef233c')
  return gradient
}

function drawGaugeBackground(context: CanvasRenderingContext2D) {
  context.beginPath()
  context.arc(CENTER_X, CENTER_Y, GAUGE_RADIUS, ARC_START, ARC_END)
  context.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  context.lineWidth = GAUGE_STROKE
  context.lineCap = 'round'
  context.stroke()
}

function drawGaugeFill(context: CanvasRenderingContext2D, fraction: number) {
  if (fraction <= 0) return
  const endAngle = ARC_START + ARC_SPAN * Math.min(1, fraction)
  const gradient = createArcGradient(context, CENTER_X, CENTER_Y)

  context.beginPath()
  context.arc(CENTER_X, CENTER_Y, GAUGE_RADIUS, ARC_START, endAngle)
  context.strokeStyle = gradient
  context.lineWidth = GAUGE_STROKE
  context.lineCap = 'round'
  context.stroke()
}

function drawGaugeTicks(context: CanvasRenderingContext2D) {
  for (let index = 0; index <= 10; index++) {
    const angle = ARC_START + (ARC_SPAN * index) / 10
    const innerRadius = GAUGE_RADIUS - GAUGE_STROKE / 2 - 8
    const outerRadius = GAUGE_RADIUS - GAUGE_STROKE / 2 - (index % 5 === 0 ? 20 : 14)
    const cosAngle = Math.cos(angle)
    const sinAngle = Math.sin(angle)

    context.beginPath()
    context.moveTo(CENTER_X + cosAngle * innerRadius, CENTER_Y + sinAngle * innerRadius)
    context.lineTo(CENTER_X + cosAngle * outerRadius, CENTER_Y + sinAngle * outerRadius)
    context.strokeStyle = index % 5 === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)'
    context.lineWidth = index % 5 === 0 ? 2 : 1
    context.stroke()

    if (index % 5 === 0) {
      const labelRadius = outerRadius - 14
      const value = index * 10
      context.font = `14px ${FONT}`
      context.fillStyle = 'rgba(255, 255, 255, 0.3)'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(String(value), CENTER_X + cosAngle * labelRadius, CENTER_Y + sinAngle * labelRadius)
    }
  }
}

function drawNeedle(context: CanvasRenderingContext2D, angle: number) {
  const needleLength = GAUGE_RADIUS - 30
  const tipX = CENTER_X + Math.cos(angle) * needleLength
  const tipY = CENTER_Y + Math.sin(angle) * needleLength
  const baseOffset = 4
  const perpAngle = angle + Math.PI / 2

  context.beginPath()
  context.moveTo(tipX, tipY)
  context.lineTo(
    CENTER_X + Math.cos(perpAngle) * baseOffset,
    CENTER_Y + Math.sin(perpAngle) * baseOffset,
  )
  context.lineTo(
    CENTER_X - Math.cos(perpAngle) * baseOffset,
    CENTER_Y - Math.sin(perpAngle) * baseOffset,
  )
  context.closePath()
  context.fillStyle = 'rgba(255, 255, 255, 0.9)'
  context.fill()

  context.beginPath()
  context.arc(CENTER_X, CENTER_Y, 6, 0, Math.PI * 2)
  context.fillStyle = '#ffffff'
  context.fill()
  context.beginPath()
  context.arc(CENTER_X, CENTER_Y, 3, 0, Math.PI * 2)
  context.fillStyle = '#010208'
  context.fill()
}

function drawScoreText(context: CanvasRenderingContext2D, score: number) {
  const color = getScoreColor(score)
  context.font = `bold 72px ${FONT}`
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText(String(Math.round(score)), CENTER_X, CENTER_Y + 30)

  const label = getThreatLabel(score)
  context.font = `bold 20px ${FONT}`
  context.fillStyle = getLabelColor(score)
  context.letterSpacing = '6px'
  context.fillText(label, CENTER_X, CENTER_Y + 100)
  context.letterSpacing = '0px'
}

function drawMiniArc(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  value: number,
  label: string,
) {
  context.beginPath()
  context.arc(centerX, centerY, MINI_RADIUS, ARC_START, ARC_END)
  context.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  context.lineWidth = MINI_STROKE
  context.lineCap = 'round'
  context.stroke()

  const fraction = Math.min(1, Math.max(0, value / 100))
  if (fraction > 0) {
    const endAngle = ARC_START + ARC_SPAN * fraction
    context.beginPath()
    context.arc(centerX, centerY, MINI_RADIUS, ARC_START, endAngle)
    context.strokeStyle = getScoreColor(value)
    context.lineWidth = MINI_STROKE
    context.lineCap = 'round'
    context.stroke()
  }

  context.font = `bold 22px ${FONT}`
  context.fillStyle = getScoreColor(value)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(Math.round(value)), centerX, centerY + 2)

  context.font = `14px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.4)'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText(label, centerX, centerY + MINI_RADIUS + 10)
}

function drawSparkline(context: CanvasRenderingContext2D) {
  const raw = localStorage.getItem('cyber-pulse:weatherHistory')
  if (!raw) return

  let history: number[]
  try {
    history = JSON.parse(raw) as number[]
  } catch {
    return
  }
  if (!Array.isArray(history) || history.length < 2) return

  const last30 = history.slice(-30)
  const sparklineWidth = SPARKLINE_RIGHT - SPARKLINE_LEFT
  const stepX = sparklineWidth / (last30.length - 1)

  context.font = `14px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.2)'
  context.textAlign = 'left'
  context.textBaseline = 'bottom'
  context.fillText('30-DAY TREND', SPARKLINE_LEFT, SPARKLINE_Y - SPARKLINE_HEIGHT - 8)

  context.beginPath()
  context.moveTo(SPARKLINE_LEFT, SPARKLINE_Y)
  for (let index = 0; index < last30.length; index++) {
    const pointValue = last30[index] ?? 0
    const pointX = SPARKLINE_LEFT + index * stepX
    const pointY = SPARKLINE_Y - (pointValue / 100) * SPARKLINE_HEIGHT
    if (index === 0) {
      context.moveTo(pointX, pointY)
    } else {
      context.lineTo(pointX, pointY)
    }
  }

  const lastValue = last30[last30.length - 1] ?? 0
  const gradient = context.createLinearGradient(SPARKLINE_LEFT, 0, SPARKLINE_RIGHT, 0)
  gradient.addColorStop(0, 'rgba(0, 229, 255, 0.5)')
  gradient.addColorStop(1, getScoreColor(lastValue))
  context.strokeStyle = gradient
  context.lineWidth = 1.5
  context.stroke()

  context.lineTo(SPARKLINE_RIGHT, SPARKLINE_Y)
  context.lineTo(SPARKLINE_LEFT, SPARKLINE_Y)
  context.closePath()
  const fillGradient = context.createLinearGradient(0, SPARKLINE_Y - SPARKLINE_HEIGHT, 0, SPARKLINE_Y)
  fillGradient.addColorStop(0, 'rgba(0, 229, 255, 0.08)')
  fillGradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)')
  context.fillStyle = fillGradient
  context.fill()
}

function drawBackground(context: CanvasRenderingContext2D, score: number) {
  const warmth = Math.min(1, score / 100)
  const red = Math.round(1 + warmth * 20)
  const green = Math.round(2 + warmth * 2)
  const blue = Math.round(8 + warmth * 5)
  context.fillStyle = `rgb(${red}, ${green}, ${blue})`
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const hexToRGBA = (hex: string, alpha: number): string => {
    const bigint = parseInt(hex.slice(1), 16)
    const hexRed = (bigint >> 16) & 255
    const hexGreen = (bigint >> 8) & 255
    const hexBlue = bigint & 255
    return `rgba(${hexRed}, ${hexGreen}, ${hexBlue}, ${alpha})`
  }

  const radialGradient = context.createRadialGradient(CENTER_X, CENTER_Y, 0, CENTER_X, CENTER_Y, 500)
  radialGradient.addColorStop(0, hexToRGBA(getScoreColor(score), 0.04))
  radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = radialGradient
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const centerGlow = context.createRadialGradient(CENTER_X, CENTER_Y, 0, CENTER_X, CENTER_Y, 450)
  centerGlow.addColorStop(0, hexToRGBA(getScoreColor(score), 0.06))
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = centerGlow
  context.fillRect(0, 0, WIDTH, HEIGHT)
}

function drawTitle(context: CanvasRenderingContext2D) {
  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.25)'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.letterSpacing = '6px'
  context.fillText('THREAT WEATHER', CENTER_X, 30)
  context.letterSpacing = '0px'
}

export function WeatherScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    let rafID = 0

    const frame = () => {
      const targetScore = store.threatWeather
      animatedScore += (targetScore - animatedScore) * LERP_SPEED
      needleAngle += ((ARC_START + ARC_SPAN * (animatedScore / 100)) - needleAngle) * LERP_SPEED

      for (let index = 0; index < SIGNALS.length; index++) {
        const signal = SIGNALS[index]
        const currentAnimated = animatedSignals[index]
        if (!signal || currentAnimated === undefined) continue
        const targetValue = signal.getValue()
        animatedSignals[index] = currentAnimated + (targetValue - currentAnimated) * LERP_SPEED
      }

      drawBackground(context, animatedScore)
      drawTitle(context)
      drawGaugeBackground(context)
      drawGaugeFill(context, animatedScore / 100)
      drawGaugeTicks(context)
      drawNeedle(context, needleAngle)
      drawScoreText(context, animatedScore)

      for (let index = 0; index < SIGNALS.length; index++) {
        const signal = SIGNALS[index]
        const signalValue = animatedSignals[index]
        if (!signal || signalValue === undefined) continue
        const angle = (Math.PI * 2 * index) / SIGNALS.length - Math.PI / 2
        const miniX = CENTER_X + Math.cos(angle) * MINI_ORBIT_RADIUS
        const miniY = CENTER_Y + Math.sin(angle) * MINI_ORBIT_RADIUS
        drawMiniArc(context, miniX, miniY, signalValue, signal.label)
      }

      drawSparkline(context)

      rafID = requestAnimationFrame(frame)
    }

    rafID = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafID)
  }, [])

  return (
    <canvas
      ref={canvasReference}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#010208' }}
    />
  )
}
