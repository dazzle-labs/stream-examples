import type { CSSProperties } from 'react'

type BreathingGlowProps = {
  accent: string,
}

export function BreathingGlow({ accent }: BreathingGlowProps) {
  const style: CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
    background: `radial-gradient(ellipse at 25% 55%, ${accent}12 0%, transparent 55%)`,
    animation: 'breathe 8s ease-in-out infinite',
    transition: 'background 2s ease',
  }

  return <div style={style} />
}
