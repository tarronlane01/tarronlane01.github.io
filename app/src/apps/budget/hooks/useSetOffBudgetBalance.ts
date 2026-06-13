/**
 * useSetOffBudgetBalance Hook
 *
 * Sets an off-budget account's total balance by creating or updating an
 * adjustment transaction (with NO_CATEGORY_ID) in the current month.
 * Also updates the account's off_budget_balance_month field on the budget doc.
 */

import { useCallback } from 'react'
import { useBudget } from '@budget/contexts'
import { useMonthData } from '@budget/hooks/useMonthData'
import { useAddAdjustment, useUpdateAdjustment } from '@budget/data/mutations/month'
import { NO_CATEGORY_ID } from '@budget/data/constants'
import { updateOffBudgetBalanceMonth } from '@budget/data/mutations/budget/writeBudgetData'
import { useBackgroundSave } from '@budget/hooks/useBackgroundSave'
import { getDefaultFormDate, getYearMonthOrdinal, roundCurrency } from '@utils'
import { bannerQueue } from '@components/ui'

export function useSetOffBudgetBalance() {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { adjustments, accountBalances } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)
  const { addAdjustment } = useAddAdjustment()
  const { updateAdjustment } = useUpdateAdjustment()
  const { saveCurrentDocument } = useBackgroundSave()

  const setBalance = useCallback(async (accountId: string, targetBalance: number) => {
    if (!selectedBudgetId) return

    const target = roundCurrency(targetBalance)

    // Find existing off-budget adjustment for this account (account_id match + NO_CATEGORY_ID)
    const existingAdj = adjustments.find(
      a => a.account_id === accountId && a.category_id === NO_CATEGORY_ID
    )

    // Get current end_balance for this account
    const accountBalance = accountBalances.find(ab => ab.account_id === accountId)
    const endBalance = accountBalance?.end_balance ?? 0

    let adjustmentAmount: number
    if (existingAdj) {
      // Compute what the balance would be without the existing adjustment
      const balanceWithoutAdj = roundCurrency(endBalance - existingAdj.amount)
      adjustmentAmount = roundCurrency(target - balanceWithoutAdj)
    } else {
      adjustmentAmount = roundCurrency(target - endBalance)
    }

    // No-op if the balance is already correct
    if (Math.abs(adjustmentAmount) < 0.005 && existingAdj) return
    if (Math.abs(adjustmentAmount) < 0.005 && !existingAdj) return

    const date = getDefaultFormDate(currentYear, currentMonthNumber)

    try {
      if (existingAdj) {
        await updateAdjustment(
          selectedBudgetId, currentYear, currentMonthNumber,
          existingAdj.id, adjustmentAmount, accountId, NO_CATEGORY_ID, date,
          existingAdj.payee, existingAdj.description, existingAdj.cleared
        )
      } else {
        await addAdjustment(
          selectedBudgetId, currentYear, currentMonthNumber,
          adjustmentAmount, accountId, NO_CATEGORY_ID, date
        )
      }

      // Persist the month to Firestore (adjustment mutations skip this when not viewing the month)
      await saveCurrentDocument(selectedBudgetId, 'month', currentYear, currentMonthNumber)

      // Update off_budget_balance_month (only if current >= stored value — no backdating)
      const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonthNumber)
      await updateOffBudgetBalanceMonth(
        selectedBudgetId, accountId, currentOrdinal,
        'Set off-budget balance'
      )
    } catch (error) {
      console.error('[useSetOffBudgetBalance] Failed:', error)
      bannerQueue.add({
        type: 'error',
        message: 'Failed to set balance. See console for details.',
        autoDismissMs: 0,
      })
    }
  }, [
    selectedBudgetId, currentYear, currentMonthNumber,
    adjustments, accountBalances,
    addAdjustment, updateAdjustment, saveCurrentDocument,
  ])

  return { setBalance }
}
