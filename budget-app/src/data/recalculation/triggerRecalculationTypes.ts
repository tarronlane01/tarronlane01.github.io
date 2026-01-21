/**
 * Types for Trigger Recalculation module
 */

import type { FirestoreData, MonthDocument } from '@types'

/**
 * Progress information for recalculation.
 * Reported via onProgress callback during recalculation.
 */
export interface RecalculationProgress {
  /** Current phase of recalculation */
  phase: 'reading-budget' | 'fetching-months' | 'recalculating' | 'saving' | 'validating' | 'complete'
  /** Human-readable label for current month being processed */
  currentMonth?: string
  /** Number of months fetched so far (during fetching-months phase) */
  monthsFetched?: number
  /** Total number of months to fetch (during fetching-months phase) */
  totalMonthsToFetch?: number
  /** Number of months processed so far */
  monthsProcessed: number
  /** Total number of months to process */
  totalMonths: number
  /** Percentage complete (0-100) */
  percentComplete: number
}

export interface TriggerRecalculationOptions {
  /**
   * Month ordinal (YYYYMM format) that triggered this recalculation.
   * Used to optimize the query - we only fetch months from this point forward.
   * If not provided, defaults to current calendar month.
   */
  triggeringMonthOrdinal?: string
  /**
   * Optional callback to report progress during recalculation.
   */
  onProgress?: (progress: RecalculationProgress) => void
}

export interface RecalculationResult {
  /** Number of months recalculated */
  monthsRecalculated: number
  /** Whether the budget was updated */
  budgetUpdated: boolean
  /** The final account balances (if budget was updated) */
  finalAccountBalances?: Record<string, number>
}

// Budget document structure from Firestore
export interface BudgetDocument {
  name: string
  user_ids: string[]
  accepted_user_ids: string[]
  owner_id: string
  owner_email: string | null
  accounts: FirestoreData
  account_groups: FirestoreData
  categories: FirestoreData
  category_groups: FirestoreData[]
  // Removed total_available and is_needs_recalculation - calculated/managed locally
  month_map?: FirestoreData
  created_at?: string
  updated_at?: string
}

export type MonthWithId = MonthDocument & { id: string }

/** Month name constants for progress reporting */
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

