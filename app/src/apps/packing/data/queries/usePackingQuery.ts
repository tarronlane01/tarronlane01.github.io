import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { subscribeToDoc, readDocByPath } from '@firestore'
import { packingQueryKeys } from '@packing/data/queryKeys'
import type { PackingDocument } from '@packing/data/types'

async function fetchPacking(): Promise<PackingDocument | null> {
  try {
    const { exists, data } = await readDocByPath<PackingDocument>(
      'packing', 'shared', 'initial packing fetch'
    )
    if (!exists || !data) return null
    return data
  } catch {
    // Permission error or doc doesn't exist — return null so the page can show setup
    return null
  }
}

/**
 * Real-time query hook for the packing document.
 * Sets up an onSnapshot listener that pipes updates into React Query cache.
 */
export function usePackingQuery() {
  const queryClient = useQueryClient()
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToDoc<PackingDocument>(
      'packing', 'shared', 'packing real-time listener',
      (data, exists) => {
        queryClient.setQueryData(
          packingQueryKeys.packing(),
          exists && data ? data : null
        )
      },
      (error) => {
        console.error('[usePackingQuery] Snapshot error:', error)
        // On permission error, set null so the page can show setup UI
        queryClient.setQueryData(packingQueryKeys.packing(), null)
      }
    )

    unsubscribeRef.current = unsubscribe
    return () => {
      unsubscribe()
      unsubscribeRef.current = null
    }
  }, [queryClient])

  return useQuery({
    queryKey: packingQueryKeys.packing(),
    queryFn: fetchPacking,
    staleTime: Infinity,
  })
}
