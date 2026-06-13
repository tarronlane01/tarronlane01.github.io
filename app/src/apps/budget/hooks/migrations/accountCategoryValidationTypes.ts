/**
 * Types for Account/Category Validation Migration
 */

import type { ParsedSeedRow } from './seedImportTypes'

export interface TransactionViolation {
  budgetId: string
  monthKey: string
  transactionType: 'income' | 'expense' | 'adjustment' | 'transfer'
  transactionId: string
  violation: string
  transactionDetails: {
    date: string
    amount: number
    payee?: string
    description?: string
    accountId?: string
    categoryId?: string
    fromAccountId?: string
    toAccountId?: string
    fromCategoryId?: string
    toCategoryId?: string
  }
  potentialSeedMatches: ParsedSeedRow[]
}

export interface ValidationStatus {
  totalBudgets: number
  totalMonths: number
  totalIncome: number
  totalExpenses: number
  totalAdjustments: number
  totalTransfers: number
  violations: TransactionViolation[]
  scannedAt: string
}

