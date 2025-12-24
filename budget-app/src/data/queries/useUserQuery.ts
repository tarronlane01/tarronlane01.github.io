/**
 * User Query Hook
 *
 * Fetches the user document containing:
 * - Budget IDs the user has access to
 * - Permission flags (is_admin, is_test)
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import { readDoc, writeDoc } from '../firestore/operations'
import type { UserDocument } from '../../types/budget'

/**
 * Fetch or create user document from Firestore
 */
async function fetchUser(userId: string, email: string | null): Promise<UserDocument> {
  const { exists, data } = await readDoc<UserDocument>('users', userId)

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

  await writeDoc('users', userId, newUserDoc)
  return newUserDoc
}

/**
 * Query hook for user document
 *
 * @param userId - The user's Firebase UID
 * @param email - The user's email (for creating new documents)
 * @param options - Additional query options
 */
export function useUserQuery(
  userId: string | null,
  email: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userId ? queryKeys.user(userId) : ['user', 'none'],
    queryFn: () => fetchUser(userId!, email),
    enabled: !!userId && (options?.enabled !== false),
  })
}

