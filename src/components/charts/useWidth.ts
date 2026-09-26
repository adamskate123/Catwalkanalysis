import { useEffect, useRef, useState, type RefObject } from 'react'

export function useWidth<T extends HTMLElement>(fallback = 600): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width
      if (cw > 0) setW(Math.floor(cw))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}
