import type { ParticleSystem } from './simulation'

const SPECIES_COLORS = [
  '#00ffee', // Electric cyan
  '#ff0088', // Hot magenta
  '#44ff00', // Neon green
  '#ffaa00', // Golden amber
  '#8800ff', // Deep violet
  '#ff4466', // Coral pink
  '#00aaff', // Sky blue
  '#ffff00', // Bright yellow
]

const NUM_SPECIES = SPECIES_COLORS.length

// Pre-parsed RGB values
const SPECIES_RGB: Array<{ r: number, g: number, b: number }> = SPECIES_COLORS.map((hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
}))

// Core fill style strings — pre-built to avoid string concat in hot loop
const CORE_FILL: string[] = SPECIES_RGB.map(
  ({ r, g, b }) => `rgba(${r},${g},${b},0.6)`,
)

// --- Offscreen glow sprite canvases (one per species) ---
const GLOW_SPRITE_SIZE = 12 // pixel diameter of glow sprite
const GLOW_SPRITE_HALF = GLOW_SPRITE_SIZE / 2

const glowSprites: OffscreenCanvas[] = []

function ensureGlowSprites(): void {
  if (glowSprites.length > 0) return

  for (let s = 0; s < NUM_SPECIES; s++) {
    const rgb = SPECIES_RGB[s]
    if (!rgb) continue

    const sprite = new OffscreenCanvas(GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE)
    const sctx = sprite.getContext('2d')
    if (!sctx) continue

    const gradient = sctx.createRadialGradient(
      GLOW_SPRITE_HALF, GLOW_SPRITE_HALF, 0,
      GLOW_SPRITE_HALF, GLOW_SPRITE_HALF, GLOW_SPRITE_HALF,
    )
    gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`)
    gradient.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},0.03)`)
    gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`)

    sctx.fillStyle = gradient
    sctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE)

    glowSprites.push(sprite)
  }
}

// --- Vignette gradient (cached) ---
let vignetteGradient: CanvasGradient | null = null
let lastVignetteWidth = 0
let lastVignetteHeight = 0

function getVignetteGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): CanvasGradient {
  if (
    vignetteGradient &&
    lastVignetteWidth === width &&
    lastVignetteHeight === height
  ) {
    return vignetteGradient
  }

  const cx = width / 2
  const cy = height / 2
  const outerRadius = Math.sqrt(cx * cx + cy * cy)

  const gradient = ctx.createRadialGradient(cx, cy, outerRadius * 0.35, cx, cy, outerRadius)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(0.7, 'rgba(0,0,0,0.12)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.55)')

  vignetteGradient = gradient
  lastVignetteWidth = width
  lastVignetteHeight = height

  return gradient
}

// --- Pre-allocated per-species index lists (avoid allocation per frame) ---
const speciesIndices: Int32Array[] = []
const speciesCounts: Int32Array = new Int32Array(NUM_SPECIES)
let speciesCapacity = 0

function ensureSpeciesIndices(particleCount: number): void {
  if (speciesCapacity >= particleCount) return
  speciesCapacity = particleCount
  speciesIndices.length = 0
  for (let s = 0; s < NUM_SPECIES; s++) {
    speciesIndices.push(new Int32Array(particleCount))
  }
}

// --- Trail fade ImageData (reused every frame) ---
function fadeTrails(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  // Semi-transparent black overlay creates trail fade (~3 frame persistence)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(0, 0, width, height)
}

// Edge margin for skipping glow on particles deep in vignette shadow
// Edge margin removed — sim is larger than viewport, all particles visible when zoomed out

const CORE_RADIUS = 1.5
const TWO_PI = Math.PI * 2

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  system: ParticleSystem,
  width: number,
  height: number,
): void {
  ensureGlowSprites()

  const { count, renderX, renderY, species } = system

  // --- Trail effect ---
  fadeTrails(ctx, width, height)

  // --- Sort particles by species (one pass, no allocation) ---
  ensureSpeciesIndices(count)
  speciesCounts.fill(0)

  for (let i = 0; i < count; i++) {
    const s = species[i]!
    const arr = speciesIndices[s]
    if (!arr) continue
    arr[speciesCounts[s]!] = i
    speciesCounts[s]!++
  }

  // --- Render glow layer (additive blending, offscreen sprites) ---
  // Draw glow for every 2nd particle — additive blending hides the gaps
  ctx.globalCompositeOperation = 'lighter'

  for (let s = 0; s < NUM_SPECIES; s++) {
    const sprite = glowSprites[s]
    if (!sprite) continue
    const arr = speciesIndices[s]
    if (!arr) continue
    const sCount = speciesCounts[s]!

    for (let ci = 0; ci < sCount; ci += 2) {
      const i = arr[ci]!
      const px = renderX[i]!
      const py = renderY[i]!

      ctx.drawImage(sprite, px - GLOW_SPRITE_HALF, py - GLOW_SPRITE_HALF)
    }
  }

  // --- Render core dots (batched by species) ---
  for (let s = 0; s < NUM_SPECIES; s++) {
    const fill = CORE_FILL[s]
    if (!fill) continue
    const arr = speciesIndices[s]
    if (!arr) continue
    const sCount = speciesCounts[s]!

    ctx.beginPath()
    for (let ci = 0; ci < sCount; ci++) {
      const i = arr[ci]!
      const px = renderX[i]!
      const py = renderY[i]!
      ctx.moveTo(px + CORE_RADIUS, py)
      ctx.arc(px, py, CORE_RADIUS, 0, TWO_PI)
    }
    ctx.fillStyle = fill
    ctx.fill()
  }

  // --- Vignette overlay ---
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = getVignetteGradient(ctx, width, height)
  ctx.fillRect(0, 0, width, height)
}
