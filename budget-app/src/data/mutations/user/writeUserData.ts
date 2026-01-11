/**
 * User Write Operations
 *
 * Core infrastructure for writing user documents with proper cache updates.
 * This is the ONLY allowed way to write user documents in mutation files.
 */

import type { UserDocument } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'

// ============================================================================
// TYPES
// ============================================================================

export interface WriteUserParams {
  userId: string
  /** Partial user data to merge with existing document */
  updates: Partial<UserDocument>
  /** Description for logging */
  description: string
}

// ============================================================================
// READ UTILITY
// ============================================================================

/**
 * Read user document for editing.
 * Returns fresh data from Firestore (not cache).
 */
export async function readUserForEdit(
  userId: string,
  description: string
): Promise<UserDocument> {
  const { exists, data } = await readDocByPath<UserDocument>(
    'users',
    userId,
    `PRE-EDIT-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error('User document not found')
  }

  return data
}

// ============================================================================
// WRITE UTILITY
// ============================================================================

/**
 * Write user data to Firestore and update cache.
 */
export async function writeUserData(params: WriteUserParams): Promise<void> {
  const { userId, updates, description } = params

  // Read fresh data, merge updates, write back
  const freshData = await readUserForEdit(userId, description)

  const updatedData: UserDocument = {
    ...freshData,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  await writeDocByPath('users', userId, updatedData, description)

  // Update cache after successful write
  queryClient.setQueryData<UserDocument>(queryKeys.user(userId), updatedData)
}

