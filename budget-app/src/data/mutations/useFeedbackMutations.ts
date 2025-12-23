/**
 * Feedback Mutations Hook
 *
 * Provides mutation functions for feedback operations:
 * - Submitting new feedback
 * - Toggling feedback completion status
 * - Updating feedback sort order
 *
 * All mutations include automatic cache invalidation.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDoc, writeDoc, arrayUnion } from '../../utils/firestoreHelpers'
import { queryKeys } from '../queryClient'
import type { FlattenedFeedbackItem, FeedbackItem } from '../queries/useFeedbackQuery'

type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

interface SubmitFeedbackParams {
  userId: string
  userEmail: string | null
  text: string
  feedbackType: FeedbackType
  currentPath: string
}

interface ToggleFeedbackParams {
  item: FlattenedFeedbackItem
}

interface UpdateSortOrderParams {
  docId: string
  items: FeedbackItem[]
}

/**
 * Hook providing mutation functions for feedback operations
 */
export function useFeedbackMutations() {
  const queryClient = useQueryClient()

  /**
   * Submit new feedback
   */
  const submitFeedback = useMutation({
    mutationFn: async ({ userId, userEmail, text, feedbackType, currentPath }: SubmitFeedbackParams) => {
      // Use email as doc ID if available, otherwise use uid
      const feedbackDocId = userEmail || userId

      const newFeedbackItem: FeedbackItem = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: `[${feedbackType.toUpperCase()}] ${text}\n\n(Submitted from: ${currentPath})`,
        created_at: new Date().toISOString(),
        is_done: false,
        completed_at: null,
        sort_order: Date.now(),
        feedback_type: feedbackType,
      }

      const { exists } = await readDoc('feedback', feedbackDocId)

      if (exists) {
        // Add to existing array
        await writeDoc('feedback', feedbackDocId, {
          items: arrayUnion(newFeedbackItem),
          user_email: userEmail,
          updated_at: new Date().toISOString(),
        }, { merge: true })
      } else {
        // Create new document
        await writeDoc('feedback', feedbackDocId, {
          items: [newFeedbackItem],
          user_email: userEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      return { feedbackItem: newFeedbackItem }
    },
    onSuccess: () => {
      // Invalidate feedback query so admin page refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback() })
    },
  })

  /**
   * Toggle feedback completion status
   */
  const toggleFeedback = useMutation({
    mutationFn: async ({ item }: ToggleFeedbackParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('feedback', item.doc_id)

      if (!exists || !data) {
        throw new Error('Feedback document not found')
      }

      const items = data.items || []
      const updatedItems = items.map((i: FeedbackItem) => {
        if (i.id === item.id) {
          return {
            ...i,
            is_done: !i.is_done,
            completed_at: !i.is_done ? new Date().toISOString() : null,
          }
        }
        return i
      })

      await writeDoc('feedback', item.doc_id, {
        ...data,
        items: updatedItems,
        updated_at: new Date().toISOString(),
      })

      return { itemId: item.id, isDone: !item.is_done }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback() })
    },
  })

  /**
   * Update sort order of feedback items in a document
   */
  const updateSortOrder = useMutation({
    mutationFn: async ({ docId, items }: UpdateSortOrderParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('feedback', docId)

      if (!exists || !data) {
        throw new Error('Feedback document not found')
      }

      await writeDoc('feedback', docId, {
        ...data,
        items,
        updated_at: new Date().toISOString(),
      })

      return { docId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback() })
    },
  })

  return {
    submitFeedback,
    toggleFeedback,
    updateSortOrder,
  }
}

