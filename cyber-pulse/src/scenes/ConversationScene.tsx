import { useRef, useEffect } from 'react'
import { store } from '../data/store'
import type { CommunityPost } from '../data/types'

const WIDTH = 1280
const HEIGHT = 720
const FONT = "'JetBrains Mono', monospace"
const CVE_REGEX = /CVE-\d{4}-\d{4,}/g

const SECURITY_KEYWORDS = [
  'ransomware', 'zero-day', 'breach', 'exploit', 'malware',
  'phishing', 'vulnerability', 'backdoor', 'botnet', 'DDoS',
]

const SOURCE_COLORS: Record<string, string> = {
  hn: '#ff6600',
  reddit: '#0079d3',
  mastodon: '#6364ff',
  bluesky: '#0085ff',
  rss: '#ffbe0b',
}

interface TopicBubble {
  topic: string
  isCVE: boolean
  sources: Set<string>
  positionX: number
  positionY: number
  velocityX: number
  velocityY: number
}

const bubbles: TopicBubble[] = []
let lastPostCount = 0

function extractTopics(posts: CommunityPost[]): Map<string, Set<string>> {
  const topicSources = new Map<string, Set<string>>()

  for (const post of posts) {
    const text = post.title.toLowerCase()

    for (const cveId of post.cveIds) {
      const existing = topicSources.get(cveId)
      if (existing) {
        existing.add(post.source)
      } else {
        topicSources.set(cveId, new Set([post.source]))
      }
    }

    const titleCVEs = post.title.match(CVE_REGEX)
    if (titleCVEs) {
      for (const cveId of titleCVEs) {
        const existing = topicSources.get(cveId)
        if (existing) {
          existing.add(post.source)
        } else {
          topicSources.set(cveId, new Set([post.source]))
        }
      }
    }

    for (const keyword of SECURITY_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        const existing = topicSources.get(keyword)
        if (existing) {
          existing.add(post.source)
        } else {
          topicSources.set(keyword, new Set([post.source]))
        }
      }
    }
  }

  return topicSources
}

function syncBubbles(topicSources: Map<string, Set<string>>) {
  const multisource = new Map<string, Set<string>>()
  for (const [topic, sources] of topicSources) {
    if (sources.size >= 2) {
      multisource.set(topic, sources)
    }
  }

  const activeTopics = new Set(multisource.keys())

  for (let index = bubbles.length - 1; index >= 0; index--) {
    const bubble = bubbles[index]
    if (bubble && !activeTopics.has(bubble.topic)) {
      bubbles.splice(index, 1)
    }
  }

  for (const [topic, sources] of multisource) {
    const existing = bubbles.find(bubble => bubble.topic === topic)
    if (existing) {
      existing.sources = sources
    } else {
      bubbles.push({
        topic,
        isCVE: CVE_REGEX.test(topic),
        sources,
        positionX: WIDTH / 4 + Math.random() * WIDTH / 2,
        positionY: HEIGHT / 4 + Math.random() * HEIGHT / 2,
        velocityX: (Math.random() - 0.5) * 0.3,
        velocityY: (Math.random() - 0.5) * 0.3,
      })
    }
  }
}

function updatePhysics() {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2

  for (const bubble of bubbles) {
    const toCenterX = centerX - bubble.positionX
    const toCenterY = centerY - bubble.positionY
    const distanceToCenter = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY)

    if (distanceToCenter > 1) {
      bubble.velocityX += (toCenterX / distanceToCenter) * 0.02
      bubble.velocityY += (toCenterY / distanceToCenter) * 0.02
    }

    for (const other of bubbles) {
      if (other === bubble) continue
      const deltaX = bubble.positionX - other.positionX
      const deltaY = bubble.positionY - other.positionY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const bubbleRadius = 15 + bubble.sources.size * 10
      const otherRadius = 15 + other.sources.size * 10
      const minDistance = bubbleRadius + otherRadius + 10

      if (distance < minDistance && distance > 0.1) {
        const force = (minDistance - distance) / distance * 0.05
        bubble.velocityX += deltaX * force
        bubble.velocityY += deltaY * force
      }
    }

    bubble.velocityX *= 0.96
    bubble.velocityY *= 0.96

    bubble.positionX += bubble.velocityX
    bubble.positionY += bubble.velocityY

    const margin = 60
    if (bubble.positionX < margin) bubble.positionX = margin
    if (bubble.positionX > WIDTH - margin) bubble.positionX = WIDTH - margin
    if (bubble.positionY < margin) bubble.positionY = margin
    if (bubble.positionY > HEIGHT - margin) bubble.positionY = HEIGHT - margin
  }
}

function drawGrid(context: CanvasRenderingContext2D) {
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

function drawBubble(context: CanvasRenderingContext2D, bubble: TopicBubble, time: number) {
  const radius = 15 + bubble.sources.size * 10
  const baseColor = bubble.isCVE ? '#00e5ff' : '#ffbe0b'
  const breathe = 1 + Math.sin(time * 0.002 + bubble.positionX * 0.01) * 0.03

  context.beginPath()
  context.arc(bubble.positionX, bubble.positionY, radius * breathe, 0, Math.PI * 2)
  context.fillStyle = `${baseColor}15`
  context.fill()
  context.strokeStyle = `${baseColor}40`
  context.lineWidth = 1
  context.stroke()

  context.font = `bold ${radius < 25 ? 14 : 16}px ${FONT}`
  context.fillStyle = baseColor
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const displayText = bubble.topic.length > 18 ? bubble.topic.slice(0, 15) + '...' : bubble.topic
  context.fillText(displayText.toUpperCase(), bubble.positionX, bubble.positionY)

  const sourceArray = [...bubble.sources]
  const orbitRadius = radius + 10
  for (let index = 0; index < sourceArray.length; index++) {
    const sourceKey = sourceArray[index]
    if (!sourceKey) continue
    const angle = (Math.PI * 2 * index) / sourceArray.length + time * 0.001
    const dotX = bubble.positionX + Math.cos(angle) * orbitRadius
    const dotY = bubble.positionY + Math.sin(angle) * orbitRadius
    const dotColor = SOURCE_COLORS[sourceKey] ?? '#888888'

    context.beginPath()
    context.arc(dotX, dotY, 3, 0, Math.PI * 2)
    context.fillStyle = dotColor
    context.fill()
  }
}

function drawFallbackFeed(context: CanvasRenderingContext2D, posts: CommunityPost[]) {
  const recentPosts = posts.slice(0, 12)
  const columnWidth = WIDTH / 3
  const startY = 80

  const sourceLabels: Record<string, string> = {
    hn: 'HN',
    reddit: 'REDDIT',
    mastodon: 'MASTODON',
    bluesky: 'BLUESKY',
    rss: 'RSS',
  }

  for (let index = 0; index < recentPosts.length; index++) {
    const post = recentPosts[index]
    if (!post) continue
    const column = index % 3
    const row = Math.floor(index / 3)
    const positionX = column * columnWidth + 40
    const positionY = startY + row * 120

    const sourceColor = SOURCE_COLORS[post.source] ?? '#888888'
    const label = sourceLabels[post.source] ?? post.source.toUpperCase()

    context.font = `bold 14px ${FONT}`
    context.fillStyle = sourceColor
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillText(label, positionX, positionY)

    context.font = `16px ${FONT}`
    context.fillStyle = 'rgba(255, 255, 255, 0.7)'
    const truncatedTitle = post.title.length > 50 ? post.title.slice(0, 47) + '...' : post.title
    context.fillText(truncatedTitle, positionX, positionY + 16)

    if (post.score > 0) {
      context.font = `14px ${FONT}`
      context.fillStyle = 'rgba(255, 255, 255, 0.3)'
      context.fillText(`↑${post.score}`, positionX, positionY + 34)
    }
  }
}

function drawHeader(context: CanvasRenderingContext2D, topicCount: number, sourceCount: number) {
  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.25)'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.letterSpacing = '6px'
  context.fillText('COMMUNITY CONVERGENCE', WIDTH / 2, 24)
  context.letterSpacing = '0px'

  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.4)'
  context.textAlign = 'center'
  context.fillText(
    `${topicCount} TOPICS TRENDING ACROSS ${sourceCount} SOURCES`,
    WIDTH / 2,
    HEIGHT - 30,
  )
}

function drawLegend(context: CanvasRenderingContext2D) {
  const entries = [
    { label: 'HN', color: '#ff6600' },
    { label: 'REDDIT', color: '#0079d3' },
    { label: 'MASTODON', color: '#6364ff' },
    { label: 'BLUESKY', color: '#0085ff' },
    { label: 'RSS', color: '#ffbe0b' },
  ]

  const startX = 40
  const positionY = HEIGHT - 30
  let offsetX = startX

  context.font = `14px ${FONT}`
  context.textBaseline = 'middle'

  for (const entry of entries) {
    context.beginPath()
    context.arc(offsetX, positionY, 3, 0, Math.PI * 2)
    context.fillStyle = entry.color
    context.fill()

    context.textAlign = 'left'
    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.fillText(entry.label, offsetX + 8, positionY)
    offsetX += context.measureText(entry.label).width + 24
  }
}

export function ConversationScene() {
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

      const allPosts: CommunityPost[] = [
        ...store.communityPosts,
        ...store.rssItems,
        ...store.blueskyPosts,
      ]
      const currentPostCount = allPosts.length

      if (currentPostCount !== lastPostCount) {
        const topicSources = extractTopics(allPosts)
        syncBubbles(topicSources)
        lastPostCount = currentPostCount
      }

      updatePhysics()

      context.fillStyle = '#010208'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      drawGrid(context)

      const allSources = new Set<string>()
      for (const bubble of bubbles) {
        for (const source of bubble.sources) {
          allSources.add(source)
        }
      }

      drawHeader(context, bubbles.length, allSources.size)

      if (bubbles.length > 0) {
        for (const bubble of bubbles) {
          drawBubble(context, bubble, now)
        }
      } else {
        drawFallbackFeed(context, allPosts)
      }

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
