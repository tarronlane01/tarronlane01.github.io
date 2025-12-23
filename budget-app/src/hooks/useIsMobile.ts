import { useState, useEffect } from 'react'
import { MOBILE_BREAKPOINT, BREAKPOINTS } from '@constants'

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint)
    }

    window.addEventListener('resize', handleResize)
    // Check on mount in case SSR value differs
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

// Re-export breakpoints for backwards compatibility
export { BREAKPOINTS }

