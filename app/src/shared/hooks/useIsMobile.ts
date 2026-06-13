import { useState, useEffect } from 'react'
import { MOBILE_BREAKPOINT, BREAKPOINTS } from '@constants'

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    // Use matchMedia for reliable detection (works with Chrome DevTools device emulation)
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      setIsMobile(e.matches)
    }

    // Set initial value
    handleChange(mediaQuery)

    // Modern browsers use addEventListener
    mediaQuery.addEventListener('change', handleChange)

    // Also listen to resize as a fallback
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      window.removeEventListener('resize', handleResize)
    }
  }, [breakpoint])

  return isMobile
}

// Re-export breakpoints for backwards compatibility
export { BREAKPOINTS }

