/**
 * Navigation Hooks
 *
 * useNavigateWithSave wraps navigate(); there is no "save on navigate" pattern—
 * data is written immediately on edit.
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * No-op. Previously triggered save on route change; saves now happen immediately on edit.
 */
export function useNavigationSave() {
  // No-op: nothing to queue or save on navigation
}

/**
 * Navigate to a route. No save-before-navigate; edits are already persisted on change.
 */
export function useNavigateWithSave() {
  const navigate = useNavigate()
  return useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === 'string') {
        navigate(to, options)
      } else {
        navigate(to)
      }
    },
    [navigate]
  )
}
