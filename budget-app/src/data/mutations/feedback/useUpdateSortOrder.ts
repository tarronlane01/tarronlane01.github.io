/**
 * Update Sort Order Mutation
 *
 * Updates the sort order of feedback items in a document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
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

interface MutationContext {
  previousData: FeedbackData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateSortOrder() {
  const queryClient = useQueryClient()

  const mutation = useMutation<UpdateSortOrderResult, Error, UpdateSortOrderParams, MutationContext>({
    onMutate: async (params) => {
      const { docId, items } = params
      const queryKey = queryKeys.feedback()

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<FeedbackData>(queryKey)

      // Build a map of new sort orders from the items array
      const sortOrderMap = new Map<string, number>()
      items.forEach((item) => {
        sortOrderMap.set(item.id, item.sort_order)
      })

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<FeedbackData>(queryKey, {
          items: previousData.items.map((item) => {
            if (item.doc_id === docId && sortOrderMap.has(item.id)) {
              return { ...item, sort_order: sortOrderMap.get(item.id)! }
            }
            return item
          }),
        })
      }

      return { previousData }
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

    onError: (_error, _params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  const updateSortOrder = {
    mutate: (params: UpdateSortOrderParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateSortOrderParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateSortOrder }
}
