/**
 * Budget context: initialization effect (auto-select first budget).
 */

import { useEffect } from 'react'
import { isSampleBudget } from '@data/constants'

interface UseBudgetContextInitArgs {
  current_user: { uid: string } | null
  isInitialized: boolean
  userQuery: { data: { budget_ids?: string[]; last_selected_budget_id?: string; permission_flags?: { is_admin?: boolean } } | null | undefined; isLoading: boolean; isError: boolean }
  accessibleBudgetsQuery: { data: { pendingInvites?: unknown[] } | null | undefined; isLoading: boolean }
  setSelectedBudgetId: (id: string | null) => void
  setNeedsFirstBudget: (v: boolean) => void
  setIsInitialized: (v: boolean) => void
}

export function useBudgetContextInit({
  current_user,
  isInitialized,
  userQuery,
  accessibleBudgetsQuery,
  setSelectedBudgetId,
  setNeedsFirstBudget,
  setIsInitialized,
}: UseBudgetContextInitArgs): void {
  useEffect(() => {
    if (!current_user) return
    if (isInitialized) return
    if (userQuery.isLoading) return

    const userData = userQuery.data
    if (!userData && !userQuery.isError) return

    const userIsAdmin = userData?.permission_flags?.is_admin === true
    const userBudgetIds = userData?.budget_ids || []
    const nonSampleBudgetIds = userIsAdmin
      ? userBudgetIds.filter((id: string) => !isSampleBudget(id))
      : userBudgetIds

    const lastSelected = userData?.last_selected_budget_id
    const lastSelectedIsValid =
      lastSelected &&
      (userBudgetIds.includes(lastSelected) || (userIsAdmin && isSampleBudget(lastSelected)))

    if (userBudgetIds.length > 0) {
      const initialId = lastSelectedIsValid ? lastSelected : userBudgetIds[0]
      setSelectedBudgetId(initialId)
      setNeedsFirstBudget(userIsAdmin && nonSampleBudgetIds.length === 0)
      setIsInitialized(true)
    } else {
      if (accessibleBudgetsQuery.isLoading) return
      const budgetsData = accessibleBudgetsQuery.data
      setNeedsFirstBudget(!(budgetsData?.pendingInvites && budgetsData.pendingInvites.length > 0))
      setIsInitialized(true)
    }
  }, [current_user, isInitialized, userQuery.data, userQuery.isLoading, userQuery.isError, accessibleBudgetsQuery.data, accessibleBudgetsQuery.isLoading, setSelectedBudgetId, setNeedsFirstBudget, setIsInitialized])
}
