/**
 * Fetch Feedback
 *
 * Core function for fetching all feedback items from Firestore.
 * Used by the admin feedback management page.
 */

import { queryCollection } from '@firestore'

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
      console.warn('[fetchFeedback] Found corrupted arrayUnion in feedback document - extracting items from vc')
      return obj.vc as FeedbackItem[]
    }
  }

  return []
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Fetch all feedback from the collection.
 *
 * @returns Flattened feedback data with all items across all documents
 */
export async function fetchFeedback(): Promise<FeedbackData> {
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

