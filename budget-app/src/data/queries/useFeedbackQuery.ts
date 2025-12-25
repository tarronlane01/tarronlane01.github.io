/**
 * Feedback Query Hook
 *
 * Fetches all feedback items from the feedback collection.
 * Used by SettingsFeedback page.
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
 * Extract items from a document's items field, handling both normal arrays
 * and corrupted arrayUnion sentinels ({_methodName: "arrayUnion", vc: [...]})
 */
function extractItems(rawItems: unknown): FeedbackItem[] {
  // Normal case: items is an array
  if (Array.isArray(rawItems)) {
    return rawItems
  }

  // Corrupted case: items is a broken arrayUnion sentinel
  if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
    const obj = rawItems as Record<string, unknown>
    if (obj._methodName === 'arrayUnion' && Array.isArray(obj.vc)) {
      console.warn('[useFeedbackQuery] Found corrupted arrayUnion in feedback document - extracting items from vc')
      return obj.vc as FeedbackItem[]
    }
  }

  return []
}

/**
 * Fetch all feedback from the collection
 */
async function fetchAllFeedback(): Promise<FeedbackData> {
  const result = await queryCollection<{
    items?: FeedbackItem[] | { _methodName: string; vc: FeedbackItem[] }
    user_email?: string
  }>(
    'feedback',
    'admin loading all feedback (cache miss or stale)'
  )

  const flattened: FlattenedFeedbackItem[] = []

  for (const docSnap of result.docs) {
    // Extract items, handling both normal arrays and corrupted arrayUnion
    const items = extractItems(docSnap.data.items)
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
  })
}

