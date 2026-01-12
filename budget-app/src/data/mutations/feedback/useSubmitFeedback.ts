/**
 * Submit Feedback Mutation
 *
 * Submits new feedback from a user.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
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

interface MutationContext {
  previousData: FeedbackData | undefined
  optimisticId: string
}

// ============================================================================
// HOOK
// ============================================================================

export function useSubmitFeedback() {
  const queryClient = useQueryClient()

  const mutation = useMutation<SubmitFeedbackResult, Error, SubmitFeedbackParams, MutationContext>({
    onMutate: async (params) => {
      const { userId, userEmail, text, feedbackType, currentPath } = params
      const feedbackDocId = userEmail || userId
      const queryKey = queryKeys.feedback()

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<FeedbackData>(queryKey)

      // Create optimistic feedback item
      const optimisticId = `feedback_optimistic_${Date.now()}`
      const optimisticItem: FlattenedFeedbackItem = {
        id: optimisticId,
        text: `${text}\n\n(Submitted from: ${currentPath})`,
        created_at: new Date().toISOString(),
        is_done: false,
        completed_at: null,
        sort_order: Date.now(),
        feedback_type: feedbackType,
        doc_id: feedbackDocId,
        user_email: userEmail,
      }

      // Optimistically update the cache
      // If no cached data exists, don't create a partial cache.
      // This prevents the floating feedback button from initializing the cache
      // with just one item, which would make the feedback page think it has
      // valid cached data when it's actually incomplete.
      if (previousData) {
        queryClient.setQueryData<FeedbackData>(queryKey, {
          items: [...previousData.items, optimisticItem],
        })
      }

      return { previousData, optimisticId }
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

    onSuccess: (result, params, context) => {
      // Replace optimistic item with real item from server
      if (!context?.optimisticId) return

      const currentData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())
      if (currentData) {
        queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), {
          items: currentData.items.map((item) =>
            item.id === context.optimisticId
              ? { ...result.feedbackItem, doc_id: result.docId, user_email: params.userEmail }
              : item
          ),
        })
      }
    },

    onError: (_error, _params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  const submitFeedback = {
    mutate: (params: SubmitFeedbackParams) => mutation.mutate(params),
    mutateAsync: (params: SubmitFeedbackParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { submitFeedback }
}
