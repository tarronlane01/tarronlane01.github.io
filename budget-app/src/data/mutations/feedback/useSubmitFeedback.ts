/**
 * Submit Feedback Mutation
 *
 * Submits new feedback from a user.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../infrastructure'
import { queryKeys, queryClient } from '@data/queryClient'
import type { FlattenedFeedbackItem, FeedbackItem, FeedbackData } from '@data/queries/feedback'
import { addFeedbackItem } from './writeFeedbackData'

// ============================================================================
// TYPES
// ============================================================================

type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

interface SubmitFeedbackParams {
  userId: string
  userEmail: string | null
  text: string
  feedbackType: FeedbackType
  currentPath: string
}

interface SubmitFeedbackResult {
  feedbackItem: FeedbackItem
  docId: string
}

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useSubmitFeedbackInternal = createOptimisticMutation<
  SubmitFeedbackParams,
  SubmitFeedbackResult,
  FeedbackData
>({
  optimisticUpdate: (params) => {
    const { userId, userEmail, text, feedbackType, currentPath } = params
    const feedbackDocId = userEmail || userId

    // Create optimistic feedback item
    const optimisticItem: FlattenedFeedbackItem = {
      id: `feedback_optimistic_${Date.now()}`,
      text: `${text}\n\n(Submitted from: ${currentPath})`,
      created_at: new Date().toISOString(),
      is_done: false,
      completed_at: null,
      sort_order: Date.now(),
      feedback_type: feedbackType,
      doc_id: feedbackDocId,
      user_email: userEmail,
    }

    // Store the optimistic item ID on params for later use
    ;(params as SubmitFeedbackParams & { _optimisticId: string })._optimisticId = optimisticItem.id

    return {
      cacheKey: queryKeys.feedback(),
      transform: (cachedData) => {
        // If no cached data exists, don't create a partial cache.
        // This prevents the floating feedback button from initializing the cache
        // with just one item, which would make the feedback page think it has
        // valid cached data when it's actually incomplete.
        if (!cachedData) {
          return cachedData as unknown as FeedbackData
        }

        return {
          items: [...cachedData.items, optimisticItem],
        }
      },
    }
  },

  mutationFn: async (params) => {
    const { userId, userEmail, text, feedbackType, currentPath } = params
    const feedbackDocId = userEmail || userId

    const newFeedbackItem: FeedbackItem = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: `${text}\n\n(Submitted from: ${currentPath})`,
      created_at: new Date().toISOString(),
      is_done: false,
      completed_at: null,
      sort_order: Date.now(),
      feedback_type: feedbackType,
    }

    await addFeedbackItem(
      feedbackDocId,
      newFeedbackItem,
      userEmail,
      'submitting new feedback'
    )

    return { feedbackItem: newFeedbackItem, docId: feedbackDocId }
  },

  onSuccess: (result, params) => {
    // Replace optimistic item with real item from server
    const optimisticId = (params as SubmitFeedbackParams & { _optimisticId?: string })._optimisticId
    if (!optimisticId) return

    // The factory already updated the cache with the result via transform,
    // but we need to replace the optimistic item ID with the real one
    const currentData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())
    if (currentData) {
      queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), {
        items: currentData.items.map((item) =>
          item.id === optimisticId
            ? { ...result.feedbackItem, doc_id: result.docId, user_email: params.userEmail }
            : item
        ),
      })
    }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useSubmitFeedback() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useSubmitFeedbackInternal()

  const submitFeedback = {
    mutate: (params: SubmitFeedbackParams) => mutate(params),
    mutateAsync: (params: SubmitFeedbackParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { submitFeedback }
}
