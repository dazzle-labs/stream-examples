// Canvas2D heatmap renderer — plots all recent meteors as accumulated glow dots

import { ortho, R, CX, CY } from './globe'
import type { MeteorPoint } from './types'

function velocityColor(v: number): readonly [number, number, number] {
  if (v < 15) return [96, 165, 250]     // cool blue
  if (v < 30) return [34, 211, 238]     // cyan
  if (v < 50) return [232, 228, 223]    // white
  return [249, 115, 22]                  // hot orange
}

function magnitudeRadius(mag: number): number {
  // mag: -6 (very bright) to +7 (faint). Lower = brighter = bigger dot.
  return Math.max(2, Math.min(10, 7 - mag * 0.6))
}

export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  points: readonly MeteorPoint[],
  cLon: number,
): void {
  ctx.save()

  // Clip to globe circle
  ctx.beginPath()
  ctx.arc(CX, CY, R - 2, 0, Math.PI * 2)
  ctx.clip()

  // Screen blending — saturates more gracefully than additive at high density
  ctx.globalCompositeOperation = 'screen'

  for (const point of points) {
    const [px, py, visible, cosC] = ortho(point.lat, point.lon, cLon)
    if (!visible) continue

    // Horizon fade
    let opacity = 0.7
    if (cosC < 0.3) {
      opacity *= cosC / 0.3
    }
    if (opacity <= 0) continue

    const [cr, cg, cb] = velocityColor(point.velocity)
    const radius = magnitudeRadius(point.magnitude)

    // Soft glow
    const glow = ctx.createRadialGradient(px, py, 0, px, py, radius)
    glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.06 * opacity})`)
    glow.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, ${0.02 * opacity})`)
    glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)

    ctx.fillStyle = glow
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2)

    // Crisp core dot
    const core = ctx.createRadialGradient(px, py, 0, px, py, 1.2)
    core.addColorStop(0, `rgba(255, 255, 255, ${0.2 * opacity})`)
    core.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)

    ctx.fillStyle = core
    ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4)
  }

  ctx.restore()
}
