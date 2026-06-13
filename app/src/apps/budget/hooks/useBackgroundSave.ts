/**
 * Background Save Hook
 *
 * Provides saveCurrentDocument for mutations to persist the currently viewed
 * document (month or budget) from cache to Firestore immediately.
 * Data is written on edit; there is no "queue and save on navigate" pattern.
 */

import { useCallback } from 'react'
import { bannerQueue } from '@components/ui'
import { writeMonthData } from '@budget/data/mutations/month/useWriteMonthData'
import { writeBudgetData } from '@budget/data/mutations/budget/writeBudgetData'
import { queryClient } from '@data/queryClient'
import { queryKeys } from '@budget/data/queryKeys'
import type { BudgetData } from '@budget/data/queries/budget'
import type { MonthQueryData } from '@budget/data/queries/month'

/**
 * Hook for immediate save of the current viewing document (month or budget).
 */
export function useBackgroundSave() {
  const saveMonth = useCallback(async (
    budgetId: string,
    year: number,
    month: number,
    context: string
  ): Promise<void> => {
    const monthKey = queryKeys.month(budgetId, year, month)
    const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)

    if (!monthQueryData?.month) {
      throw new Error(`Month ${year}/${month} not found in cache`)
    }

    await writeMonthData({
      budgetId,
      month: monthQueryData.month,
      description: `${context}: ${year}/${month}`,
      updateMonthMap: false,
    })
  }, [])

  const saveBudget = useCallback(async (budgetId: string, context: string): Promise<void> => {
    const budgetKey = queryKeys.budget(budgetId)
    const budgetData = queryClient.getQueryData<BudgetData>(budgetKey)

    if (!budgetData) {
      throw new Error(`Budget ${budgetId} not found in cache`)
    }

    const accountsWithoutBalances = Object.fromEntries(
      Object.entries(budgetData.accounts || {}).map(([id, acc]) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
        const { balance: _balance, ...accWithoutBalance } = acc as unknown as { balance?: number; [key: string]: unknown }
        return [id, accWithoutBalance]
      })
    )
    const categoriesWithoutBalances = Object.fromEntries(
      Object.entries(budgetData.categories || {}).map(([id, cat]) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
        const { balance: _balance, ...catWithoutBalance } = cat as unknown as { balance?: number; [key: string]: unknown }
        return [id, catWithoutBalance]
      })
    )

    await writeBudgetData({
      budgetId,
      updates: {
        name: budgetData.budget.name,
        user_ids: budgetData.budget.user_ids,
        accepted_user_ids: budgetData.budget.accepted_user_ids,
        owner_id: budgetData.budget.owner_id,
        owner_email: budgetData.budget.owner_email,
        accounts: accountsWithoutBalances,
        account_groups: budgetData.accountGroups,
        categories: categoriesWithoutBalances,
        category_groups: budgetData.categoryGroups,
        month_map: budgetData.budget.month_map,
      },
      description: `${context}: budget`,
    })
  }, [])

  /**
   * Save the currently viewing document (month or budget) from cache to Firestore.
   */
  const saveCurrentDocument = useCallback(async (
    budgetId: string,
    documentType: 'month' | 'budget',
    year?: number,
    month?: number
  ): Promise<void> => {
    try {
      if (documentType === 'month' && year !== undefined && month !== undefined) {
        await saveMonth(budgetId, year, month, 'immediate save (current viewing document)')
      } else if (documentType === 'budget') {
        await saveBudget(budgetId, 'immediate save (current viewing document)')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      bannerQueue.add({
        type: 'error',
        message: `Failed to save current document: ${errorMessage}`,
        autoDismissMs: 0,
      })
      throw error
    }
  }, [saveMonth, saveBudget])

  return {
    saveCurrentDocument,
  }
}
