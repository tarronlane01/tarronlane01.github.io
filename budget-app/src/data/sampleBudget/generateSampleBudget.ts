/**
 * Generate Sample Budget Data
 * 
 * Takes the sample budget templates and generates actual data with
 * dates relative to the current calendar month.
 */

import {
  SAMPLE_BUDGET_ID,
  SAMPLE_BUDGET_NAME,
  SAMPLE_ACCOUNTS,
  SAMPLE_CATEGORIES,
} from './sampleBudgetDefinition'
import { SAMPLE_MONTH_TEMPLATES, type SampleMonthTemplate } from './sampleBudgetMonths'
import { chainSampleBudgetBalances } from './sampleBudgetBalanceChain'
import { buildSampleBudgetOutput } from './generateSampleBudgetBuild'
import { roundCurrency } from '@utils'

export interface GeneratedMonth {
  budgetId: string
  year: number
  month: number
  data: GeneratedMonthData
}

export interface GeneratedMonthData {
  budget_id: string
  year: number
  month: number
  year_month_ordinal: string
  total_income: number
  previous_month_income: number
  total_expenses: number
  are_allocations_finalized: boolean
  created_at: string
  updated_at: string
  income: GeneratedTransaction[]
  expenses: GeneratedTransaction[]
  transfers: GeneratedTransfer[]
  adjustments: GeneratedAdjustment[]
  account_balances: GeneratedAccountBalance[]
  category_balances: GeneratedCategoryBalance[]
}

export interface GeneratedTransaction {
  id: string
  account_id: string
  payee: string
  description: string
  amount: number
  category_id?: string
  date: string
  cleared: boolean
  created_at: string
}

export interface GeneratedTransfer {
  id: string
  from_account_id: string
  to_account_id: string
  from_category_id: string
  to_category_id: string
  amount: number
  description: string
  date: string
  created_at: string
}

export interface GeneratedAdjustment {
  id: string
  account_id: string
  category_id: string
  amount: number
  description: string
  date: string
  created_at: string
}

export interface GeneratedCategoryBalance {
  category_id: string
  start_balance: number
  allocated: number
  spent: number
  transfers: number
  adjustments: number
  end_balance: number
}

export interface GeneratedAccountBalance {
  account_id: string
  start_balance: number
  income: number
  expenses: number
  transfers: number
  adjustments: number
  net_change: number
  end_balance: number
}

export interface GeneratedBudget {
  budgetDocument: Record<string, unknown>
  payeesDocument: Record<string, unknown>
  months: GeneratedMonth[]
}

function formatDateString(year: number, month: number, day: number): string {
  const safeDay = Math.min(day, 28)
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function formatTimestamp(year: number, month: number, day: number): string {
  return `${formatDateString(year, month, day)}T12:00:00.000Z`
}

// Reference point for sample budget generation
// When referenceDate is provided, month offset 0 = that date's month
// When not provided, uses the current calendar month
let currentReferenceYear: number
let currentReferenceMonth: number

function setReference(referenceDate?: Date): void {
  const date = referenceDate || new Date()
  currentReferenceYear = date.getFullYear()
  currentReferenceMonth = date.getMonth() + 1 // JS months are 0-indexed
}

function getMonthFromOffset(offset: number): { year: number; month: number } {
  let targetYear = currentReferenceYear
  let targetMonth = currentReferenceMonth + offset

  while (targetMonth < 1) {
    targetMonth += 12
    targetYear -= 1
  }
  while (targetMonth > 12) {
    targetMonth -= 12
    targetYear += 1
  }

  return { year: targetYear, month: targetMonth }
}

function generateMonthData(template: SampleMonthTemplate): GeneratedMonthData {
  const { year, month } = getMonthFromOffset(template.monthOffset)
  const yearMonthOrdinal = `${year}${String(month).padStart(2, '0')}`
  const timestamp = new Date().toISOString()

  const income: GeneratedTransaction[] = template.income.map((t) => ({
    id: `income_${yearMonthOrdinal}_${t.idSuffix}`,
    account_id: t.account_id,
    payee: t.payee,
    description: t.description,
    amount: t.amount,
    date: formatDateString(year, month, t.day),
    cleared: t.cleared,
    created_at: formatTimestamp(year, month, t.day),
  }))

  const expenses: GeneratedTransaction[] = template.expenses.map((t) => ({
    id: `expense_${yearMonthOrdinal}_${t.idSuffix}`,
    account_id: t.account_id,
    payee: t.payee,
    description: t.description,
    amount: t.amount,
    category_id: t.category_id,
    date: formatDateString(year, month, t.day),
    cleared: t.cleared,
    created_at: formatTimestamp(year, month, t.day),
  }))

  const transfers: GeneratedTransfer[] = template.transfers.map((t) => ({
    id: `transfer_${yearMonthOrdinal}_${t.idSuffix}`,
    from_account_id: t.from_account_id,
    to_account_id: t.to_account_id,
    from_category_id: t.from_category_id,
    to_category_id: t.to_category_id,
    amount: t.amount,
    description: t.description,
    date: formatDateString(year, month, t.day),
    created_at: formatTimestamp(year, month, t.day),
  }))

  const adjustments: GeneratedAdjustment[] = template.adjustments.map((t) => ({
    id: `adjustment_${yearMonthOrdinal}_${t.idSuffix}`,
    account_id: t.account_id,
    category_id: t.category_id,
    amount: t.amount,
    description: t.description,
    date: formatDateString(year, month, t.day),
    created_at: formatTimestamp(year, month, t.day),
  }))

  const totalIncome = roundCurrency(income.reduce((sum, t) => sum + t.amount, 0))
  const totalExpenses = roundCurrency(expenses.reduce((sum, t) => sum + t.amount, 0))

  const categorySpending: Record<string, number> = {}
  const categoryTransfers: Record<string, number> = {}
  const categoryAdjustments: Record<string, number> = {}

  for (const exp of expenses) {
    if (exp.category_id) {
      categorySpending[exp.category_id] = roundCurrency(
        (categorySpending[exp.category_id] || 0) + exp.amount
      )
    }
  }

  for (const t of transfers) {
    if (t.from_category_id !== 'no_category') {
      categoryTransfers[t.from_category_id] = roundCurrency(
        (categoryTransfers[t.from_category_id] || 0) - t.amount
      )
    }
    if (t.to_category_id !== 'no_category') {
      categoryTransfers[t.to_category_id] = roundCurrency(
        (categoryTransfers[t.to_category_id] || 0) + t.amount
      )
    }
  }

  for (const adj of adjustments) {
    categoryAdjustments[adj.category_id] = roundCurrency(
      (categoryAdjustments[adj.category_id] || 0) + adj.amount
    )
  }

  // Build allocations map from template
  const categoryAllocations: Record<string, number> = {}
  for (const alloc of template.allocations) {
    categoryAllocations[alloc.category_id] = alloc.amount
  }

  const allCategoryIds = new Set([
    ...Object.keys(categorySpending),
    ...Object.keys(categoryTransfers),
    ...Object.keys(categoryAdjustments),
    ...Object.keys(categoryAllocations),
    ...Object.keys(SAMPLE_CATEGORIES),
  ])

  const category_balances: GeneratedCategoryBalance[] = Array.from(allCategoryIds).map(
    (categoryId) => {
      const allocated = categoryAllocations[categoryId] || 0
      const spent = categorySpending[categoryId] || 0
      const transferAmt = categoryTransfers[categoryId] || 0
      const adjustmentAmt = categoryAdjustments[categoryId] || 0

      return {
        category_id: categoryId,
        start_balance: 0,
        allocated,
        spent,
        transfers: transferAmt,
        adjustments: adjustmentAmt,
        end_balance: roundCurrency(allocated + spent + transferAmt + adjustmentAmt),
      }
    }
  )

  // Calculate account balances - track income, expenses, transfers, adjustments per account
  const accountIncome: Record<string, number> = {}
  const accountExpenses: Record<string, number> = {}
  const accountTransfersIn: Record<string, number> = {}
  const accountTransfersOut: Record<string, number> = {}
  const accountAdjustments: Record<string, number> = {}

  for (const inc of income) {
    accountIncome[inc.account_id] = roundCurrency(
      (accountIncome[inc.account_id] || 0) + inc.amount
    )
  }

  for (const exp of expenses) {
    accountExpenses[exp.account_id] = roundCurrency(
      (accountExpenses[exp.account_id] || 0) + exp.amount // expenses are negative
    )
  }

  for (const t of transfers) {
    accountTransfersOut[t.from_account_id] = roundCurrency(
      (accountTransfersOut[t.from_account_id] || 0) - t.amount
    )
    accountTransfersIn[t.to_account_id] = roundCurrency(
      (accountTransfersIn[t.to_account_id] || 0) + t.amount
    )
  }

  for (const adj of adjustments) {
    accountAdjustments[adj.account_id] = roundCurrency(
      (accountAdjustments[adj.account_id] || 0) + adj.amount
    )
  }

  const allAccountIds = new Set([
    ...Object.keys(accountIncome),
    ...Object.keys(accountExpenses),
    ...Object.keys(accountTransfersIn),
    ...Object.keys(accountTransfersOut),
    ...Object.keys(accountAdjustments),
    ...Object.keys(SAMPLE_ACCOUNTS),
  ])

  const account_balances: GeneratedAccountBalance[] = Array.from(allAccountIds).map(
    (accountId) => {
      const incomeAmt = accountIncome[accountId] || 0
      const expenseAmt = accountExpenses[accountId] || 0
      const transfersInAmt = accountTransfersIn[accountId] || 0
      const transfersOutAmt = accountTransfersOut[accountId] || 0
      const adjustmentAmt = accountAdjustments[accountId] || 0
      const netChange = roundCurrency(incomeAmt + expenseAmt + transfersInAmt + transfersOutAmt + adjustmentAmt)

      return {
        account_id: accountId,
        start_balance: 0,
        income: incomeAmt,
        expenses: expenseAmt,
        transfers: roundCurrency(transfersInAmt + transfersOutAmt),
        adjustments: adjustmentAmt,
        net_change: netChange,
        end_balance: netChange, // Will be updated with chaining later
      }
    }
  )

  return {
    budget_id: SAMPLE_BUDGET_ID,
    year,
    month,
    year_month_ordinal: yearMonthOrdinal,
    total_income: totalIncome,
    previous_month_income: 0,
    total_expenses: totalExpenses,
    are_allocations_finalized: template.areAllocationsFinalized,
    created_at: timestamp,
    updated_at: timestamp,
    income,
    expenses,
    transfers,
    adjustments,
    account_balances,
    category_balances,
  }
}

export interface GenerateSampleBudgetOptions {
  /** Reference date for month offset 0. Defaults to current date. */
  referenceDate?: Date
}

export function generateSampleBudget(options?: GenerateSampleBudgetOptions): GeneratedBudget {
  // Set the reference point for all month offset calculations
  setReference(options?.referenceDate)
  
  const timestamp = new Date().toISOString()

  // Generate month data (with temporary balances)
  const rawMonths: GeneratedMonth[] = SAMPLE_MONTH_TEMPLATES.map((template) => {
    const data = generateMonthData(template)
    return {
      budgetId: SAMPLE_BUDGET_ID,
      year: data.year,
      month: data.month,
      data,
    }
  })

  rawMonths.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  const months = chainSampleBudgetBalances(rawMonths)
  const { budgetDocument, payeesDocument } = buildSampleBudgetOutput(months, timestamp)

  return {
    budgetDocument,
    payeesDocument,
    months,
  }
}

export { SAMPLE_BUDGET_ID, SAMPLE_BUDGET_NAME }
