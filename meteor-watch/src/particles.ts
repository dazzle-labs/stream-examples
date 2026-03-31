/* ------------------------------------------------------------------ */
/*  Ambient floating mote particles on a dedicated canvas layer        */
/*  Creates depth and atmosphere with slow sine/cosine turbulence.     */
/* ------------------------------------------------------------------ */

const PARTICLE_COUNT = 40
const W = 1280
const H = 720

interface Mote {
  x: number
  y: number
  size: number        // 1-3px
  opacity: number     // current opacity
  maxOpacity: number  // 0.03-0.08
  speed: number       // drift multiplier (parallax: larger = faster)
  phaseX: number      // sine phase offset
  phaseY: number      // cosine phase offset
  freqX: number       // turbulence frequency X
  freqY: number       // turbulence frequency Y
  lifecycle: number   // total lifecycle duration (ms)
  age: number         // current age in lifecycle (ms)
}

export interface ParticleSystem {
  update(dt: number): void
  render(): void
}

function spawnMote(randomAge: boolean): Mote {
  const size = 1 + Math.random() * 2
  const maxOpacity = 0.03 + Math.random() * 0.05
  // Parallax: larger/brighter motes drift faster
  const speed = 0.3 + (size / 3) * 0.7
  const lifecycle = 5000 + Math.random() * 10000

  return {
    x: Math.random() * W,
    y: Math.random() * H,
    size,
    opacity: 0,
    maxOpacity,
    speed,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    freqX: 0.0003 + Math.random() * 0.0004,
    freqY: 0.0002 + Math.random() * 0.0003,
    lifecycle,
    age: randomAge ? Math.random() * lifecycle : 0,
  }
}

export function initParticles(canvas: HTMLCanvasElement): ParticleSystem {
  const maybeCtx = canvas.getContext('2d')
  if (!maybeCtx) {
    return { update() {}, render() {} }
  }

  // Bind to a const so TypeScript narrows inside closures
  const ctx: CanvasRenderingContext2D = maybeCtx

  canvas.width = W
  canvas.height = H

  // Initialize motes with random ages so they don't all start fading in together
  const motes: Mote[] = Array.from({ length: PARTICLE_COUNT }, () => spawnMote(true))

  let elapsed = 0

  function update(dt: number): void {
    elapsed += dt

    for (let i = 0; i < motes.length; i++) {
      const m = motes[i]
      if (!m) continue

      m.age += dt

      // Respawn if lifecycle complete
      if (m.age >= m.lifecycle) {
        motes[i] = spawnMote(false)
        continue
      }

      // Fade in/out envelope: first 20% fade in, last 20% fade out
      const lifeProgress = m.age / m.lifecycle
      let envelope = 1
      if (lifeProgress < 0.2) {
        envelope = lifeProgress / 0.2
      } else if (lifeProgress > 0.8) {
        envelope = (1 - lifeProgress) / 0.2
      }
      m.opacity = m.maxOpacity * envelope

      // Sine/cosine turbulence drift
      const timeMs = elapsed
      const dx = Math.sin(timeMs * m.freqX + m.phaseX) * m.speed * 0.015
      const dy = Math.cos(timeMs * m.freqY + m.phaseY) * m.speed * 0.012

      m.x += dx
      m.y += dy

      // Wrap around edges
      if (m.x < -10) m.x = W + 10
      if (m.x > W + 10) m.x = -10
      if (m.y < -10) m.y = H + 10
      if (m.y > H + 10) m.y = -10
    }
  }

  function render(): void {
    ctx.clearRect(0, 0, W, H)

    for (const m of motes) {
      if (m.opacity < 0.005) continue

      // Warm amber tint matching the theme
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(245, 200, 130, ${m.opacity})`
      ctx.fill()
    }
  }

  return { update, render }
}
