import type { CSSProperties } from 'react'

type VignetteProps = {
  accent: string,
  intensity: number,
}

export function Vignette({ accent, intensity }: VignetteProps) {
  const style: CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 8,
    boxShadow: `inset 0 0 ${150 * intensity}px ${40 * intensity}px rgba(0,0,0,${0.3 + intensity * 0.3}), inset 0 0 ${200 * intensity}px ${80 * intensity}px ${accent}15`,
    transition: 'box-shadow 2s ease',
  }

  return <div style={style} />
}
