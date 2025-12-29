/**
 * Accessible Budgets Query Hook
 *
 * React Query hook for fetching all budgets a user has access to.
 * Uses fetchAccessibleBudgets for the actual Firestore query.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { UserDocument } from '@types'
import { fetchAccessibleBudgets, type AccessibleBudgetsData } from './fetchAccessibleBudgets'

/**
 * Query hook for accessible budgets and pending invites.
 *
 * @param userId - The current user's ID
 * @param userData - The user document (for checking accepted budgets)
 * @param options - Additional query options
 */
export function useAccessibleBudgetsQuery(
  userId: string | null,
  userData: UserDocument | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: userId ? queryKeys.accessibleBudgets(userId) : ['accessibleBudgets', 'none'],
    queryFn: async (): Promise<AccessibleBudgetsData> => {
      if (!userId) {
        return { budgets: [], pendingInvites: [] }
      }
      return fetchAccessibleBudgets(userId, userData)
    },
    enabled: !!userId && (options?.enabled !== false),
    // Refetch when user data changes (e.g., after accepting an invite)
    staleTime: 60 * 1000, // 1 minute - budgets list can be slightly stale
  })
}

