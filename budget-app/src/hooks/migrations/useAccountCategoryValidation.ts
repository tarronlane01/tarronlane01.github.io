/**
 * Account/Category Validation Migration
 *
 * Scans all transactions to find invalid account/category combinations.
 * Also compares violations against the seed CSV to identify potential source rows.
 */

import { useState } from 'react'
import type { MonthDocument, IncomeTransaction, ExpenseTransaction, TransferTransaction, AdjustmentTransaction } from '@types'
import { isNoAccount, isNoCategory } from '@data/constants'
import { readAllBudgetsAndMonths } from './migrationDataHelpers'
import { parseRawCashFlowCSV } from './seedImportParser'
import type { ParsedSeedRow } from './seedImportTypes'
import type { TransactionViolation, ValidationStatus } from './accountCategoryValidationTypes'

export type { TransactionViolation, ValidationStatus } from './accountCategoryValidationTypes'

function validateIncome(income: IncomeTransaction): string | null {
  if (!income.account_id || income.account_id.trim() === '') return 'Missing account_id (empty or undefined)'
  return null
}

function validateExpense(expense: ExpenseTransaction): string | null {
  const issues: string[] = []
  if (!expense.account_id || expense.account_id.trim() === '') issues.push('missing account_id')
  if (!expense.category_id || expense.category_id.trim() === '') issues.push('missing category_id')
  return issues.length > 0 ? issues.join(', ') : null
}

function validateAdjustment(adjustment: AdjustmentTransaction): string | null {
  const hasNoAccount = isNoAccount(adjustment.account_id) || !adjustment.account_id || adjustment.account_id.trim() === ''
  const hasNoCategory = isNoCategory(adjustment.category_id) || !adjustment.category_id || adjustment.category_id.trim() === ''
  if (hasNoAccount && hasNoCategory) return 'Both account_id and category_id are missing/NO_* (must have at least one real ID)'
  return null
}

function validateTransfer(transfer: TransferTransaction): string | null {
  const issues: string[] = []
  if (!transfer.from_account_id || transfer.from_account_id.trim() === '') issues.push('missing from_account_id')
  if (!transfer.to_account_id || transfer.to_account_id.trim() === '') issues.push('missing to_account_id')
  if (!transfer.from_category_id || transfer.from_category_id.trim() === '') issues.push('missing from_category_id')
  if (!transfer.to_category_id || transfer.to_category_id.trim() === '') issues.push('missing to_category_id')
  if (issues.length > 0) return issues.join(', ')

  const sameAccount = transfer.from_account_id === transfer.to_account_id
  const sameCategory = transfer.from_category_id === transfer.to_category_id
  if (sameAccount && sameCategory) return 'Transfer has same from/to on both account and category (nothing would transfer)'

  const fromAccountIsNo = isNoAccount(transfer.from_account_id)
  const toAccountIsNo = isNoAccount(transfer.to_account_id)
  const fromCategoryIsNo = isNoCategory(transfer.from_category_id)
  const toCategoryIsNo = isNoCategory(transfer.to_category_id)
  if (fromAccountIsNo && toAccountIsNo && fromCategoryIsNo && toCategoryIsNo) return 'All from/to account and category IDs are NO_* (must involve at least one real entity)'
  if (fromAccountIsNo && toAccountIsNo && sameCategory) return 'Both accounts are NO_ACCOUNT and categories are the same (nothing transfers)'
  if (fromCategoryIsNo && toCategoryIsNo && sameAccount) return 'Both categories are NO_CATEGORY and accounts are the same (nothing transfers)'
  return null
}

function findPotentialSeedMatches(seedRows: ParsedSeedRow[], transactionDate: string, amount: number, payee?: string, description?: string): ParsedSeedRow[] {
  return seedRows.filter(row => {
    const [year, month, day] = transactionDate.split('-').map(Number)
    if (row.year !== year || row.month !== month || row.day !== day) return false
    if (Math.abs(Math.abs(row.amount) - Math.abs(amount)) > 0.01) return false
    if (payee && row.payee && row.payee.toLowerCase() === payee.toLowerCase()) return true
    if (description && row.description && row.description.toLowerCase().includes(description.toLowerCase())) return true
    return true
  })
}

export async function scanTransactionViolations(seedCsvContent?: string): Promise<ValidationStatus> {
  const violations: TransactionViolation[] = []
  let totalIncome = 0, totalExpenses = 0, totalAdjustments = 0, totalTransfers = 0
  const seedRows: ParsedSeedRow[] = seedCsvContent ? parseRawCashFlowCSV(seedCsvContent) : []
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('account-category-validation')

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    for (const month of months) {
      const monthData = month.data as unknown as MonthDocument
      const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`

      const incomeList = monthData.income || []
      totalIncome += incomeList.length
      for (const income of incomeList) {
        const violation = validateIncome(income)
        if (violation) {
          violations.push({ budgetId: budget.id, monthKey, transactionType: 'income', transactionId: income.id, violation, transactionDetails: { date: income.date, amount: income.amount, payee: income.payee, description: income.description, accountId: income.account_id }, potentialSeedMatches: findPotentialSeedMatches(seedRows, income.date, income.amount, income.payee, income.description) })
        }
      }

      const expenseList = monthData.expenses || []
      totalExpenses += expenseList.length
      for (const expense of expenseList) {
        const violation = validateExpense(expense)
        if (violation) {
          violations.push({ budgetId: budget.id, monthKey, transactionType: 'expense', transactionId: expense.id, violation, transactionDetails: { date: expense.date, amount: expense.amount, payee: expense.payee, description: expense.description, accountId: expense.account_id, categoryId: expense.category_id }, potentialSeedMatches: findPotentialSeedMatches(seedRows, expense.date, expense.amount, expense.payee, expense.description) })
        }
      }

      const adjustmentList = monthData.adjustments || []
      totalAdjustments += adjustmentList.length
      for (const adjustment of adjustmentList) {
        const violation = validateAdjustment(adjustment)
        if (violation) {
          violations.push({ budgetId: budget.id, monthKey, transactionType: 'adjustment', transactionId: adjustment.id, violation, transactionDetails: { date: adjustment.date, amount: adjustment.amount, description: adjustment.description, accountId: adjustment.account_id, categoryId: adjustment.category_id }, potentialSeedMatches: findPotentialSeedMatches(seedRows, adjustment.date, adjustment.amount, undefined, adjustment.description) })
        }
      }

      const transferList = monthData.transfers || []
      totalTransfers += transferList.length
      for (const transfer of transferList) {
        const violation = validateTransfer(transfer)
        if (violation) {
          violations.push({ budgetId: budget.id, monthKey, transactionType: 'transfer', transactionId: transfer.id, violation, transactionDetails: { date: transfer.date, amount: transfer.amount, description: transfer.description, fromAccountId: transfer.from_account_id, toAccountId: transfer.to_account_id, fromCategoryId: transfer.from_category_id, toCategoryId: transfer.to_category_id }, potentialSeedMatches: findPotentialSeedMatches(seedRows, transfer.date, transfer.amount, undefined, transfer.description) })
        }
      }
    }
  }

  violations.sort((a, b) => { const mc = a.monthKey.localeCompare(b.monthKey); return mc !== 0 ? mc : a.transactionType.localeCompare(b.transactionType) })
  return { totalBudgets: budgets.length, totalMonths: Array.from(monthsByBudget.values()).reduce((sum, months) => sum + months.length, 0), totalIncome, totalExpenses, totalAdjustments, totalTransfers, violations, scannedAt: new Date().toISOString() }
}

export function formatViolationReport(status: ValidationStatus): string {
  const lines: string[] = []
  lines.push('='.repeat(80), 'ACCOUNT/CATEGORY VALIDATION REPORT', `Scanned at: ${status.scannedAt}`, '='.repeat(80), '', 'SUMMARY:')
  lines.push(`  Budgets scanned: ${status.totalBudgets}`, `  Months scanned: ${status.totalMonths}`, `  Income transactions: ${status.totalIncome}`, `  Expense transactions: ${status.totalExpenses}`, `  Adjustment transactions: ${status.totalAdjustments}`, `  Transfer transactions: ${status.totalTransfers}`, `  VIOLATIONS FOUND: ${status.violations.length}`, '')

  if (status.violations.length === 0) { lines.push('✅ No violations found!'); return lines.join('\n') }

  const byType = new Map<string, TransactionViolation[]>()
  for (const v of status.violations) { if (!byType.has(v.transactionType)) byType.set(v.transactionType, []); byType.get(v.transactionType)!.push(v) }

  lines.push('-'.repeat(80), 'VIOLATIONS BY TYPE:', '-'.repeat(80))
  for (const [type, typeViolations] of byType) {
    lines.push('', `## ${type.toUpperCase()} (${typeViolations.length} violations)`, '')
    for (const v of typeViolations) {
      lines.push(`  [${v.monthKey}] ID: ${v.transactionId}`, `    Violation: ${v.violation}`, `    Date: ${v.transactionDetails.date}`, `    Amount: ${v.transactionDetails.amount}`)
      if (v.transactionDetails.payee) lines.push(`    Payee: ${v.transactionDetails.payee}`)
      if (v.transactionDetails.description) lines.push(`    Description: ${v.transactionDetails.description}`)
      if (v.transactionDetails.accountId !== undefined) lines.push(`    Account ID: ${v.transactionDetails.accountId || '(empty)'}`)
      if (v.transactionDetails.categoryId !== undefined) lines.push(`    Category ID: ${v.transactionDetails.categoryId || '(empty)'}`)
      if (v.transactionDetails.fromAccountId !== undefined) {
        lines.push(`    From Account: ${v.transactionDetails.fromAccountId || '(empty)'}`, `    To Account: ${v.transactionDetails.toAccountId || '(empty)'}`, `    From Category: ${v.transactionDetails.fromCategoryId || '(empty)'}`, `    To Category: ${v.transactionDetails.toCategoryId || '(empty)'}`)
      }
      if (v.potentialSeedMatches.length > 0) {
        lines.push(`    POTENTIAL SEED MATCHES (${v.potentialSeedMatches.length}):`)
        for (const match of v.potentialSeedMatches.slice(0, 5)) { lines.push(`      - Line: ${match.rawLine}`, `        Type: ${match.recordType}, Date: ${match.date}, Payee: ${match.payee}`, `        Category: ${match.category}, Account: ${match.account}`) }
        if (v.potentialSeedMatches.length > 5) lines.push(`      ... and ${v.potentialSeedMatches.length - 5} more matches`)
      } else { lines.push(`    No seed matches found`) }
      lines.push('')
    }
  }
  return lines.join('\n')
}

interface UseAccountCategoryValidationOptions { currentUser: unknown }

export function useAccountCategoryValidation({ currentUser }: UseAccountCategoryValidationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [status, setStatus] = useState<ValidationStatus | null>(null)
  const [report, setReport] = useState<string | null>(null)

  async function scan(seedCsvContent?: string): Promise<void> {
    if (!currentUser) return
    setIsScanning(true); setStatus(null); setReport(null)
    try {
      const result = await scanTransactionViolations(seedCsvContent)
      setStatus(result); setReport(formatViolationReport(result))
    } catch (err) {
      console.error('Failed to scan transactions:', err)
      setReport(`Error scanning: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setIsScanning(false) }
  }

  return { isScanning, status, report, scan, hasViolations: status !== null && status.violations.length > 0, violationCount: status?.violations.length ?? 0 }
}
