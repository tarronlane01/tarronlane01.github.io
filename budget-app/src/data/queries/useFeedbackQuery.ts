/**
 * Feedback Query Hook
 *
 * Fetches all feedback items from the feedback collection.
 * Used by AdminFeedback page.
 */

import { useQuery } from '@tanstack/react-query'
import { queryCollection } from '../firestore/operations'
import { queryKeys } from '../queryClient'

type FeedbackType = 'critical_bug' | 'bug' | 'new_feature' | 'core_feature' | 'qol'

export interface FeedbackItem {
  id: string
  text: string
  created_at: string
  is_done: boolean
  completed_at: string | null
  sort_order: number
  feedback_type?: FeedbackType
}

export interface FlattenedFeedbackItem extends FeedbackItem {
  doc_id: string // The document ID (user email or uid)
  user_email: string | null
}

export interface FeedbackData {
  items: FlattenedFeedbackItem[]
}

/**
 * Fetch all feedback from the collection
 */
async function fetchAllFeedback(): Promise<FeedbackData> {
  const result = await queryCollection<{
    items?: FeedbackItem[]
    user_email?: string
  }>('feedback')

  const flattened: FlattenedFeedbackItem[] = []

  for (const docSnap of result.docs) {
    const items = docSnap.data.items || []
    const userEmail = docSnap.data.user_email || docSnap.id

    items.forEach((item: FeedbackItem) => {
      flattened.push({
        ...item,
        doc_id: docSnap.id,
        user_email: userEmail,
      })
    })
  }

  return { items: flattened }
}

/**
 * Query hook for all feedback items
 * Only enabled for admin users
 *
 * @param options - Additional query options including enabled flag
 */
export function useFeedbackQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.feedback(),
    queryFn: fetchAllFeedback,
    enabled: options?.enabled !== false,
    staleTime: 60 * 1000, // 1 minute
  })
}

