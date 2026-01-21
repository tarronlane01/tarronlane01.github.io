/**
 * Sync Check Hook
 *
 * Periodically checks for remote changes and compares with local cache.
 * Shows sync errors if remote documents are more recently updated.
 */

import { useEffect, useRef } from 'react'
import { useSync } from '@contexts'
import type { DocumentChange } from '@contexts/sync_context'
import { queryClient, queryKeys } from '@data/queryClient'
import { fetchBudget, type BudgetData } from '@data/queries/budget/fetchBudget'
import { fetchPayees } from '@data/queries/payees/fetchPayees'
// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import type { FirestoreData, MonthDocument } from '@types'
import { getYearMonthOrdinal } from '@utils'
import { bannerQueue } from '@components/ui'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'

const SYNC_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Parse month data from Firestore
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  // Convert stored balances to calculated balances
  return convertMonthBalancesFromStored(monthDoc)
}

/**
 * Compare timestamps and return true if remote is newer
 */
function isRemoteNewer(localTime: string | undefined, remoteTime: string | undefined): boolean {
  if (!remoteTime) return false
  if (!localTime) return true
  return new Date(remoteTime) > new Date(localTime)
}

/**
 * Check for sync conflicts by comparing remote and local documents
 * Returns errors for conflicts that can't be auto-resolved
 */
async function checkSyncConflicts(budgetId: string, changes: DocumentChange[]): Promise<string[]> {
  const errors: string[] = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Calculate 3 months ago
  let threeMonthsAgoYear = currentYear
  let threeMonthsAgoMonth = currentMonth - 3
  while (threeMonthsAgoMonth <= 0) {
    threeMonthsAgoMonth += 12
    threeMonthsAgoYear -= 1
  }

  const threeMonthsAgoOrdinal = getYearMonthOrdinal(threeMonthsAgoYear, threeMonthsAgoMonth)

  // Fetch remote documents in parallel
  // Use fetchQuery to respect React Query cache - only fetches if stale or missing
  const [remoteBudget, remotePayees, remoteMonthsResult] = await Promise.all([
    queryClient.fetchQuery<BudgetData>({
      queryKey: queryKeys.budget(budgetId),
      queryFn: () => fetchBudget(budgetId),
      staleTime: 0, // Always check remote for sync conflicts (ignore cache freshness)
    }).catch(() => null),
    queryClient.fetchQuery<string[]>({
      queryKey: queryKeys.payees(budgetId),
      queryFn: () => fetchPayees(budgetId),
      staleTime: 0, // Always check remote for sync conflicts (ignore cache freshness)
    }).catch(() => null),
    queryCollection<FirestoreData>(
      'months',
      'useSyncCheck: checking for remote changes',
      [
        { field: 'budget_id', op: '==', value: budgetId },
        { field: 'year_month_ordinal', op: '>=', value: threeMonthsAgoOrdinal },
      ]
    ).catch(() => ({ docs: [] })),
  ])

  // Check budget
  if (remoteBudget) {
    const localBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (localBudget) {
      const localUpdatedAt = localBudget.budget?.updated_at
      if (isRemoteNewer(localUpdatedAt, remoteBudget.budget.updated_at)) {
        // Check if local has unsaved changes
        const hasLocalChanges = changes.some(
          c => c.type === 'budget' && c.budgetId === budgetId
        )

        if (hasLocalChanges) {
          errors.push('Budget document has been updated remotely (you have unsaved local changes)')
        } else {
          // Safe to update: remote is newer and no local changes
          queryClient.setQueryData(queryKeys.budget(budgetId), remoteBudget)
        }
      }
    }
  }

  // Check payees
  if (remotePayees !== null) {
    // Payees don't have updated_at, so we'll skip this check for now
    // Could compare arrays if needed
    void queryClient.getQueryData(queryKeys.payees(budgetId))
  }

  // Check months
  const remoteMonths = remoteMonthsResult.docs.map(doc => {
    const data = doc.data
    const year = data.year as number
    const month = data.month as number
    return parseMonthData(data, budgetId, year, month)
  })

  for (const remoteMonth of remoteMonths) {
    const localMonth = queryClient.getQueryData<{ month: MonthDocument }>(
      queryKeys.month(budgetId, remoteMonth.year, remoteMonth.month)
    )

    if (localMonth?.month) {
      // Check if remote is newer
      if (isRemoteNewer(localMonth.month.updated_at, remoteMonth.updated_at)) {
        // Check if local has unsaved changes
        const hasLocalChanges = changes.some(
          c => c.type === 'month' && c.budgetId === budgetId && c.year === remoteMonth.year && c.month === remoteMonth.month
        )

        if (hasLocalChanges) {
          // Conflict: both local and remote have changes
          errors.push(`Month ${remoteMonth.year}/${remoteMonth.month} has been updated remotely (you have unsaved local changes)`)
        } else {
          // Safe to update: remote is newer and no local changes
          // Update local cache with remote data
          queryClient.setQueryData<{ month: MonthDocument }>(
            queryKeys.month(budgetId, remoteMonth.year, remoteMonth.month),
            { month: remoteMonth }
          )
          // Note: We don't add to errors since we handled it by updating cache
        }
      }
    }
  }

  return errors
}

/**
 * Hook that periodically checks for sync conflicts
 *
 * NOTE: Does NOT run on initial load - initial load fetches fresh data from Firestore,
 * so there's no need to check for conflicts. Sync checks only run after initial load
 * to detect changes made while the app is open.
 */
export function useSyncCheck(
  budgetId: string | null,
  initialDataLoadComplete: boolean
) {
  const { setSyncError, getChanges } = useSync()
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null)
  const firstCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef<number>(0)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (!budgetId) return
    if (!initialDataLoadComplete) return // Wait for initial load to complete

    // Only start sync checks once after initial load is complete
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const performSyncCheck = async () => {
      try {
        const changes = getChanges()
        const errors = await checkSyncConflicts(budgetId, changes)

        if (errors.length > 0) {
          const errorMessage = `Sync conflict detected: ${errors.join('; ')}`
          setSyncError(errorMessage)
          bannerQueue.add({
            type: 'error',
            message: errorMessage,
            autoDismissMs: 0, // Don't auto-dismiss sync errors
          })
        } else {
          setSyncError(null)
        }
      } catch (error) {
        console.error('[useSyncCheck] Sync check failed:', error)
        const errorMessage = `Failed to check for sync conflicts: ${error instanceof Error ? error.message : String(error)}`
        setSyncError(errorMessage)
        bannerQueue.add({
          type: 'error',
          message: errorMessage,
          autoDismissMs: 0,
        })
      }
    }

    // Start periodic checks: first check after 5 minutes, then every 5 minutes
    // Initial load already completed, so we're synced - no need for immediate check
    firstCheckTimerRef.current = setTimeout(() => {
      performSyncCheck()
      lastCheckRef.current = Date.now()

      // After first check, set up interval for subsequent checks
      syncTimerRef.current = setInterval(() => {
        performSyncCheck()
        lastCheckRef.current = Date.now()
      }, SYNC_CHECK_INTERVAL_MS)
    }, SYNC_CHECK_INTERVAL_MS) // First check 5 minutes after initial load

    return () => {
      // Clear the first check timeout
      if (firstCheckTimerRef.current) {
        clearTimeout(firstCheckTimerRef.current)
      }
      // Clear the interval if it was set
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
      }
      hasStartedRef.current = false
    }
  }, [budgetId, initialDataLoadComplete, setSyncError, getChanges])
}

