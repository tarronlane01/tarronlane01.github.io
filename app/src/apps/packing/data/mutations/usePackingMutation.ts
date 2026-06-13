import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bannerQueue } from '@components/ui'
import { packingQueryKeys } from '@packing/data/queryKeys'
import { writePackingData } from './writePackingData'
import type { PackingDocument } from '@packing/data/types'
import type { FirestoreData } from '@firestore'

interface PackingMutationParams {
  /** Dot-notation field path updates for Firestore */
  updates: FirestoreData
  /** Description for logging */
  description: string
  /** Optimistic update function applied to the cached document */
  optimisticUpdate?: (prev: PackingDocument) => PackingDocument
}

interface MutationContext {
  previousData: PackingDocument | null | undefined
}

/**
 * Generic mutation hook for packing document writes.
 * Applies optimistic updates, writes to Firestore, and rolls back on error.
 * The onSnapshot listener will overwrite with server state after success.
 */
export function usePackingMutation() {
  const queryClient = useQueryClient()
  const queryKey = packingQueryKeys.packing()

  return useMutation<void, Error, PackingMutationParams, MutationContext>({
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<PackingDocument | null>(queryKey)

      if (params.optimisticUpdate && previousData) {
        queryClient.setQueryData<PackingDocument | null>(
          queryKey,
          params.optimisticUpdate(previousData)
        )
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      await writePackingData({
        updates: params.updates,
        description: params.description,
      })
    },

    onError: (_error, _params, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
      bannerQueue.add({
        type: 'error',
        message: 'Failed to save. Please try again.',
      })
    },
  })
}
