/**
 * Background Save Hook
 *
 * Handles saving modified documents to Firestore in the background.
 * - Saves current viewing document immediately
 * - Saves all modified documents on navigation or every 5 minutes
 */

import { useCallback, useRef, useEffect } from 'react'
import { useSync } from '@contexts'
import { bannerQueue } from '@components/ui/Banner'
import { writeMonthData } from '@data/mutations/month/useWriteMonthData'
import { writeBudgetData } from '@data/mutations/budget/writeBudgetData'
// eslint-disable-next-line no-restricted-imports
import { writeDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { MonthQueryData } from '@data/queries/month'
import { retotalMonth } from '@data/mutations/month/retotalMonth'
import { recalculateBudgetAccountBalancesFromCache } from '@data/mutations/budget/accounts/recalculateBudgetAccountBalances'

const SAVE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Hook for background saving functionality
 */
export function useBackgroundSave() {
  const {
    removeChange,
    getChanges,
    clearChanges,
    hasChanges,
    setIsSaving,
    setLastSaveTime,
    setSaveError,
  } = useSync()
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)

  /**
   * Save a single month document
   */
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
      cascadeRecalculation: false, // Don't mark for recalculation on background saves
    })
  }, [])

  /**
   * Save a budget document
   */
  const saveBudget = useCallback(async (budgetId: string, context: string): Promise<void> => {
    const budgetKey = queryKeys.budget(budgetId)
    const budgetData = queryClient.getQueryData<BudgetData>(budgetKey)

    if (!budgetData) {
      throw new Error(`Budget ${budgetId} not found in cache`)
    }

    // Extract only the fields that should be saved to Firestore
    // (exclude computed/derived fields)
    await writeBudgetData({
      budgetId,
      updates: {
        name: budgetData.budget.name,
        user_ids: budgetData.budget.user_ids,
        accepted_user_ids: budgetData.budget.accepted_user_ids,
        owner_id: budgetData.budget.owner_id,
        owner_email: budgetData.budget.owner_email,
        accounts: budgetData.budget.accounts,
        account_groups: budgetData.budget.account_groups,
        categories: budgetData.budget.categories,
        category_groups: budgetData.budget.category_groups,
        total_available: budgetData.budget.total_available,
        is_needs_recalculation: budgetData.budget.is_needs_recalculation,
        month_map: budgetData.budget.month_map,
      },
      description: `${context}: budget`,
    })
  }, [])

  /**
   * Save payees document
   */
  const savePayees = useCallback(async (budgetId: string, context: string): Promise<void> => {
    const payeesKey = queryKeys.payees(budgetId)
    const payees = queryClient.getQueryData<string[]>(payeesKey)

    if (!payees) {
      throw new Error(`Payees for budget ${budgetId} not found in cache`)
    }

    await writeDocByPath(
      'payees',
      budgetId,
      {
        budget_id: budgetId,
        payees,
        updated_at: new Date().toISOString(),
      },
      `${context}: payees`
    )
  }, [])

  /**
   * Save all tracked changes
   */
  const saveAllChanges = useCallback(async (context: string = 'periodic save'): Promise<void> => {
    if (isSavingRef.current) {
      return // Already saving
    }

    if (!hasChanges()) {
      return // No changes to save
    }

    isSavingRef.current = true
    setIsSaving(true)
    setSaveError(null)
    const changes = getChanges()
    const errors: string[] = []

    try {
      // Group changes by type for batch processing
      const monthChanges: Array<{ budgetId: string; year: number; month: number }> = []
      const budgetChanges = new Set<string>()
      const payeeChanges = new Set<string>()

      for (const change of changes) {
        if (change.type === 'month' && change.year !== undefined && change.month !== undefined) {
          monthChanges.push({ budgetId: change.budgetId, year: change.year, month: change.month })
        } else if (change.type === 'budget') {
          budgetChanges.add(change.budgetId)
        } else if (change.type === 'payees') {
          payeeChanges.add(change.budgetId)
        }
      }

      // Before saving, retotal all changed months to ensure accuracy
      // This ensures we're saving the most up-to-date totals even if some
      // local recalculations failed
      for (const { budgetId, year, month } of monthChanges) {
        const monthKey = queryKeys.month(budgetId, year, month)
        const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)
        if (monthQueryData?.month) {
          // Retotal from current state to ensure accuracy
          const retotaledMonth = retotalMonth(monthQueryData.month)
          queryClient.setQueryData<MonthQueryData>(monthKey, { month: retotaledMonth })
        }
      }

      // Save months
      for (const { budgetId, year, month } of monthChanges) {
        try {
          await saveMonth(budgetId, year, month, context)
        } catch (error) {
          const errorMsg = `Failed to save month ${year}/${month}: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMsg)
          console.error('[useBackgroundSave]', errorMsg, error)
        }
      }

      // Before saving budgets, recalculate account balances from all months
      // This ensures accuracy even if some local recalculations failed
      for (const budgetId of budgetChanges) {
        try {
          recalculateBudgetAccountBalancesFromCache(budgetId)
        } catch (error) {
          console.warn('[useBackgroundSave] Failed to recalculate budget account balances from cache:', error)
          // Continue even if recalculation fails - we'll still save with current values
        }
      }

      // Save budgets
      for (const budgetId of budgetChanges) {
        try {
          await saveBudget(budgetId, context)
        } catch (error) {
          const errorMsg = `Failed to save budget: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMsg)
          console.error('[useBackgroundSave]', errorMsg, error)
        }
      }

      // Save payees
      for (const budgetId of payeeChanges) {
        try {
          await savePayees(budgetId, context)
        } catch (error) {
          const errorMsg = `Failed to save payees: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMsg)
          console.error('[useBackgroundSave]', errorMsg, error)
        }
      }

      // Clear changes only if all saves succeeded
      if (errors.length === 0) {
        clearChanges()
        setLastSaveTime(Date.now())
        bannerQueue.add({
          type: 'success',
          message: 'All changes saved successfully',
          autoDismissMs: 2000,
        })
      } else {
        // Re-throw to trigger error handling
        throw new Error(errors.join('; '))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setSaveError(errorMessage)
      bannerQueue.add({
        type: 'error',
        message: `Failed to save changes: ${errorMessage}`,
        autoDismissMs: 0, // Don't auto-dismiss errors
      })
      throw error
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [hasChanges, getChanges, clearChanges, saveMonth, saveBudget, savePayees, setIsSaving, setLastSaveTime, setSaveError])

  /**
   * Save the currently viewing document immediately
   */
  const saveCurrentDocument = useCallback(async (
    budgetId: string,
    documentType: 'month' | 'budget',
    year?: number,
    month?: number
  ): Promise<void> => {
    try {
      setIsSaving(true)
      setSaveError(null)

      if (documentType === 'month' && year !== undefined && month !== undefined) {
        await saveMonth(budgetId, year, month, 'immediate save (current viewing document)')
        // Remove this change from tracking since we saved it immediately
        removeChange({ type: 'month', budgetId, year, month })
        setLastSaveTime(Date.now())
      } else if (documentType === 'budget') {
        await saveBudget(budgetId, 'immediate save (current viewing document)')
        // Remove this change from tracking since we saved it immediately
        removeChange({ type: 'budget', budgetId })
        setLastSaveTime(Date.now())
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setSaveError(errorMessage)
      bannerQueue.add({
        type: 'error',
        message: `Failed to save current document: ${errorMessage}`,
        autoDismissMs: 0,
      })
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [saveMonth, saveBudget, removeChange, setIsSaving, setLastSaveTime, setSaveError])

  /**
   * Set up periodic save timer
   */
  useEffect(() => {
    const startTimer = () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current)
      }
      saveTimerRef.current = setInterval(() => {
        if (hasChanges()) {
          saveAllChanges('periodic save (5-minute timer)').catch(error => {
            console.error('[useBackgroundSave] Periodic save failed:', error)
            // Error will be shown via banner system
          })
        }
      }, SAVE_INTERVAL_MS)
    }

    startTimer()

    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current)
      }
    }
  }, [hasChanges, saveAllChanges])

  return {
    saveAllChanges,
    saveCurrentDocument,
  }
}

