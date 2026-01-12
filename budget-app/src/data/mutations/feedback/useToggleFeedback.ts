/**
 * Toggle Feedback Mutation
 *
 * Toggles the completion status of a feedback item.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { FlattenedFeedbackItem, FeedbackItem, FeedbackData } from '@data/queries/feedback'
import { readFeedbackForEdit, writeFeedbackData } from './writeFeedbackData'

// ============================================================================
// TYPES
// ============================================================================

interface ToggleFeedbackParams {
  item: FlattenedFeedbackItem
}

interface ToggleFeedbackResult {
  itemId: string
  isDone: boolean
  completedAt: string | null
}

interface MutationContext {
  previousData: FeedbackData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useToggleFeedback() {
  const queryClient = useQueryClient()

  const mutation = useMutation<ToggleFeedbackResult, Error, ToggleFeedbackParams, MutationContext>({
    onMutate: async (params) => {
      const { item } = params
      const queryKey = queryKeys.feedback()
      const newIsDone = !item.is_done
      const completedAt = newIsDone ? new Date().toISOString() : null

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<FeedbackData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<FeedbackData>(queryKey, {
          items: previousData.items.map((i) =>
            i.id === item.id
              ? { ...i, is_done: newIsDone, completed_at: completedAt }
              : i
          ),
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { item } = params
      const newIsDone = !item.is_done
      const completedAt = newIsDone ? new Date().toISOString() : null

      const freshData = await readFeedbackForEdit(item.doc_id, 'toggle feedback')

      // Track if we found and updated the item
      let itemFound = false
      const updatedItems = freshData.items.map((i: FeedbackItem) => {
        if (i.id === item.id) {
          itemFound = true
          return {
            ...i,
            is_done: newIsDone,
            completed_at: completedAt,
          }
        }
        return i
      })

      if (!itemFound) {
        console.error('[toggleFeedback] Item not found in document', {
          searchingFor: item.id,
          inDocument: item.doc_id,
          availableIds: freshData.items.map((i: FeedbackItem) => i.id),
        })
        throw new Error(`Feedback item not found in document. Item ID: ${item.id}, Doc ID: ${item.doc_id}`)
      }

      await writeFeedbackData({
        docId: item.doc_id,
        items: updatedItems,
        description: `marking feedback item as ${newIsDone ? 'done' : 'not done'}`,
      })

      return { itemId: item.id, isDone: newIsDone, completedAt }
    },

    onError: (_error, _params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  const toggleFeedback = {
    mutate: (params: ToggleFeedbackParams) => mutation.mutate(params),
    mutateAsync: (params: ToggleFeedbackParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { toggleFeedback }
}
