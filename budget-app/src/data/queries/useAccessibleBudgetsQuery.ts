/**
 * Accessible Budgets Query Hook
 *
 * Fetches all budgets a user has access to (either as owner or invited).
 * Also identifies pending invites (budgets where user is invited but hasn't accepted).
 *
 * This replaces direct Firestore collection queries in the context.
 */

import { useQuery } from '@tanstack/react-query'
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'
import app from '../../firebase'
import { queryKeys } from '../queryClient'
import type { BudgetInvite, BudgetSummary, UserDocument } from '../../types/budget'

interface AccessibleBudgetsData {
  budgets: BudgetSummary[]
  pendingInvites: BudgetInvite[]
}

/**
 * Fetch all budgets where user is in user_ids array
 * Categorizes them into accessible budgets and pending invites
 */
async function fetchAccessibleBudgets(
  userId: string,
  userData: UserDocument | null
): Promise<AccessibleBudgetsData> {
  const db = getFirestore(app)
  const budgetsRef = collection(db, 'budgets')
  const q = query(budgetsRef, where('user_ids', 'array-contains', userId))
  const snapshot = await getDocs(q)

  const budgets: BudgetSummary[] = []
  const pendingInvites: BudgetInvite[] = []

  for (const budgetDoc of snapshot.docs) {
    const data = budgetDoc.data()
    const hasAccepted = data.accepted_user_ids?.includes(userId) ||
                        userData?.budget_ids?.includes(budgetDoc.id)

    if (hasAccepted) {
      // User has access to this budget
      budgets.push({
        id: budgetDoc.id,
        name: data.name || 'Unnamed Budget',
        ownerEmail: data.owner_email || null,
        isOwner: data.owner_id === userId,
        isPending: false,
      })
    } else {
      // User is invited but hasn't accepted
      pendingInvites.push({
        budgetId: budgetDoc.id,
        budgetName: data.name || 'Unnamed Budget',
        ownerEmail: data.owner_email || null,
      })
    }
  }

  return { budgets, pendingInvites }
}

/**
 * Query hook for accessible budgets and pending invites
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

