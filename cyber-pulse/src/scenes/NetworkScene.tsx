import { useRef, useEffect } from 'react'
import { store } from '../data/store'

const WIDTH = 1280
const HEIGHT = 720
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const MAX_C2_NODES = 100
const DAMPING = 0.95
const REPULSION_STRENGTH = 800
const SPRING_STRENGTH = 0.005
const SPRING_REST_LENGTH = 80
const GRAVITY_STRENGTH = 0.0003
const REPULSION_CAP = 5

const FAMILY_COLORS: Record<string, string> = {
  Dridex: '#00e5ff',
  Emotet: '#ff006e',
  QakBot: '#ffbe0b',
  BazarLoader: '#06d6a0',
  TrickBot: '#a855f7',
  IcedID: '#f97316',
  Pikabot: '#ec4899',
  BumbleBee: '#84cc16',
  SystemBC: '#06b6d4',
  Cobalt: '#e11d48',
  CobaltStrike: '#e11d48',
}

const FALLBACK_COLORS = [
  '#00e5ff', '#ff006e', '#ffbe0b', '#06d6a0', '#a855f7',
  '#f97316', '#ec4899', '#84cc16', '#06b6d4', '#e11d48',
]

interface GraphNode {
  x: number
  y: number
  velocityX: number
  velocityY: number
  type: 'family' | 'c2'
  label: string
  color: string
  radius: number
  familyIndex: number
  isOnline: boolean
}

interface GraphEdge {
  source: number
  target: number
}

let nodes: GraphNode[] = []
let edges: GraphEdge[] = []
let previousC2Length = 0
let totalC2Count = 0
let familyCount = 0
let activeCount = 0
let overflowCount = 0

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '')
  const red = parseInt(cleaned.slice(0, 2), 16)
  const green = parseInt(cleaned.slice(2, 4), 16)
  const blue = parseInt(cleaned.slice(4, 6), 16)
  return [red ?? 0, green ?? 0, blue ?? 0]
}

function buildGraph() {
  const c2List = store.feodoC2s
  if (c2List.length === previousC2Length && nodes.length > 0) return

  previousC2Length = c2List.length
  totalC2Count = c2List.length

  const familyMap = new Map<string, Array<{ ipAddress: string; isOnline: boolean }>>()

  for (const c2 of c2List) {
    const family = c2.malware || 'Unknown'
    const existing = familyMap.get(family)
    if (existing) {
      existing.push({ ipAddress: c2.ip_address, isOnline: c2.status === 'online' })
    } else {
      familyMap.set(family, [{ ipAddress: c2.ip_address, isOnline: c2.status === 'online' }])
    }
  }

  familyCount = familyMap.size
  activeCount = c2List.filter(c2 => c2.status === 'online').length

  const newNodes: GraphNode[] = []
  const newEdges: GraphEdge[] = []
  let colorIndex = 0
  let c2NodesPlaced = 0

  const familyEntries = [...familyMap.entries()]
  familyEntries.sort((entryA, entryB) => entryB[1].length - entryA[1].length)

  const angleStep = (Math.PI * 2) / Math.max(1, familyEntries.length)

  for (let familyIndex = 0; familyIndex < familyEntries.length; familyIndex++) {
    const entry = familyEntries[familyIndex]
    if (!entry) continue
    const [family, members] = entry

    const color = FAMILY_COLORS[family] ?? FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length] ?? '#00e5ff'
    colorIndex++

    const familyRadius = 25 + Math.min(10, members.length / 5)
    const angle = angleStep * familyIndex
    const spreadRadius = 180

    const familyNodeIndex = newNodes.length
    newNodes.push({
      x: CENTER_X + Math.cos(angle) * spreadRadius + (Math.random() - 0.5) * 40,
      y: CENTER_Y + Math.sin(angle) * spreadRadius + (Math.random() - 0.5) * 40,
      velocityX: 0,
      velocityY: 0,
      type: 'family',
      label: family,
      color,
      radius: familyRadius,
      familyIndex,
      isOnline: true,
    })

    for (const member of members) {
      if (c2NodesPlaced >= MAX_C2_NODES) {
        overflowCount = totalC2Count - MAX_C2_NODES
        break
      }

      const memberAngle = Math.random() * Math.PI * 2
      const memberDistance = 40 + Math.random() * 60

      newNodes.push({
        x: newNodes[familyNodeIndex]!.x + Math.cos(memberAngle) * memberDistance,
        y: newNodes[familyNodeIndex]!.y + Math.sin(memberAngle) * memberDistance,
        velocityX: 0,
        velocityY: 0,
        type: 'c2',
        label: member.ipAddress,
        color,
        radius: 4 + Math.random() * 2,
        familyIndex,
        isOnline: member.isOnline,
      })

      newEdges.push({
        source: newNodes.length - 1,
        target: familyNodeIndex,
      })

      c2NodesPlaced++
    }

    if (c2NodesPlaced >= MAX_C2_NODES) break
  }

  if (totalC2Count > MAX_C2_NODES) {
    overflowCount = totalC2Count - MAX_C2_NODES
  } else {
    overflowCount = 0
  }

  nodes = newNodes
  edges = newEdges
}

function simulateForces() {
  for (let indexA = 0; indexA < nodes.length; indexA++) {
    const nodeA = nodes[indexA]
    if (!nodeA) continue

    for (let indexB = indexA + 1; indexB < nodes.length; indexB++) {
      const nodeB = nodes[indexB]
      if (!nodeB) continue

      const deltaX = nodeA.x - nodeB.x
      const deltaY = nodeA.y - nodeB.y
      const distanceSquared = deltaX * deltaX + deltaY * deltaY
      const distance = Math.sqrt(distanceSquared + 1)

      const force = Math.min(REPULSION_CAP, REPULSION_STRENGTH / distanceSquared)
      const forceX = (deltaX / distance) * force
      const forceY = (deltaY / distance) * force

      nodeA.velocityX += forceX
      nodeA.velocityY += forceY
      nodeB.velocityX -= forceX
      nodeB.velocityY -= forceY
    }
  }

  for (const edge of edges) {
    const sourceNode = nodes[edge.source]
    const targetNode = nodes[edge.target]
    if (!sourceNode || !targetNode) continue

    const deltaX = targetNode.x - sourceNode.x
    const deltaY = targetNode.y - sourceNode.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + 1)
    const displacement = distance - SPRING_REST_LENGTH
    const force = SPRING_STRENGTH * displacement

    const forceX = (deltaX / distance) * force
    const forceY = (deltaY / distance) * force

    sourceNode.velocityX += forceX
    sourceNode.velocityY += forceY
    targetNode.velocityX -= forceX
    targetNode.velocityY -= forceY
  }

  for (const node of nodes) {
    const deltaX = CENTER_X - node.x
    const deltaY = CENTER_Y - node.y
    node.velocityX += deltaX * GRAVITY_STRENGTH
    node.velocityY += deltaY * GRAVITY_STRENGTH

    node.velocityX *= DAMPING
    node.velocityY *= DAMPING

    node.x += node.velocityX
    node.y += node.velocityY

    node.x = Math.max(node.radius, Math.min(WIDTH - node.radius, node.x))
    node.y = Math.max(node.radius, Math.min(HEIGHT - node.radius, node.y))
  }
}

function drawGraph(context: CanvasRenderingContext2D, now: number) {
  context.clearRect(0, 0, WIDTH, HEIGHT)

  context.fillStyle = '#010208'
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.strokeStyle = 'rgba(26, 26, 46, 0.3)'
  context.lineWidth = 0.5
  for (let gridX = 0; gridX < WIDTH; gridX += 40) {
    context.beginPath()
    context.moveTo(gridX, 0)
    context.lineTo(gridX, HEIGHT)
    context.stroke()
  }
  for (let gridY = 0; gridY < HEIGHT; gridY += 40) {
    context.beginPath()
    context.moveTo(0, gridY)
    context.lineTo(WIDTH, gridY)
    context.stroke()
  }

  buildGraph()

  if (nodes.length === 0) {
    context.font = '500 20px "JetBrains Mono", monospace'
    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.textAlign = 'center'
    context.fillText('AWAITING C2 DATA...', CENTER_X, CENTER_Y)
    context.textAlign = 'start'
    return
  }

  simulateForces()

  context.lineWidth = 0.5
  for (const edge of edges) {
    const sourceNode = nodes[edge.source]
    const targetNode = nodes[edge.target]
    if (!sourceNode || !targetNode) continue

    context.beginPath()
    context.moveTo(sourceNode.x, sourceNode.y)
    context.lineTo(targetNode.x, targetNode.y)
    context.strokeStyle = '#1a1a2e'
    context.stroke()
  }

  const pulse = Math.sin(now * 0.003) * 0.3

  for (const node of nodes) {
    if (node.type === 'c2') {
      const [red, green, blue] = hexToRgb(node.color)

      if (node.isOnline) {
        const onlinePulse = 1 + pulse * 0.5
        const glowRadius = node.radius * 3

        const glow = context.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, glowRadius,
        )
        glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.15)`)
        glow.addColorStop(1, 'transparent')
        context.fillStyle = glow
        context.fillRect(
          node.x - glowRadius, node.y - glowRadius,
          glowRadius * 2, glowRadius * 2,
        )

        context.beginPath()
        context.arc(node.x, node.y, node.radius * onlinePulse, 0, Math.PI * 2)
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.7)`
        context.fill()
      } else {
        context.beginPath()
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        context.fillStyle = '#333333'
        context.fill()
      }
    }
  }

  for (const node of nodes) {
    if (node.type !== 'family') continue
    const [red, green, blue] = hexToRgb(node.color)

    const glowRadius = node.radius * 2
    const glow = context.createRadialGradient(
      node.x, node.y, node.radius * 0.5,
      node.x, node.y, glowRadius,
    )
    glow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.2)`)
    glow.addColorStop(1, 'transparent')
    context.fillStyle = glow
    context.fillRect(
      node.x - glowRadius, node.y - glowRadius,
      glowRadius * 2, glowRadius * 2,
    )

    context.beginPath()
    context.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.15)`
    context.fill()
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.6)`
    context.lineWidth = 1.5
    context.stroke()

    context.font = '700 16px "JetBrains Mono", monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.9)`
    context.fillText(node.label, node.x, node.y)
  }

  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  context.font = '500 16px "JetBrains Mono", monospace'
  context.fillStyle = 'rgba(255, 255, 255, 0.5)'
  context.fillText(
    `${activeCount} ACTIVE C2 SERVERS ACROSS ${familyCount} FAMILIES`,
    CENTER_X,
    HEIGHT - 28,
  )

  if (overflowCount > 0) {
    context.font = '500 14px "JetBrains Mono", monospace'
    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.fillText(
      `Showing ${MAX_C2_NODES} of ${totalC2Count} total C2s`,
      CENTER_X,
      HEIGHT - 12,
    )
  }

  context.textAlign = 'start'
}

export function NetworkScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    let frameHandle: number

    const frame = () => {
      const now = performance.now()
      drawGraph(context, now)
      frameHandle = requestAnimationFrame(frame)
    }

    frameHandle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameHandle)
  }, [])

  return (
    <div className="absolute inset-0" style={{ background: '#010208' }}>
      <canvas
        ref={canvasReference}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
