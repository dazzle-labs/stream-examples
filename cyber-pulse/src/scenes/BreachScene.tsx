import { useRef, useEffect } from 'react'
import { store } from '../data/store'
import type { Breach } from '../data/types'

const WIDTH = 1280
const HEIGHT = 720
const FONT = "'JetBrains Mono', monospace"
const TIMELINE_Y = HEIGHT * 0.4
const TIMELINE_LEFT = 80
const TIMELINE_RIGHT = WIDTH - 80
const MIN_RADIUS = 8
const MAX_RADIUS = 40

interface BreachCircle {
  breach: Breach
  positionX: number
  baseY: number
  radius: number
  color: string
  phase: number
  showLabel: boolean
}

let breachCircles: BreachCircle[] = []
let lastBreachCount = 0

function getBreachColor(dataClasses: string[]): string {
  if (dataClasses.some(dataClass => dataClass === 'Passwords')) return '#ef233c'
  if (dataClasses.some(dataClass => dataClass === 'Email addresses')) return '#ffbe0b'
  if (dataClasses.some(dataClass => dataClass === 'Phone numbers')) return '#ff006e'
  return '#00e5ff'
}

function computeRadius(pwnCount: number): number {
  if (pwnCount <= 0) return MIN_RADIUS
  const logValue = Math.log10(Math.max(1, pwnCount))
  const normalized = (logValue - 3) / (10 - 3)
  return MIN_RADIUS + Math.max(0, Math.min(1, normalized)) * (MAX_RADIUS - MIN_RADIUS)
}

function formatRecordCount(total: number): string {
  if (total >= 1_000_000_000) return `${(total / 1_000_000_000).toFixed(1)} BILLION`
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)} MILLION`
  if (total >= 1_000) return `${(total / 1_000).toFixed(0)}K`
  return String(total)
}

function buildCircles() {
  const verified = store.breaches.filter(breach => breach.IsVerified)
  const sorted = [...verified].sort(
    (breachA, breachB) =>
      new Date(breachA.BreachDate).getTime() - new Date(breachB.BreachDate).getTime(),
  )
  const recent = sorted.slice(-30)

  if (recent.length === 0) {
    breachCircles = []
    return
  }

  const bySize = [...recent].sort((breachA, breachB) => breachB.PwnCount - breachA.PwnCount)
  const topFiveNames = new Set(bySize.slice(0, 5).map(breach => breach.Name))

  const timelineWidth = TIMELINE_RIGHT - TIMELINE_LEFT
  const earliest = new Date(recent[0]?.BreachDate ?? '2000-01-01').getTime()
  const latestBreach = recent[recent.length - 1]
  const latest = new Date(latestBreach?.BreachDate ?? '2025-01-01').getTime()
  const timeSpan = Math.max(1, latest - earliest)

  breachCircles = recent.map((breach, index) => {
    const breachTime = new Date(breach.BreachDate).getTime()
    const fraction = (breachTime - earliest) / timeSpan
    const positionX = TIMELINE_LEFT + fraction * timelineWidth
    const radius = computeRadius(breach.PwnCount)
    const rowOffset = (index % 3 - 1) * (radius + 8)

    return {
      breach,
      positionX,
      baseY: TIMELINE_Y + rowOffset,
      radius,
      color: getBreachColor(breach.DataClasses),
      phase: index * 0.7,
      showLabel: topFiveNames.has(breach.Name),
    }
  })
}

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = '#010208'
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const gradient = context.createRadialGradient(WIDTH / 2, TIMELINE_Y, 0, WIDTH / 2, TIMELINE_Y, 600)
  gradient.addColorStop(0, 'rgba(239, 35, 60, 0.03)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.strokeStyle = 'rgba(255, 255, 255, 0.02)'
  context.lineWidth = 1
  for (let x = 0; x < WIDTH; x += 40) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, HEIGHT)
    context.stroke()
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(WIDTH, y)
    context.stroke()
  }
}

function drawTimeline(context: CanvasRenderingContext2D) {
  context.beginPath()
  context.moveTo(TIMELINE_LEFT, TIMELINE_Y)
  context.lineTo(TIMELINE_RIGHT, TIMELINE_Y)
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  context.lineWidth = 1
  context.stroke()

  context.beginPath()
  context.moveTo(TIMELINE_RIGHT, TIMELINE_Y)
  context.lineTo(TIMELINE_RIGHT - 8, TIMELINE_Y - 4)
  context.lineTo(TIMELINE_RIGHT - 8, TIMELINE_Y + 4)
  context.closePath()
  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.fill()
}

function drawCircle(context: CanvasRenderingContext2D, circle: BreachCircle, time: number) {
  const oscillation = Math.sin(time * 0.0015 + circle.phase) * 3
  const displayY = circle.baseY + oscillation

  context.beginPath()
  context.arc(circle.positionX, displayY, circle.radius, 0, Math.PI * 2)
  context.fillStyle = `${circle.color}20`
  context.fill()
  context.strokeStyle = `${circle.color}50`
  context.lineWidth = 1
  context.stroke()

  context.beginPath()
  context.arc(circle.positionX, displayY, circle.radius * 0.4, 0, Math.PI * 2)
  context.fillStyle = `${circle.color}60`
  context.fill()

  if (circle.showLabel) {
    context.font = `bold 14px ${FONT}`
    context.fillStyle = 'rgba(255, 255, 255, 0.7)'
    context.textAlign = 'center'
    context.textBaseline = 'bottom'

    const labelName = circle.breach.Title.length > 20
      ? circle.breach.Title.slice(0, 17) + '...'
      : circle.breach.Title
    context.fillText(labelName, circle.positionX, displayY - circle.radius - 6)

    context.font = `14px ${FONT}`
    context.fillStyle = `${circle.color}99`
    context.fillText(
      circle.breach.PwnCount.toLocaleString(),
      circle.positionX,
      displayY - circle.radius + 4,
    )
  }
}

function drawHeader(context: CanvasRenderingContext2D) {
  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.25)'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.letterSpacing = '6px'
  context.fillText('BREACH TRACKER', WIDTH / 2, 24)
  context.letterSpacing = '0px'

  const totalRecords = store.breaches.reduce(
    (sum, breach) => sum + breach.PwnCount,
    0,
  )

  context.font = `bold 48px ${FONT}`
  context.fillStyle = '#ef233c'
  context.textAlign = 'center'
  context.fillText(
    `${formatRecordCount(totalRecords)} RECORDS EXPOSED`,
    WIDTH / 2,
    56,
  )

  context.font = `16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.35)'
  context.fillText(
    `${store.breaches.length} KNOWN BREACHES`,
    WIDTH / 2,
    100,
  )
}

function drawRansomwareSection(context: CanvasRenderingContext2D) {
  const sectionY = HEIGHT * 0.72

  context.beginPath()
  context.moveTo(80, sectionY)
  context.lineTo(WIDTH - 80, sectionY)
  context.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  context.lineWidth = 1
  context.stroke()

  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.2)'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  context.letterSpacing = '4px'
  context.fillText('RANSOMWARE', 80, sectionY + 16)
  context.letterSpacing = '0px'

  if (store.ransomwarePayments.length > 0) {
    let totalUSD = 0
    for (const payment of store.ransomwarePayments) {
      for (const transaction of payment.transactions) {
        totalUSD += transaction.amountUSD
      }
    }

    const formattedUSD = totalUSD >= 1_000_000
      ? `$${(totalUSD / 1_000_000).toFixed(1)}M`
      : `$${(totalUSD / 1_000).toFixed(0)}K`

    context.font = `bold 40px ${FONT}`
    context.fillStyle = '#f77f00'
    context.textAlign = 'left'
    context.fillText(formattedUSD, 80, sectionY + 38)

    context.font = `16px ${FONT}`
    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.fillText('USD TRACKED', 80 + context.measureText(formattedUSD).width + 16, sectionY + 48)

    context.font = `16px ${FONT}`
    context.fillStyle = 'rgba(255, 255, 255, 0.2)'
    context.textAlign = 'right'
    context.fillText(
      `${store.ransomwarePayments.length} ADDRESSES`,
      WIDTH - 80,
      sectionY + 48,
    )
  } else {
    context.font = `18px ${FONT}`
    context.fillStyle = 'rgba(255, 255, 255, 0.15)'
    context.textAlign = 'left'
    context.fillText('AWAITING DATA', 80, sectionY + 42)
  }
}

function drawLegend(context: CanvasRenderingContext2D) {
  const entries = [
    { label: 'PASSWORDS', color: '#ef233c' },
    { label: 'EMAILS', color: '#ffbe0b' },
    { label: 'PHONE', color: '#ff006e' },
    { label: 'OTHER', color: '#00e5ff' },
  ]

  const positionY = HEIGHT - 28
  let offsetX = 80

  context.font = `14px ${FONT}`
  context.textBaseline = 'middle'
  context.textAlign = 'left'

  for (const entry of entries) {
    context.beginPath()
    context.arc(offsetX, positionY, 4, 0, Math.PI * 2)
    context.fillStyle = `${entry.color}60`
    context.fill()

    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.fillText(entry.label, offsetX + 10, positionY)
    offsetX += context.measureText(entry.label).width + 30
  }
}

export function BreachScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    let frameID = 0

    const frame = () => {
      const now = performance.now()
      const currentBreachCount = store.breaches.length

      if (currentBreachCount !== lastBreachCount) {
        buildCircles()
        lastBreachCount = currentBreachCount
      }

      drawBackground(context)
      drawHeader(context)
      drawTimeline(context)

      for (const circle of breachCircles) {
        drawCircle(context, circle, now)
      }

      drawRansomwareSection(context)
      drawLegend(context)

      frameID = requestAnimationFrame(frame)
    }

    frameID = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameID)
  }, [])

  return (
    <canvas
      ref={canvasReference}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#010208' }}
    />
  )
}
