/**
 * Fetch Accessible Budgets
 *
 * Core function for fetching all budgets a user has access to.
 * Also identifies pending invites (budgets where user is invited but hasn't accepted).
 * For admin users, also includes the shared sample budget.
 */

import { queryCollection, readDocByPath } from '@firestore'
import type { BudgetInvite, BudgetSummary, UserDocument } from '@types'
import { SAMPLE_BUDGET_ID, SAMPLE_BUDGET_NAME } from '@data/constants'

// ============================================================================
// TYPES
// ============================================================================

export interface AccessibleBudgetsData {
  budgets: BudgetSummary[]
  pendingInvites: BudgetInvite[]
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Fetch all budgets where user is in user_ids array.
 * Categorizes them into accessible budgets and pending invites.
 * For admin users, also includes the shared sample budget.
 *
 * @param userId - The current user's ID
 * @param userData - The user document (for checking accepted budgets and admin status)
 * @returns Accessible budgets and pending invites
 */
export async function fetchAccessibleBudgets(
  userId: string,
  userData: UserDocument | null
): Promise<AccessibleBudgetsData> {
  const isAdmin = userData?.permission_flags?.is_admin === true

  const result = await queryCollection<{
    name?: string
    owner_email?: string
    owner_id?: string
    accepted_user_ids?: string[]
  }>(
    'budgets',
    'loading budgets user has access to (cache miss or stale)',
    [{ field: 'user_ids', op: 'array-contains', value: userId }]
  )

  const budgets: BudgetSummary[] = []
  const pendingInvites: BudgetInvite[] = []

  for (const budgetDoc of result.docs) {
    const data = budgetDoc.data
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

  // For admin users, also include the sample budget if it exists
  if (isAdmin) {
    // Check if sample budget already in list (shouldn't be, but just in case)
    const hasSampleBudget = budgets.some(b => b.id === SAMPLE_BUDGET_ID)
    if (!hasSampleBudget) {
      try {
        const sampleBudgetResult = await readDocByPath<{ name?: string }>(
          'budgets',
          SAMPLE_BUDGET_ID,
          'loading sample budget for admin'
        )
        if (sampleBudgetResult.exists && sampleBudgetResult.data) {
          budgets.push({
            id: SAMPLE_BUDGET_ID,
            name: sampleBudgetResult.data.name || SAMPLE_BUDGET_NAME,
            ownerEmail: null,
            isOwner: false, // System-owned
            isPending: false,
            isSampleBudget: true, // Mark as sample budget
          })
        }
      } catch {
        // Sample budget doesn't exist yet - that's fine, admins can upload it
      }
    }
  }

  return { budgets, pendingInvites }
}

