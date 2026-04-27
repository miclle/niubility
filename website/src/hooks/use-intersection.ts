import { useEffect, type RefObject } from 'react'

// useIntersection observes an element and calls `onIntersect` when it enters the viewport.
// Used for infinite scroll — attach the ref to a sentinel div at the bottom of the list.
export function useIntersection(ref: RefObject<HTMLElement | null>, onIntersect: () => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect()
        }
      },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, onIntersect])
}
