/**
 * User Query Hook
 *
 * React Query hook for fetching user documents.
 * Uses fetchUser for the actual Firestore read/create.
 *
 * The user document contains:
 * - Budget IDs the user has access to
 * - Permission flags (is_admin, is_test)
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { fetchUser } from './fetchUser'

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

