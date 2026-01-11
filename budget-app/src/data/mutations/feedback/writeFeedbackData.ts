/**
 * Feedback Write Operations
 *
 * Core infrastructure for writing feedback documents with proper cache updates.
 */

import type { FirestoreData } from '@types'
import type { FeedbackItem } from '@data/queries/feedback'
import { readDocByPath, writeDocByPath, arrayUnion } from '@firestore'

// ============================================================================
// TYPES
// ============================================================================

export interface WriteFeedbackParams {
  docId: string
  /** Updated items array */
  items: FeedbackItem[]
  /** Description for logging */
  description: string
}

interface FeedbackDocData {
  items: FeedbackItem[]
  user_email?: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================================
// READ UTILITY (USE SPARINGLY)
// ============================================================================

/**
 * Read feedback document for cases that REQUIRE current state.
 *
 * ⚠️ Use only when you need to modify items within the array.
 * For adding new items, use addFeedbackItem with arrayUnion instead.
 */
export async function readFeedbackForEdit(
  docId: string,
  description: string
): Promise<FeedbackDocData> {
  const { exists, data } = await readDocByPath<FirestoreData>(
    'feedback',
    docId,
    `VALIDATION-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error(`Feedback document not found: ${docId}`)
  }

  return {
    items: data.items || [],
    user_email: data.user_email,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ============================================================================
// WRITE UTILITIES (MERGE STRATEGY)
// ============================================================================

/**
 * Write feedback data to Firestore using merge strategy.
 *
 * IMPORTANT: Only writes the `items` array and `updated_at`.
 * Does NOT update cache - caller should handle cache updates
 * since feedback cache structure is different (flattened items).
 */
export async function writeFeedbackData(params: WriteFeedbackParams): Promise<void> {
  const { docId, items, description } = params

  // Use merge to only update items field (no read needed)
  await writeDocByPath(
    'feedback',
    docId,
    {
      items,
      updated_at: new Date().toISOString(),
    },
    description,
    { merge: true }
  )
}

/**
 * Add a new feedback item to a document (or create document if it doesn't exist).
 */
export async function addFeedbackItem(
  docId: string,
  item: FeedbackItem,
  userEmail: string | null,
  description: string
): Promise<void> {
  const { exists } = await readDocByPath<FirestoreData>(
    'feedback',
    docId,
    'checking if user has existing feedback document'
  )

  if (exists) {
    await writeDocByPath(
      'feedback',
      docId,
      {
        items: arrayUnion(item),
        user_email: userEmail,
        updated_at: new Date().toISOString(),
      },
      description,
      { merge: true }
    )
  } else {
    await writeDocByPath(
      'feedback',
      docId,
      {
        items: [item],
        user_email: userEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      description
    )
  }
}

