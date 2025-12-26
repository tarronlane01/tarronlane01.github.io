/**
 * Breakpoints for responsive design
 * Used throughout the app for CSS-in-JS and JavaScript-based responsive logic
 */
export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1200, // For complex multi-column layouts
} as const

/**
 * Default mobile breakpoint for the useIsMobile hook
 */
export const MOBILE_BREAKPOINT = BREAKPOINTS.mobile

