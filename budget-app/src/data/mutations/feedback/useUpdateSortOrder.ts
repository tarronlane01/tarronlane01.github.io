/**
 * Update Sort Order Mutation
 *
 * Updates the sort order of feedback items in a document.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys } from '@data/queryClient'
import type { FeedbackItem, FeedbackData } from '@data/queries/feedback'
import { writeFeedbackData } from './writeFeedbackData'

// ============================================================================
// TYPES
// ============================================================================

interface UpdateSortOrderParams {
  docId: string
  items: FeedbackItem[]
}

interface UpdateSortOrderResult {
  docId: string
  items: FeedbackItem[]
}

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateSortOrderInternal = createOptimisticMutation<
  UpdateSortOrderParams,
  UpdateSortOrderResult,
  FeedbackData
>({
  optimisticUpdate: (params) => {
    const { docId, items } = params

    // Build a map of new sort orders from the items array
    const sortOrderMap = new Map<string, number>()
    items.forEach((item) => {
      sortOrderMap.set(item.id, item.sort_order)
    })

    return {
      cacheKey: queryKeys.feedback(),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as FeedbackData
        }

        // Update sort orders for items in this document
        return {
          items: cachedData.items.map((item) => {
            if (item.doc_id === docId && sortOrderMap.has(item.id)) {
              return { ...item, sort_order: sortOrderMap.get(item.id)! }
            }
            return item
          }),
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { docId, items } = params

    await writeFeedbackData({
      docId,
      items,
      description: 'saving reordered feedback items',
    })

    return { docId, items }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateSortOrder() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateSortOrderInternal()

  const updateSortOrder = {
    mutate: (params: UpdateSortOrderParams) => mutate(params),
    mutateAsync: (params: UpdateSortOrderParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateSortOrder }
}
