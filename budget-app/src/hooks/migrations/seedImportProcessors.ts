/**
 * Seed Import Processors
 *
 * Functions for processing income, spend, and allocation rows during import.
 */

import type { MonthDocument, IncomeTransaction, ExpenseTransaction, CategoryMonthBalance } from '../../data/firestore/types'
import type { CategoriesMap, AccountsMap } from '../../contexts/budget_context'
import type { ParsedSeedRow, MappingEntry } from './seedImportTypes'
import { formatDateForStorage } from './seedImportParser'
import { retotalMonth } from '../../data/mutations/month/retotalMonth'
import { NO_ACCOUNT_ID, NO_CATEGORY_ID } from '../../data/constants'

// Common N/A values that should map to special accounts/categories
const NA_VALUES = ['n/a', 'na', 'none', '-', '']

// =============================================================================
// ENTITY RESOLUTION
// =============================================================================

/**
 * Look up entity ID by name (case-insensitive)
 */
function findEntityIdByName(
  name: string,
  entities: CategoriesMap | AccountsMap,
  isAccount: boolean
): string | null {
  const lowerName = name.toLowerCase()
  for (const [id, entity] of Object.entries(entities)) {
    const entityName = isAccount
      ? (entity as AccountsMap[string]).nickname
      : (entity as CategoriesMap[string]).name
    if (entityName.toLowerCase() === lowerName) {
      return id
    }
  }
  return null
}

/**
 * Resolve category ID from name (checking mappings first)
 */
export function resolveCategoryId(
  name: string,
  categories: CategoriesMap,
  mappings: Map<string, MappingEntry>
): string | null {
  // Auto-map N/A values to the special "No Category"
  if (NA_VALUES.includes(name.toLowerCase().trim())) {
    return NO_CATEGORY_ID
  }

  // Check mappings first
  const mapping = mappings.get(name)
  if (mapping) return mapping.newId

  // Try to find by name (case-insensitive)
  return findEntityIdByName(name, categories, false)
}

/**
 * Resolve account ID from name (checking mappings first)
 */
export function resolveAccountId(
  name: string,
  accounts: AccountsMap,
  mappings: Map<string, MappingEntry>
): string | null {
  // Auto-map N/A values to the special "No Account"
  if (NA_VALUES.includes(name.toLowerCase().trim())) {
    return NO_ACCOUNT_ID
  }

  // Check mappings first
  const mapping = mappings.get(name)
  if (mapping) return mapping.newId

  // Try to find by name (case-insensitive)
  return findEntityIdByName(name, accounts, true)
}

// =============================================================================
// ROW PROCESSORS
// =============================================================================

interface ProcessResult {
  monthData: MonthDocument
  imported: number
  skipped: number
  errors: string[]
  cleared: number
}

/**
 * Process income rows
 * NOTE: This REPLACES all existing income in the month with the imported data
 */
export function processIncomeRows(
  rows: ParsedSeedRow[],
  monthData: MonthDocument,
  accounts: AccountsMap,
  accountMappings: Map<string, MappingEntry>
): ProcessResult {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Track how many existing records we're replacing
  const cleared = monthData.income.length

  // Start with empty array - REPLACE existing income
  const newIncome: IncomeTransaction[] = []

  for (const row of rows) {
    // Resolve account ID
    const accountId = resolveAccountId(row.account, accounts, accountMappings)
    if (!accountId) {
      errors.push(`Unknown account "${row.account}" for income on ${row.date}`)
      skipped++
      continue
    }

    // Create income transaction (preserve sign from input file)
    const transaction: IncomeTransaction = {
      id: `income_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: row.amount,
      account_id: accountId,
      date: formatDateForStorage(row.year, row.month, row.day),
      payee: row.payee,
      description: row.description,
      cleared: row.cleared,
      created_at: new Date().toISOString(),
    }

    newIncome.push(transaction)
    imported++
  }

  // Re-total the month
  const updatedMonth = retotalMonth({
    ...monthData,
    income: newIncome,
    updated_at: new Date().toISOString(),
  })

  return { monthData: updatedMonth, imported, skipped, errors, cleared }
}

/**
 * Process spend rows
 * NOTE: This REPLACES all existing expenses in the month with the imported data
 */
export function processSpendRows(
  rows: ParsedSeedRow[],
  monthData: MonthDocument,
  categories: CategoriesMap,
  accounts: AccountsMap,
  categoryMappings: Map<string, MappingEntry>,
  accountMappings: Map<string, MappingEntry>
): ProcessResult {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Track how many existing records we're replacing
  const cleared = monthData.expenses.length

  // Start with empty array - REPLACE existing expenses
  const newExpenses: ExpenseTransaction[] = []

  for (const row of rows) {
    // Resolve category ID
    const categoryId = resolveCategoryId(row.category, categories, categoryMappings)
    if (!categoryId) {
      errors.push(`Unknown category "${row.category}" for expense on ${row.date}`)
      skipped++
      continue
    }

    // Resolve account ID
    const accountId = resolveAccountId(row.account, accounts, accountMappings)
    if (!accountId) {
      errors.push(`Unknown account "${row.account}" for expense on ${row.date}`)
      skipped++
      continue
    }

    // Create expense transaction (preserve sign from input file)
    const transaction: ExpenseTransaction = {
      id: `expense_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: row.amount,
      category_id: categoryId,
      account_id: accountId,
      date: formatDateForStorage(row.year, row.month, row.day),
      payee: row.payee,
      description: row.description,
      cleared: row.cleared,
      created_at: new Date().toISOString(),
    }

    newExpenses.push(transaction)
    imported++
  }

  // Re-total the month
  const updatedMonth = retotalMonth({
    ...monthData,
    expenses: newExpenses,
    updated_at: new Date().toISOString(),
  })

  return { monthData: updatedMonth, imported, skipped, errors, cleared }
}

/**
 * Process allocation rows
 * NOTE: This REPLACES all existing allocations in the month with the imported data
 */
export function processAllocationRows(
  rows: ParsedSeedRow[],
  monthData: MonthDocument,
  categories: CategoriesMap,
  categoryMappings: Map<string, MappingEntry>
): ProcessResult {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Count existing allocations that will be cleared
  const cleared = monthData.category_balances.filter(cb => cb.allocated > 0).length

  // Build allocation amounts by category
  const allocationsByCategory = new Map<string, number>()

  for (const row of rows) {
    // Resolve category ID
    const categoryId = resolveCategoryId(row.category, categories, categoryMappings)
    if (!categoryId) {
      errors.push(`Unknown category "${row.category}" for allocation on ${row.date}`)
      skipped++
      continue
    }

    // Accumulate allocations for this category (preserve sign from input file)
    const currentAmount = allocationsByCategory.get(categoryId) || 0
    allocationsByCategory.set(categoryId, currentAmount + row.amount)
    imported++
  }

  // REPLACE existing allocations - reset all to 0 first, then apply new ones
  const updatedCategoryBalances: CategoryMonthBalance[] = monthData.category_balances.map(cb => {
    const allocation = allocationsByCategory.get(cb.category_id)
    if (allocation !== undefined) {
      // This category has imported allocation data - use it
      return {
        ...cb,
        allocated: allocation, // REPLACE, not add
        end_balance: cb.start_balance + allocation - cb.spent,
      }
    }
    // This category has no imported data - clear its allocation
    return {
      ...cb,
      allocated: 0,
      end_balance: cb.start_balance - cb.spent,
    }
  })

  // Add any categories that weren't in the existing balances
  for (const [categoryId, amount] of allocationsByCategory) {
    if (!updatedCategoryBalances.find(cb => cb.category_id === categoryId)) {
      updatedCategoryBalances.push({
        category_id: categoryId,
        start_balance: 0,
        allocated: amount,
        spent: 0,
        end_balance: amount,
      })
    }
  }

  return {
    monthData: {
      ...monthData,
      category_balances: updatedCategoryBalances,
      are_allocations_finalized: true, // Mark month as finalized when importing allocations
      updated_at: new Date().toISOString(),
    },
    imported,
    skipped,
    errors,
    cleared,
  }
}

// =============================================================================
// MAPPING HELPERS
// =============================================================================

/**
 * Find entities in parsed data that don't exist in current budget.
 * Now handles combined imports where each row has its own recordType.
 */
export function findUnmappedEntities(
  rows: ParsedSeedRow[],
  categories: CategoriesMap,
  accounts: AccountsMap,
  existingCategoryMappings: Map<string, MappingEntry>,
  existingAccountMappings: Map<string, MappingEntry>
): { unmappedCategories: string[]; unmappedAccounts: string[] } {
  const categoryNames = new Set(Object.values(categories).map(c => c.name.toLowerCase()))
  const accountNames = new Set(Object.values(accounts).map(a => a.nickname.toLowerCase()))

  const unmappedCategories = new Set<string>()
  const unmappedAccounts = new Set<string>()

  for (const row of rows) {
    // Check categories (for spend and allocation records)
    if (row.recordType === 'spend' || row.recordType === 'allocation') {
      const catName = row.category.toLowerCase().trim()
      const isKnown = categoryNames.has(catName)
      const isMapped = existingCategoryMappings.has(row.category)
      const isNAValue = NA_VALUES.includes(catName)
      // Skip N/A values - they auto-map to "No Category"
      if (!isKnown && !isMapped && !isNAValue && row.category) {
        unmappedCategories.add(row.category)
      }
    }

    // Check accounts (for spend and income records)
    if (row.recordType === 'spend' || row.recordType === 'income') {
      const accName = row.account.toLowerCase().trim()
      const isKnown = accountNames.has(accName)
      const isMapped = existingAccountMappings.has(row.account)
      const isNAValue = NA_VALUES.includes(accName)
      // Skip N/A values - they auto-map to No Account
      if (!isKnown && !isMapped && !isNAValue && row.account) {
        unmappedAccounts.add(row.account)
      }
    }
  }

  return {
    unmappedCategories: Array.from(unmappedCategories).sort(),
    unmappedAccounts: Array.from(unmappedAccounts).sort(),
  }
}

