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
import { readDoc, writeDoc, arrayUnion, type FirestoreData } from '../firestore/operations'
import { queryKeys } from '../queryClient'
import type { FlattenedFeedbackItem, FeedbackItem, FeedbackData } from '../queries/useFeedbackQuery'

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
   * Uses optimistic updates for instant UI feedback
   *
   * Note: The optimistic item in cache may have a different ID than the final item
   * stored in Firestore. This is acceptable since both are valid unique IDs, and
   * the cache will be reconciled on the next full refresh if needed.
   */
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

      const { exists } = await readDoc(
        'feedback',
        feedbackDocId,
        'checking if user has existing feedback document'
      )

      if (exists) {
        // Add to existing array
        await writeDoc(
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
        await writeDoc(
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

  /**
   * Toggle feedback completion status
   * Uses optimistic updates for instant UI feedback
   */
  const toggleFeedback = useMutation({
    mutationFn: async ({ item }: ToggleFeedbackParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
        'feedback',
        item.doc_id,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error(`Feedback document not found: ${item.doc_id}`)
      }

      const newIsDone = !item.is_done
      const completedAt = newIsDone ? new Date().toISOString() : null

      const items = data.items || []

      // Track if we found and updated the item
      let itemFound = false
      const updatedItems = items.map((i: FeedbackItem) => {
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
        // Log for debugging - helps identify doc_id mismatches
        console.error('[toggleFeedback] Item not found in document', {
          searchingFor: item.id,
          inDocument: item.doc_id,
          availableIds: items.map((i: FeedbackItem) => i.id),
        })
        throw new Error(`Feedback item not found in document. Item ID: ${item.id}, Doc ID: ${item.doc_id}`)
      }

      await writeDoc(
        'feedback',
        item.doc_id,
        {
          ...data,
          items: updatedItems,
          updated_at: new Date().toISOString(),
        },
        `marking feedback item as ${newIsDone ? 'done' : 'not done'}`
      )

      return { itemId: item.id, isDone: newIsDone, completedAt }
    },
    onMutate: async ({ item }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.feedback() })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())

      // Optimistically update cache immediately
      const newIsDone = !item.is_done
      const completedAt = newIsDone ? new Date().toISOString() : null

      queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), (oldData) => {
        if (!oldData) return oldData
        return {
          items: oldData.items.map((i) =>
            i.id === item.id
              ? { ...i, is_done: newIsDone, completed_at: completedAt }
              : i
          ),
        }
      })

      return { previousData }
    },
    onError: (_err, _variables, context) => {
      // Roll back to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  /**
   * Update sort order of feedback items in a document
   * Uses optimistic updates for instant UI feedback
   */
  const updateSortOrder = useMutation({
    mutationFn: async ({ docId, items }: UpdateSortOrderParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
        'feedback',
        docId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Feedback document not found')
      }

      await writeDoc(
        'feedback',
        docId,
        {
          ...data,
          items,
          updated_at: new Date().toISOString(),
        },
        'saving reordered feedback items'
      )

      return { docId, items }
    },
    onMutate: async ({ docId, items }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedback() })
      const previousData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())

      // Optimistically update the sort order in cache
      queryClient.setQueryData<FeedbackData>(queryKeys.feedback(), (oldData) => {
        if (!oldData) return oldData

        // Build a map of new sort orders from the items array
        const sortOrderMap = new Map<string, number>()
        items.forEach((item) => {
          sortOrderMap.set(item.id, item.sort_order)
        })

        // Update sort orders for items in this document
        return {
          items: oldData.items.map((item) => {
            if (item.doc_id === docId && sortOrderMap.has(item.id)) {
              return { ...item, sort_order: sortOrderMap.get(item.id)! }
            }
            return item
          }),
        }
      })

      return { previousData }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  return {
    submitFeedback,
    toggleFeedback,
    updateSortOrder,
  }
}

