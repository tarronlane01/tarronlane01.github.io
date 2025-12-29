/**
 * Submit Feedback Mutation
 *
 * Submits new feedback from a user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDocByPath, writeDocByPath, arrayUnion } from '@firestore'
import { queryKeys } from '@data/queryClient'
import type { FlattenedFeedbackItem, FeedbackItem, FeedbackData } from '@data/queries/feedback'

type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

interface SubmitFeedbackParams {
  userId: string
  userEmail: string | null
  text: string
  feedbackType: FeedbackType
  currentPath: string
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient()

  const submitFeedback = useMutation({
    mutationFn: async ({ userId, userEmail, text, feedbackType, currentPath }: SubmitFeedbackParams) => {
      // Use email as doc ID if available, otherwise use uid
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

      const { exists } = await readDocByPath(
        'feedback',
        feedbackDocId,
        'checking if user has existing feedback document'
      )

      if (exists) {
        // Add to existing array
        await writeDocByPath(
          'feedback',
          feedbackDocId,
          {
            items: arrayUnion(newFeedbackItem),
            user_email: userEmail,
            updated_at: new Date().toISOString(),
          },
          'adding new feedback item to existing document',
          { merge: true }
        )
      } else {
        // Create new document
        await writeDocByPath(
          'feedback',
          feedbackDocId,
          {
            items: [newFeedbackItem],
            user_email: userEmail,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          'creating new feedback document for user'
        )
      }

      return { feedbackItem: newFeedbackItem, docId: feedbackDocId }
    },
    onMutate: async ({ userId, userEmail, text, feedbackType, currentPath }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedback() })
      const previousData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())

      // Create optimistic feedback item
      const feedbackDocId = userEmail || userId
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

      // Optimistically add to cache
      queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), (oldData) => {
        if (!oldData) {
          return { items: [optimisticItem] }
        }
        return { items: [...oldData.items, optimisticItem] }
      })

      return { previousData, optimisticItemId: optimisticItem.id }
    },
    onSuccess: (result, _variables, context) => {
      // Replace optimistic item with real item from server
      queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), (oldData) => {
        if (!oldData) return oldData
        return {
          items: oldData.items.map((item) =>
            item.id === context?.optimisticItemId
              ? { ...result.feedbackItem, doc_id: result.docId, user_email: _variables.userEmail }
              : item
          ),
        }
      })
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  return { submitFeedback }
}

