import { useEffect, useRef, useState } from 'react'

interface ContainerSize {
  width: number
  height: number
}

export function useContainerSize(): [React.RefObject<HTMLDivElement | null>, ContainerSize] {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => {
        if (prev.width === Math.round(width) && prev.height === Math.round(height)) return prev
        return { width: Math.round(width), height: Math.round(height) }
      })
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [containerRef, size]
}
