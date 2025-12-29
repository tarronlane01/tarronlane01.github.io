/**
 * Update Sort Order Mutation
 *
 * Updates the sort order of feedback items in a document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDocByPath, writeDocByPath } from '@firestore'
import { queryKeys } from '@data/queryClient'
import type { FeedbackItem, FeedbackData } from '@data/queries/feedback'
import type { FirestoreData } from '@types'

interface UpdateSortOrderParams {
  docId: string
  items: FeedbackItem[]
}

export function useUpdateSortOrder() {
  const queryClient = useQueryClient()

  const updateSortOrder = useMutation({
    mutationFn: async ({ docId, items }: UpdateSortOrderParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'feedback',
        docId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Feedback document not found')
      }

      await writeDocByPath(
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

  return { updateSortOrder }
}

