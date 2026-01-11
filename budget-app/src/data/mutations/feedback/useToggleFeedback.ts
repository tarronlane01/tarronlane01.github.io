/**
 * Toggle Feedback Mutation
 *
 * Toggles the completion status of a feedback item.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../infrastructure'
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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useToggleFeedbackInternal = createOptimisticMutation<
  ToggleFeedbackParams,
  ToggleFeedbackResult,
  FeedbackData
>({
  optimisticUpdate: (params) => {
    const { item } = params
    const newIsDone = !item.is_done
    const completedAt = newIsDone ? new Date().toISOString() : null

    return {
      cacheKey: queryKeys.feedback(),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as FeedbackData
        }

        return {
          items: cachedData.items.map((i) =>
            i.id === item.id
              ? { ...i, is_done: newIsDone, completed_at: completedAt }
              : i
          ),
        }
      },
    }
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
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useToggleFeedback() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useToggleFeedbackInternal()

  const toggleFeedback = {
    mutate: (params: ToggleFeedbackParams) => mutate(params),
    mutateAsync: (params: ToggleFeedbackParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { toggleFeedback }
}
