/**
 * Types for Diagnostic Download Migration
 */

export interface CategoryBalanceInfo {
  categoryId: string
  categoryName: string
  storedAllTimeBalance: number
  calculatedAllTimeBalance: number
  discrepancy: number
  monthBreakdown: MonthCategoryInfo[]
}

export interface MonthCategoryInfo {
  month: string
  startBalance: number
  allocated: number
  spent: number
  adjustment: number
  calculatedEnd: number
  storedEnd: number
  endDiscrepancy: number
}

export interface AccountBalanceInfo {
  accountId: string
  accountName: string
  storedBalance: number
  calculatedBalance: number
  discrepancy: number
}

export interface MonthSummary {
  year: number
  month: number
  monthKey: string
  totalIncome: number
  totalExpenses: number
  totalAllocated: number
  totalTransfers: number
  totalAdjustments: number
  allocationsFinalized: boolean
  expenseCount: number
  incomeCount: number
  transferCount: number
  adjustmentCount: number
}

export interface BudgetDiagnostic {
  budgetId: string
  budgetName: string
  totalAvailable: number
  categoryBalances: CategoryBalanceInfo[]
  accountBalances: AccountBalanceInfo[]
  monthSummaries: MonthSummary[]
  rawMonthData: RawMonthData[]
  discrepancySummary: {
    totalCategoryDiscrepancy: number
    totalAccountDiscrepancy: number
    categoriesWithDiscrepancies: number
    accountsWithDiscrepancies: number
  }
}

export interface RawMonthData {
  year: number
  month: number
  // Full transaction objects - all fields from Firestore are preserved
  income: Array<{ id: string; amount: number; account_id: string; date: string; payee?: string; description?: string; cleared?: boolean; created_at?: string }>
  expenses: Array<{ id: string; amount: number; account_id: string; category_id: string; date: string; payee?: string; description?: string; cleared?: boolean; created_at?: string }>
  transfers: Array<{ id: string; amount: number; from_account_id: string; to_account_id: string; from_category_id: string; to_category_id: string; date: string; description?: string; cleared?: boolean; created_at?: string }>
  adjustments: Array<{ id: string; amount: number; account_id: string; category_id: string; date: string; description?: string; cleared?: boolean; created_at?: string }>
  categoryBalances: Array<{ category_id: string; start_balance: number; allocated: number; spent: number; end_balance: number }>
  accountBalances: Array<{ account_id: string; start_balance: number; income: number; expenses: number; net_change: number; end_balance: number }>
  areAllocationsFinalized: boolean
}

export interface DiagnosticResult {
  timestamp: string
  budgets: BudgetDiagnostic[]
  globalSummary: {
    totalBudgets: number
    totalMonths: number
    totalCategories: number
    totalAccounts: number
    budgetsWithDiscrepancies: number
  }
}

export interface DownloadProgress {
  phase: 'reading' | 'analyzing' | 'complete'
  current: number
  total: number
  percentComplete: number
}

