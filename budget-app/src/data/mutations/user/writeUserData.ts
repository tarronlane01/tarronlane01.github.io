/**
 * User Write Operations
 *
 * Core infrastructure for writing user documents with proper cache updates.
 * This is the ONLY allowed way to write user documents in mutation files.
 *
 * PATTERN: Uses Firebase merge strategy to write ONLY the fields being updated.
 * This avoids pre-write reads and prevents overwriting unrelated fields.
 */

import type { UserDocument, FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'

// ============================================================================
// TYPES
// ============================================================================

export interface WriteUserParams {
  userId: string
  /** Partial user data - ONLY include fields you want to update */
  updates: Partial<UserDocument>
  /** Description for logging */
  description: string
}

// ============================================================================
// READ UTILITY (USE SPARINGLY)
// ============================================================================

/**
 * Read user document for cases that REQUIRE current state.
 *
 * ⚠️ AVOID when possible! Use this ONLY when you need to:
 * - Perform computations based on current values (e.g., reorder budget_ids)
 *
 * For simple updates, use writeUserData with merge strategy instead.
 * For array additions, use arrayUnion. For removals, use arrayRemove.
 */
export async function readUserForEdit(
  userId: string,
  description: string
): Promise<UserDocument> {
  const { exists, data } = await readDocByPath<UserDocument>(
    'users',
    userId,
    `VALIDATION-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error('User document not found')
  }

  return data
}

// ============================================================================
// WRITE UTILITY (MERGE STRATEGY)
// ============================================================================

/**
 * Write user data to Firestore using merge strategy.
 *
 * IMPORTANT: Only pass the fields you want to update in `updates`.
 * This uses Firebase's merge option to avoid overwriting other fields.
 * No pre-write read is needed.
 *
 * For array operations (like adding to budget_ids), use arrayUnion from @firestore.
 *
 * @example
 * // Good: Only updating email
 * await writeUserData({ userId, updates: { email: 'new@email.com' }, description: '...' })
 *
 * // For arrays, use arrayUnion:
 * import { arrayUnion } from '@firestore'
 * await writeUserData({ userId, updates: { budget_ids: arrayUnion(newBudgetId) }, description: '...' })
 */
export async function writeUserData(params: WriteUserParams): Promise<void> {
  const { userId, updates, description } = params

  // Add timestamp to updates
  const dataToWrite: FirestoreData = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  // Write with merge: true - only updates specified fields, doesn't overwrite others
  await writeDocByPath('users', userId, dataToWrite, description, { merge: true })

  // Update cache after successful write (merge with existing cached data)
  const cachedUser = queryClient.getQueryData<UserDocument>(queryKeys.user(userId))
  if (cachedUser) {
    queryClient.setQueryData<UserDocument>(queryKeys.user(userId), {
      ...cachedUser,
      ...updates,
      updated_at: dataToWrite.updated_at as string,
    })
  }
}

