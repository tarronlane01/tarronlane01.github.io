/**
 * Navigation Save Hook
 *
 * Saves all changes when navigating to a new page.
 * The save is completely non-blocking - navigation happens immediately,
 * and the save runs in the background after the new page starts loading.
 * This ensures the new page can load without waiting for the save to complete.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useBackgroundSave } from './useBackgroundSave'
import { useSync } from '@contexts'

/**
 * Hook that saves all changes when navigating to a new page.
 * Should be used at the app level to intercept all navigation.
 */
export function useNavigationSave() {
  const location = useLocation()
  const { saveAllChanges } = useBackgroundSave()
  const { hasChanges } = useSync()
  const lastLocationRef = useRef<string | null>(null)

  useEffect(() => {
    const currentPath = location.pathname

    // Skip on initial mount
    if (lastLocationRef.current === null) {
      lastLocationRef.current = currentPath
      return
    }

    // Only save if we've actually navigated to a different page
    if (lastLocationRef.current !== currentPath && hasChanges()) {
      // Save all changes in the background (completely non-blocking)
      // Navigation has already happened at this point (useEffect runs after render)
      //
      // NOTE: We could use queueMicrotask here, but since we're already in a useEffect
      // (which runs after render), a regular async call would work fine too.
      // The key is that we're NOT awaiting it - it's fire-and-forget.
      //
      // queueMicrotask ensures the save runs after the current synchronous code
      // completes but before the next event loop cycle, giving maximum priority
      // while still being non-blocking. A plain async call would also work since
      // we're not awaiting it, but queueMicrotask is more explicit about timing.
      queueMicrotask(() => {
        // Fire-and-forget: don't await, let it run in background
        // The new page is already loading, so this won't block anything
        saveAllChanges('navigation save (page change)').catch(error => {
          console.error('[useNavigationSave] Failed to save on navigation:', error)
          // Error is already shown via banner in useBackgroundSave
        })
      })
    }

    lastLocationRef.current = currentPath
  }, [location.pathname, hasChanges, saveAllChanges])
}

// Re-export navigate with save wrapper
export function useNavigateWithSave() {
  const navigate = useNavigate()
  const { saveAllChanges } = useBackgroundSave()
  const { hasChanges } = useSync()

  return useCallback(
    async (to: string | number, options?: { replace?: boolean }) => {
      // Save changes before navigating
      if (hasChanges()) {
        try {
          await saveAllChanges('navigation save (programmatic navigation)')
        } catch (error) {
          console.error('[useNavigateWithSave] Failed to save before navigation:', error)
          // Continue with navigation even if save fails
        }
      }

      // Navigate
      if (typeof to === 'string') {
        navigate(to, options)
      } else {
        navigate(to)
      }
    },
    [navigate, saveAllChanges, hasChanges]
  )
}

