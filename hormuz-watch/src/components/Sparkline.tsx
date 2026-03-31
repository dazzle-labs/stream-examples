import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width: number
  height: number
  color?: string
  strokeWidth?: number
}

export function Sparkline({
  data,
  width,
  height,
  color = '#6366f1',
  strokeWidth = 1.5,
}: SparklineProps) {
  const { linePoints, areaPoints } = useMemo(() => {
    if (data.length < 2) return { linePoints: '', areaPoints: '' }

    const minimum = Math.min(...data)
    const maximum = Math.max(...data)
    const range = maximum - minimum || 1
    const padding = height * 0.1

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = padding + ((maximum - value) / range) * (height - padding * 2)
      return `${x},${y}`
    })

    const area = [
      `0,${height}`,
      ...points,
      `${width},${height}`,
    ].join(' ')

    return {
      linePoints: points.join(' '),
      areaPoints: area,
    }
  }, [data, width, height])

  if (data.length < 2) return null

  const gradientId = `sparkline-gradient-${width}-${height}-${color.replace('#', '')}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
