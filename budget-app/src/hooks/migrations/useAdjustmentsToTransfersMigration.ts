/**
 * Adjustments to Transfers Migration Hook
 *
 * Finds pairs of adjustments with exact opposite amounts on the same date
 * and converts them into transfer transactions.
 *
 * Valid pairs must be either:
 * - Account-to-account: Both have NO_CATEGORY but different real accounts
 * - Category-to-category: Both have NO_ACCOUNT but different real categories
 *
 * This prevents invalid transfers like account-to-category.
 */

import { useState } from 'react'
import type { MonthDocument, AdjustmentTransaction, TransferTransaction } from '@types'
import { NO_ACCOUNT_ID, NO_CATEGORY_ID, isNoAccount, isNoCategory } from '@data/constants'
import {
  runMigration,
  readAllBudgetsAndMonths,
  type MonthUpdate,
  type MonthReadResult,
  type MigrationResultBase,
} from './index'
import { batchWriteMonths } from './migrationDataHelpers'

// ============================================================================
// TYPES
// ============================================================================

export interface AdjustmentsToTransfersStatus {
  totalBudgets: number
  totalMonths: number
  pairsFound: number
  accountTransferPairs: number
  categoryTransferPairs: number
}

export interface AdjustmentsToTransfersResult extends MigrationResultBase {
  budgetsProcessed: number
  monthsProcessed: number
  transfersCreated: number
  adjustmentsRemoved: number
}

interface AdjustmentPair {
  negative: AdjustmentTransaction
  positive: AdjustmentTransaction
  type: 'account' | 'category'
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if two adjustments form a valid transfer pair
 */
function findValidPair(adj1: AdjustmentTransaction, adj2: AdjustmentTransaction): AdjustmentPair | null {
  // Must be on the same date
  if (adj1.date !== adj2.date) return null

  // Must have exact opposite amounts
  if (Math.abs(adj1.amount + adj2.amount) > 0.001) return null

  // Determine which is negative and which is positive
  const negative = adj1.amount < 0 ? adj1 : adj2
  const positive = adj1.amount < 0 ? adj2 : adj1

  // Check for account-to-account transfer:
  // Both have NO_CATEGORY but different real accounts
  const bothNoCategory = isNoCategory(adj1.category_id) && isNoCategory(adj2.category_id)
  const bothHaveRealAccounts = !isNoAccount(adj1.account_id) && !isNoAccount(adj2.account_id)
  const differentAccounts = adj1.account_id !== adj2.account_id

  if (bothNoCategory && bothHaveRealAccounts && differentAccounts) {
    return { negative, positive, type: 'account' }
  }

  // Check for category-to-category transfer:
  // Both have NO_ACCOUNT but different real categories
  const bothNoAccount = isNoAccount(adj1.account_id) && isNoAccount(adj2.account_id)
  const bothHaveRealCategories = !isNoCategory(adj1.category_id) && !isNoCategory(adj2.category_id)
  const differentCategories = adj1.category_id !== adj2.category_id

  if (bothNoAccount && bothHaveRealCategories && differentCategories) {
    return { negative, positive, type: 'category' }
  }

  return null
}

/**
 * Find all valid adjustment pairs in a list of adjustments
 */
function findAllPairs(adjustments: AdjustmentTransaction[]): AdjustmentPair[] {
  const pairs: AdjustmentPair[] = []
  const usedIds = new Set<string>()

  for (let i = 0; i < adjustments.length; i++) {
    if (usedIds.has(adjustments[i].id)) continue

    for (let j = i + 1; j < adjustments.length; j++) {
      if (usedIds.has(adjustments[j].id)) continue

      const pair = findValidPair(adjustments[i], adjustments[j])
      if (pair) {
        pairs.push(pair)
        usedIds.add(adjustments[i].id)
        usedIds.add(adjustments[j].id)
        break // Each adjustment can only be in one pair
      }
    }
  }

  return pairs
}

/**
 * Convert an adjustment pair to a transfer transaction
 */
function pairToTransfer(pair: AdjustmentPair): TransferTransaction {
  const { negative, positive, type } = pair

  if (type === 'account') {
    // Account-to-account transfer: money moves from negative's account to positive's account
    return {
      id: `transfer_from_adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: Math.abs(negative.amount),
      from_account_id: negative.account_id,
      to_account_id: positive.account_id,
      from_category_id: NO_CATEGORY_ID,
      to_category_id: NO_CATEGORY_ID,
      date: negative.date,
      description: negative.description || positive.description || 'Transfer',
      cleared: negative.cleared && positive.cleared,
      created_at: new Date().toISOString(),
    }
  } else {
    // Category-to-category transfer: money moves from negative's category to positive's category
    return {
      id: `transfer_from_adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: Math.abs(negative.amount),
      from_account_id: NO_ACCOUNT_ID,
      to_account_id: NO_ACCOUNT_ID,
      from_category_id: negative.category_id,
      to_category_id: positive.category_id,
      date: negative.date,
      description: negative.description || positive.description || 'Transfer',
      cleared: negative.cleared && positive.cleared,
      created_at: new Date().toISOString(),
    }
  }
}

/**
 * Process a month and convert adjustment pairs to transfers
 */
function processMonth(monthData: MonthReadResult): {
  needsUpdate: boolean
  updatedMonth: MonthDocument | null
  stats: {
    pairsConverted: number
    adjustmentsRemoved: number
  }
} {
  const month = monthData.data as unknown as MonthDocument
  const adjustments = month.adjustments || []
  const existingTransfers = month.transfers || []

  const pairs = findAllPairs(adjustments)

  if (pairs.length === 0) {
    return {
      needsUpdate: false,
      updatedMonth: null,
      stats: { pairsConverted: 0, adjustmentsRemoved: 0 },
    }
  }

  // Create new transfers from pairs
  const newTransfers = pairs.map(pairToTransfer)

  // Remove paired adjustments
  const pairedIds = new Set<string>()
  for (const pair of pairs) {
    pairedIds.add(pair.negative.id)
    pairedIds.add(pair.positive.id)
  }
  const remainingAdjustments = adjustments.filter(adj => !pairedIds.has(adj.id))

  const updatedMonth: MonthDocument = {
    ...month,
    adjustments: remainingAdjustments,
    transfers: [...existingTransfers, ...newTransfers],
    updated_at: new Date().toISOString(),
  }

  return {
    needsUpdate: true,
    updatedMonth,
    stats: {
      pairsConverted: pairs.length,
      adjustmentsRemoved: pairedIds.size,
    },
  }
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

async function scanForAdjustmentPairs(): Promise<AdjustmentsToTransfersStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('adjustments-to-transfers-scan')

  let totalMonths = 0
  let pairsFound = 0
  let accountTransferPairs = 0
  let categoryTransferPairs = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    totalMonths += months.length

    for (const monthData of months) {
      const month = monthData.data as unknown as MonthDocument
      const adjustments = month.adjustments || []
      const pairs = findAllPairs(adjustments)

      pairsFound += pairs.length
      for (const pair of pairs) {
        if (pair.type === 'account') {
          accountTransferPairs++
        } else {
          categoryTransferPairs++
        }
      }
    }
  }

  return {
    totalBudgets: budgets.length,
    totalMonths,
    pairsFound,
    accountTransferPairs,
    categoryTransferPairs,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

async function runAdjustmentsToTransfersMigration(): Promise<AdjustmentsToTransfersResult> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('adjustments-to-transfers-migration')

  const monthUpdates: MonthUpdate[] = []
  let totalTransfersCreated = 0
  let totalAdjustmentsRemoved = 0
  const errors: string[] = []

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []

    for (const monthData of months) {
      try {
        const { needsUpdate, updatedMonth, stats } = processMonth(monthData)

        if (needsUpdate && updatedMonth) {
          monthUpdates.push({
            budgetId: budget.id,
            year: monthData.year,
            month: monthData.month,
            data: updatedMonth,
          })
          totalTransfersCreated += stats.pairsConverted
          totalAdjustmentsRemoved += stats.adjustmentsRemoved
        }
      } catch (err) {
        errors.push(`Month ${monthData.year}/${monthData.month} in budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Batch write all updated months
  if (monthUpdates.length > 0) {
    await batchWriteMonths(monthUpdates, 'adjustments-to-transfers-migration')
  }

  return {
    budgetsProcessed: budgets.length,
    monthsProcessed: monthUpdates.length,
    transfersCreated: totalTransfersCreated,
    adjustmentsRemoved: totalAdjustmentsRemoved,
    errors,
  }
}

// ============================================================================
// HOOK
// ============================================================================

interface UseAdjustmentsToTransfersMigrationOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useAdjustmentsToTransfersMigration({ currentUser, onComplete }: UseAdjustmentsToTransfersMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<AdjustmentsToTransfersStatus | null>(null)
  const [result, setResult] = useState<AdjustmentsToTransfersResult | null>(null)

  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      const scanResult = await scanForAdjustmentPairs()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan for adjustment pairs:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function runMigrationAction(): Promise<void> {
    if (!currentUser) return

    setIsRunning(true)
    setResult(null)

    try {
      const migrationResult = await runMigration(() => runAdjustmentsToTransfersMigration())
      setResult(migrationResult)
      onComplete?.()
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        monthsProcessed: 0,
        transfersCreated: 0,
        adjustmentsRemoved: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  // Computed properties
  const hasPairsToConvert = status !== null && status.pairsFound > 0

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    hasPairsToConvert,
    // Migration
    isRunning,
    result,
    runMigration: runMigrationAction,
  }
}

