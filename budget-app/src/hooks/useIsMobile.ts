import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 640

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

// Export breakpoint for CSS-in-JS consistency
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
}

