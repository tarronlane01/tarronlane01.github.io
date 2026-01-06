/**
 * Types for Orphaned ID Cleanup Migration
 */

import type { MigrationResultBase } from './index'

export interface OrphanedIdCleanupStatus {
  totalBudgets: number
  totalMonths: number
  orphanedCategoryIds: number
  orphanedAccountIds: number
  affectedExpenses: number
  affectedIncome: number
  affectedTransfers: number
  affectedAdjustments: number
}

export interface OrphanedIdCleanupResult extends MigrationResultBase {
  budgetsProcessed: number
  monthsProcessed: number
  categoryIdsFixed: number
  accountIdsFixed: number
}

export interface BudgetLookups {
  categoryIds: Set<string>
  accountIds: Set<string>
}

export interface ProcessMonthStats {
  categoryIdsFixed: number
  accountIdsFixed: number
  affectedExpenses: number
  affectedIncome: number
  affectedTransfers: number
  affectedAdjustments: number
}

