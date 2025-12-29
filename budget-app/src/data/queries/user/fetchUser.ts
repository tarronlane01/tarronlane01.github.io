/**
 * Fetch User
 *
 * Core function for fetching (or creating) user documents from Firestore.
 */

import { readDocByPath, writeDocByPath } from '@firestore'
import type { UserDocument } from '@types'

/**
 * Fetch or create user document from Firestore.
 * If the user doesn't exist, creates a new document.
 *
 * @param userId - The user's Firebase UID
 * @param email - The user's email (for creating new documents)
 * @returns The user document
 */
export async function fetchUser(userId: string, email: string | null): Promise<UserDocument> {
  const { exists, data } = await readDocByPath<UserDocument>(
    'users',
    userId,
    'loading user profile (cache miss or stale)'
  )

  if (exists && data) {
    return data
  }

  // Create new user document
  const newUserDoc: UserDocument = {
    uid: userId,
    email,
    budget_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await writeDocByPath(
    'users',
    userId,
    newUserDoc,
    'creating new user document (first login)'
  )
  return newUserDoc
}

