import type { VRM } from '@pixiv/three-vrm'

const BLINK_DURATION = 0.2
const DOUBLE_BLINK_CHANCE = 0.15
const DOUBLE_BLINK_DELAY = 0.2

let blinkTimer = 0
let openDuration = randomOpenDuration()
let isBlink = false
let blinkElapsed = 0
let pendingDoubleBlink = false

function randomOpenDuration(): number {
  return 2 + Math.random() * 4
}

export function update(vrm: VRM, deltaSeconds: number): void {
  if (isBlink) {
    blinkElapsed += deltaSeconds
    const progress = Math.min(blinkElapsed / BLINK_DURATION, 1)
    // Sine curve for smooth eyelid movement
    const weight = Math.sin(Math.PI * progress)
    vrm.expressionManager?.setValue('blink', weight)

    if (progress >= 1) {
      isBlink = false
      blinkTimer = 0
      vrm.expressionManager?.setValue('blink', 0)

      if (pendingDoubleBlink) {
        pendingDoubleBlink = false
        openDuration = DOUBLE_BLINK_DELAY
      } else if (Math.random() < DOUBLE_BLINK_CHANCE) {
        pendingDoubleBlink = true
        openDuration = DOUBLE_BLINK_DELAY
      } else {
        openDuration = randomOpenDuration()
      }
    }
  } else {
    blinkTimer += deltaSeconds
    vrm.expressionManager?.setValue('blink', 0)

    if (blinkTimer >= openDuration) {
      isBlink = true
      blinkElapsed = 0
    }
  }
}
