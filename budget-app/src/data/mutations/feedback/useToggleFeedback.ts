/**
 * Toggle Feedback Mutation
 *
 * Toggles the completion status of a feedback item.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDocByPath, writeDocByPath } from '@firestore'
import { queryKeys } from '@data/queryClient'
import type { FlattenedFeedbackItem, FeedbackItem, FeedbackData } from '@data/queries/feedback'
import type { FirestoreData } from '@types'

interface ToggleFeedbackParams {
  item: FlattenedFeedbackItem
}

export function useToggleFeedback() {
  const queryClient = useQueryClient()

  const toggleFeedback = useMutation({
    mutationFn: async ({ item }: ToggleFeedbackParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
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
        console.error('[toggleFeedback] Item not found in document', {
          searchingFor: item.id,
          inDocument: item.doc_id,
          availableIds: items.map((i: FeedbackItem) => i.id),
        })
        throw new Error(`Feedback item not found in document. Item ID: ${item.id}, Doc ID: ${item.doc_id}`)
      }

      await writeDocByPath(
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
      await queryClient.cancelQueries({ queryKey: queryKeys.feedback() })
      const previousData = queryClient.getQueryData<FeedbackData>(queryKeys.feedback())

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
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.feedback(), context.previousData)
      }
    },
  })

  return { toggleFeedback }
}

