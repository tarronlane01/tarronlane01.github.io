/**
 * Diagnostic Download Migration Hook
 *
 * Downloads all budget and month data for troubleshooting balance discrepancies.
 * This is a READ-ONLY operation - it does not modify any data.
 */

import { useState } from 'react'
import { readAllBudgetsAndMonths } from './migrationDataHelpers'
import type { MonthReadResult } from './migrationDataHelpers'
import { roundCurrency } from '@utils'
import type {
  CategoryBalanceInfo, AccountBalanceInfo, MonthSummary, RawMonthData,
  BudgetDiagnostic, DiagnosticResult, DownloadProgress, MonthCategoryInfo,
} from './diagnosticDownloadTypes'

// Re-export types for consumers
export type { DownloadProgress } from './diagnosticDownloadTypes'

interface UseDiagnosticDownloadOptions {
  currentUser: unknown
}

function isNoCategory(categoryId: string): boolean {
  return categoryId === 'no_category' || categoryId === 'NO_CATEGORY'
}

function calculateCategoryAdjustments(
  transfers: Array<{ amount: number; from_category_id: string; to_category_id: string }>,
  adjustments: Array<{ amount: number; category_id: string }>
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const transfer of transfers) {
    if (transfer.from_category_id && !isNoCategory(transfer.from_category_id)) {
      result[transfer.from_category_id] = (result[transfer.from_category_id] || 0) - transfer.amount
    }
    if (transfer.to_category_id && !isNoCategory(transfer.to_category_id)) {
      result[transfer.to_category_id] = (result[transfer.to_category_id] || 0) + transfer.amount
    }
  }
  for (const adjustment of adjustments) {
    if (adjustment.category_id && !isNoCategory(adjustment.category_id)) {
      result[adjustment.category_id] = (result[adjustment.category_id] || 0) + adjustment.amount
    }
  }
  return result
}

function processMonthsData(
  months: MonthReadResult[],
  categories: Record<string, { name: string; balance?: number }>,
  accounts: Record<string, { name: string; balance?: number }>
): { categoryBalances: CategoryBalanceInfo[]; accountBalances: AccountBalanceInfo[]; monthSummaries: MonthSummary[]; rawMonthData: RawMonthData[] } {
  const categoryIds = Object.keys(categories).filter(id => !isNoCategory(id))
  const accountIds = Object.keys(accounts)
  const runningCategoryBalances: Record<string, number> = {}
  const runningAccountBalances: Record<string, number> = {}
  categoryIds.forEach(id => { runningCategoryBalances[id] = 0 })
  accountIds.forEach(id => { runningAccountBalances[id] = 0 })
  const categoryMonthBreakdowns: Record<string, MonthCategoryInfo[]> = {}
  categoryIds.forEach(id => { categoryMonthBreakdowns[id] = [] })
  const monthSummaries: MonthSummary[] = []
  const rawMonthData: RawMonthData[] = []

  for (const monthResult of months) {
    const data = monthResult.data
    const monthKey = `${monthResult.year}-${String(monthResult.month).padStart(2, '0')}`
    const income = (data.income || []) as Array<{ id: string; amount: number; account_id: string; date: string; description?: string }>
    const expenses = (data.expenses || []) as Array<{ id: string; amount: number; account_id: string; category_id: string; date: string; payee?: string; description?: string }>
    const transfers = (data.transfers || []) as Array<{ id: string; amount: number; from_account_id: string; to_account_id: string; from_category_id: string; to_category_id: string; date: string; description?: string }>
    const adjustments = (data.adjustments || []) as Array<{ id: string; amount: number; account_id: string; category_id: string; date: string; description?: string }>
    const categoryBalancesStored = (data.category_balances || []) as Array<{ category_id: string; start_balance: number; allocated: number; spent: number; end_balance: number }>
    const accountBalancesStored = (data.account_balances || []) as Array<{ account_id: string; start_balance: number; income: number; expenses: number; net_change: number; end_balance: number }>
    const areAllocationsFinalized = data.are_allocations_finalized === true

    const storedCatBalances: Record<string, { start_balance: number; allocated: number; spent: number; end_balance: number }> = {}
    for (const cb of categoryBalancesStored) { storedCatBalances[cb.category_id] = cb }
    const categoryAdjustments = calculateCategoryAdjustments(transfers, adjustments)

    for (const catId of categoryIds) {
      const startBalance = roundCurrency(runningCategoryBalances[catId] || 0)
      let allocated = 0
      if (areAllocationsFinalized && storedCatBalances[catId]) { allocated = roundCurrency(storedCatBalances[catId].allocated || 0) }
      const spent = roundCurrency(expenses.filter(e => e.category_id === catId).reduce((sum, e) => sum + e.amount, 0))
      const adjustment = roundCurrency(categoryAdjustments[catId] || 0)
      const calculatedEnd = roundCurrency(startBalance + allocated + spent + adjustment)
      const storedEnd = roundCurrency(storedCatBalances[catId]?.end_balance ?? 0)
      categoryMonthBreakdowns[catId].push({ month: monthKey, startBalance, allocated, spent, adjustment, calculatedEnd, storedEnd, endDiscrepancy: roundCurrency(calculatedEnd - storedEnd) })
      runningCategoryBalances[catId] = storedEnd
    }

    for (const accId of accountIds) {
      const accIncome = roundCurrency(income.filter(i => i.account_id === accId).reduce((sum, i) => sum + i.amount, 0))
      const accExpenses = roundCurrency(expenses.filter(e => e.account_id === accId).reduce((sum, e) => sum + e.amount, 0))
      const accTransfersIn = roundCurrency(transfers.filter(t => t.to_account_id === accId).reduce((sum, t) => sum + t.amount, 0))
      const accTransfersOut = roundCurrency(transfers.filter(t => t.from_account_id === accId).reduce((sum, t) => sum + t.amount, 0))
      const accAdjustments = roundCurrency(adjustments.filter(a => a.account_id === accId).reduce((sum, a) => sum + a.amount, 0))
      runningAccountBalances[accId] += accIncome + accExpenses + accTransfersIn - accTransfersOut + accAdjustments
    }

    const totalIncome = roundCurrency(income.reduce((sum, i) => sum + i.amount, 0))
    const totalExpenses = roundCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))
    const totalAllocated = roundCurrency(categoryBalancesStored.reduce((sum, cb) => sum + (cb.allocated || 0), 0))
    const totalTransfers = roundCurrency(transfers.reduce((sum, t) => sum + t.amount, 0))
    const totalAdjustments = roundCurrency(adjustments.reduce((sum, a) => sum + a.amount, 0))

    monthSummaries.push({ year: monthResult.year, month: monthResult.month, monthKey, totalIncome, totalExpenses, totalAllocated, totalTransfers, totalAdjustments, allocationsFinalized: areAllocationsFinalized, expenseCount: expenses.length, incomeCount: income.length, transferCount: transfers.length, adjustmentCount: adjustments.length })
    rawMonthData.push({ year: monthResult.year, month: monthResult.month, income, expenses, transfers, adjustments, categoryBalances: categoryBalancesStored, accountBalances: accountBalancesStored, areAllocationsFinalized })
  }

  const categoryBalances: CategoryBalanceInfo[] = categoryIds.map(catId => {
    const storedAllTime = roundCurrency(categories[catId]?.balance ?? 0)
    const calculatedAllTime = roundCurrency(runningCategoryBalances[catId])
    return { categoryId: catId, categoryName: categories[catId]?.name || 'Unknown', storedAllTimeBalance: storedAllTime, calculatedAllTimeBalance: calculatedAllTime, discrepancy: roundCurrency(calculatedAllTime - storedAllTime), monthBreakdown: categoryMonthBreakdowns[catId] }
  })

  const accountBalances: AccountBalanceInfo[] = accountIds.map(accId => {
    const storedBalance = roundCurrency(accounts[accId]?.balance ?? 0)
    const calculatedBalance = roundCurrency(runningAccountBalances[accId])
    return { accountId: accId, accountName: accounts[accId]?.name || 'Unknown', storedBalance, calculatedBalance, discrepancy: roundCurrency(calculatedBalance - storedBalance) }
  })

  return { categoryBalances, accountBalances, monthSummaries, rawMonthData }
}

export function useDiagnosticDownload({ currentUser }: UseDiagnosticDownloadOptions) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function downloadDiagnostics(): Promise<void> {
    if (!currentUser) { setError('Must be logged in to download diagnostics'); return }
    setIsDownloading(true)
    setError(null)
    setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 0 })

    try {
      setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 10 })
      const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('diagnostic-download')
      setProgress({ phase: 'analyzing', current: 0, total: budgets.length, percentComplete: 30 })

      const budgetDiagnostics: BudgetDiagnostic[] = []
      let totalMonths = 0, totalCategories = 0, totalAccounts = 0, budgetsWithDiscrepancies = 0

      for (let i = 0; i < budgets.length; i++) {
        const budget = budgets[i]
        const months = monthsByBudget.get(budget.id) || []
        totalMonths += months.length
        const budgetData = budget.data
        const categories = (budgetData.categories || {}) as Record<string, { name: string; balance?: number }>
        const accounts = (budgetData.accounts || {}) as Record<string, { name: string; balance?: number }>
        totalCategories += Object.keys(categories).length
        totalAccounts += Object.keys(accounts).length

        const { categoryBalances, accountBalances, monthSummaries, rawMonthData } = processMonthsData(months, categories, accounts)
        const categoriesWithDiscrepancies = categoryBalances.filter(cb => Math.abs(cb.discrepancy) > 0.01).length
        const accountsWithDiscrepancies = accountBalances.filter(ab => Math.abs(ab.discrepancy) > 0.01).length
        const totalCategoryDiscrepancy = roundCurrency(categoryBalances.reduce((sum, cb) => sum + cb.discrepancy, 0))
        const totalAccountDiscrepancy = roundCurrency(accountBalances.reduce((sum, ab) => sum + ab.discrepancy, 0))

        if (categoriesWithDiscrepancies > 0 || accountsWithDiscrepancies > 0) { budgetsWithDiscrepancies++ }

        budgetDiagnostics.push({
          budgetId: budget.id, budgetName: (budgetData.name as string) || 'Unknown Budget',
          totalAvailable: (budgetData.total_available as number) ?? 0, categoryBalances, accountBalances, monthSummaries, rawMonthData,
          discrepancySummary: { totalCategoryDiscrepancy, totalAccountDiscrepancy, categoriesWithDiscrepancies, accountsWithDiscrepancies }
        })
        setProgress({ phase: 'analyzing', current: i + 1, total: budgets.length, percentComplete: 30 + Math.round((i + 1) / budgets.length * 60) })
      }

      const result: DiagnosticResult = { timestamp: new Date().toISOString(), budgets: budgetDiagnostics, globalSummary: { totalBudgets: budgets.length, totalMonths, totalCategories, totalAccounts, budgetsWithDiscrepancies } }
      setProgress({ phase: 'complete', current: 1, total: 1, percentComplete: 100 })

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `budget-diagnostic-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during download')
    } finally {
      setIsDownloading(false)
      setProgress(null)
    }
  }

  return { isDownloading, progress, error, downloadDiagnostics }
}
