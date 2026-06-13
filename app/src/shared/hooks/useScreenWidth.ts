/**
 * useScreenWidth Hook
 *
 * Detects screen width and provides breakpoint flags for responsive layouts.
 */

import { useState, useEffect } from 'react'
import { BREAKPOINTS } from '@constants'

export function useScreenWidth() {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return 1200
    return window.innerWidth
  })

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    width,
    isWide: width >= BREAKPOINTS.wide,
    isMedium: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.wide,
    isNarrowMedium: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isMobile: width < BREAKPOINTS.mobile,
  }
}

