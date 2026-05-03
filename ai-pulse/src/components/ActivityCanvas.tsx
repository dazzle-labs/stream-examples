import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { ActivityEvent, ParticleKind } from '../types'

interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  opacity: number
  size: number
  kind: ParticleKind
  age: number
  maxAge: number
}

const COLORS: Record<ParticleKind, string> = {
  paper: '0, 212, 255',
  commit: '255, 45, 85',
  star: '255, 171, 0',
  social: '0, 230, 118',
  release: '255, 255, 255',
}

const SIZES: Record<ParticleKind, number> = {
  paper: 3,
  commit: 2,
  star: 1.5,
  social: 2.5,
  release: 5,
}

const MAX_AGE: Record<ParticleKind, number> = {
  paper: 240,
  commit: 150,
  star: 100,
  social: 200,
  release: 70,
}

export interface ActivityCanvasHandle {
  addEvent: (event: ActivityEvent) => void
}

export const ActivityCanvas = forwardRef<ActivityCanvasHandle>(function ActivityCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animFrameRef = useRef(0)

  const spawnParticle = useCallback((kind: ParticleKind) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.width
    const height = canvas.height
    const edge = Math.random()

    let x: number
    let y: number
    let velocityX: number
    let velocityY: number

    if (kind === 'release') {
      x = width * 0.3 + Math.random() * width * 0.4
      y = height * 0.3 + Math.random() * height * 0.4
      velocityX = (Math.random() - 0.5) * 2
      velocityY = (Math.random() - 0.5) * 2
    } else if (edge < 0.3) {
      x = Math.random() * width
      y = -5
      velocityX = (Math.random() - 0.5) * 0.5
      velocityY = 0.4 + Math.random() * 0.6
    } else if (edge < 0.6) {
      x = -5
      y = Math.random() * height
      velocityX = 0.4 + Math.random() * 0.6
      velocityY = (Math.random() - 0.5) * 0.3
    } else if (edge < 0.8) {
      x = width + 5
      y = Math.random() * height
      velocityX = -(0.4 + Math.random() * 0.6)
      velocityY = (Math.random() - 0.5) * 0.3
    } else {
      x = Math.random() * width
      y = height + 5
      velocityX = (Math.random() - 0.5) * 0.5
      velocityY = -(0.3 + Math.random() * 0.4)
    }

    particlesRef.current.push({
      x, y, velocityX, velocityY,
      opacity: 1,
      size: SIZES[kind] ?? 2,
      kind, age: 0,
      maxAge: MAX_AGE[kind] ?? 160,
    })
  }, [])

  useImperativeHandle(ref, () => ({
    addEvent(event: ActivityEvent) {
      const count = event.kind === 'release' ? 8 : event.kind === 'star' ? 1 : 2
      for (let i = 0; i < count; i++) spawnParticle(event.kind)
    },
  }), [spawnParticle])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    canvas.width = 760
    canvas.height = 654

    let lastTime = 0

    function render(timestamp: number): void {
      animFrameRef.current = requestAnimationFrame(render)
      if (!context) return
      if (timestamp - lastTime < 30) return
      lastTime = timestamp

      context.fillStyle = 'rgba(3, 7, 11, 0.25)'
      context.fillRect(0, 0, 760, 654)

      const particles = particlesRef.current
      let writeIndex = 0

      for (let readIndex = 0; readIndex < particles.length; readIndex++) {
        const particle = particles[readIndex]
        if (!particle) continue

        particle.age++
        particle.x += particle.velocityX
        particle.y += particle.velocityY
        particle.velocityX += (Math.random() - 0.5) * 0.015
        particle.velocityY += (Math.random() - 0.5) * 0.015

        const lifeRatio = particle.age / particle.maxAge
        if (lifeRatio < 0.08) {
          particle.opacity = lifeRatio / 0.08
        } else if (lifeRatio > 0.5) {
          particle.opacity = 1 - (lifeRatio - 0.5) / 0.5
        } else {
          particle.opacity = 1
        }

        if (particle.age >= particle.maxAge) continue

        const color = COLORS[particle.kind] ?? '255, 255, 255'
        const alpha = particle.opacity * 0.8

        context.fillStyle = `rgba(${color}, ${alpha})`
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()

        if (particle.size >= 2 && alpha > 0.3) {
          context.fillStyle = `rgba(${color}, ${alpha * 0.15})`
          context.beginPath()
          context.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
          context.fill()
        }

        particles[writeIndex] = particle
        writeIndex++
      }

      particles.length = writeIndex
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ width: 760, height: 654 }}
    />
  )
})
