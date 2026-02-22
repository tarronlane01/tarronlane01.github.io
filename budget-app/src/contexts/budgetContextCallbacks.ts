/**
 * Budget context: loadAccessibleBudgets, switchToBudget, checkBudgetInvite.
 */

import { useCallback } from 'react'
import { fetchBudgetInviteStatus } from '@data'
import { writeUserData } from '@data/mutations/user'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetInvite } from '@types'

interface UseBudgetContextCallbacksArgs {
  selectedBudgetId: string | null
  current_user: { uid: string } | null
  accessibleBudgetsQuery: { data: unknown; refetch: () => Promise<unknown> }
  setInitialDataLoadComplete: (v: boolean) => void
  setInitialBalanceCalculationComplete: (v: boolean) => void
  setCurrentYear: (year: number) => void
  setCurrentMonthNumber: (month: number) => void
  setSelectedBudgetId: (id: string | null) => void
  setNeedsFirstBudget: (v: boolean) => void
}

export function useBudgetContextCallbacks({
  selectedBudgetId,
  current_user,
  accessibleBudgetsQuery,
  setInitialDataLoadComplete,
  setInitialBalanceCalculationComplete,
  setCurrentYear,
  setCurrentMonthNumber,
  setSelectedBudgetId,
  setNeedsFirstBudget,
}: UseBudgetContextCallbacksArgs): {
  loadAccessibleBudgets: (options?: { force?: boolean }) => Promise<void>
  switchToBudget: (budgetId: string) => void
  checkBudgetInvite: (budgetId: string) => Promise<BudgetInvite | null>
} {
  const loadAccessibleBudgets = useCallback(async (options?: { force?: boolean }) => {
    if (options?.force || !accessibleBudgetsQuery.data) {
      await accessibleBudgetsQuery.refetch()
    }
  }, [accessibleBudgetsQuery])

  const switchToBudget = useCallback((budgetId: string) => {
    if (selectedBudgetId && selectedBudgetId !== budgetId) {
      queryClient.removeQueries({ queryKey: queryKeys.budget(selectedBudgetId) })
      queryClient.removeQueries({ queryKey: ['month', selectedBudgetId] })
      queryClient.removeQueries({ queryKey: queryKeys.payees(selectedBudgetId) })
    }
    queryClient.removeQueries({ queryKey: ['initialDataLoad', budgetId] })
    queryClient.removeQueries({ queryKey: queryKeys.budget(budgetId) })
    queryClient.removeQueries({ queryKey: ['month', budgetId] })
    queryClient.removeQueries({ queryKey: queryKeys.payees(budgetId) })

    setInitialDataLoadComplete(false)
    setInitialBalanceCalculationComplete(false)
    const now = new Date()
    setCurrentYear(now.getFullYear())
    setCurrentMonthNumber(now.getMonth() + 1)
    setSelectedBudgetId(budgetId)
    setNeedsFirstBudget(false)

    if (current_user?.uid) {
      writeUserData({
        userId: current_user.uid,
        updates: { last_selected_budget_id: budgetId },
        description: 'save last selected budget for reload',
      }).catch(err => console.error('[BudgetContext] Failed to save last selected budget:', err))
    }
  }, [selectedBudgetId, current_user, setInitialDataLoadComplete, setInitialBalanceCalculationComplete, setCurrentYear, setCurrentMonthNumber, setSelectedBudgetId, setNeedsFirstBudget])

  const checkBudgetInvite = useCallback(async (budgetId: string): Promise<BudgetInvite | null> => {
    if (!current_user) return null
    try {
      const status = await fetchBudgetInviteStatus(budgetId, current_user.uid)
      if (!status) return null
      if (status.isInvited && !status.hasAccepted) {
        return {
          budgetId,
          budgetName: status.budgetName,
          ownerEmail: status.ownerEmail,
        }
      }
      return null
    } catch (error) {
      console.error('[BudgetContext] Error checking budget invite:', error)
      return null
    }
  }, [current_user])

  return { loadAccessibleBudgets, switchToBudget, checkBudgetInvite }
}
