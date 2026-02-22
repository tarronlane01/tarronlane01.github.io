/**
 * Budget Inspector - One-time diagnostic tool
 * 
 * Reads a specific budget by ID and reports on its state for debugging.
 * This is a READ-ONLY operation.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports -- diagnostic tool needs direct Firestore read
import { readDocByPath } from '@firestore'
import type { FirestoreData } from '@types'

export interface BudgetInspectorResult {
  budgetId: string
  exists: boolean
  rawData: FirestoreData | null
  analysis: {
    hasName: boolean
    hasAccounts: boolean
    hasCategories: boolean
    hasCategoryGroups: boolean
    hasAccountGroups: boolean
    hasMonthMap: boolean
    monthMapKeys: string[]
    accountCount: number
    categoryCount: number
    categoryGroupCount: number
    accountGroupCount: number
    ownerUserId: string | null
    sharedWith: string[]
    totalAvailable: number | null
    createdAt: string | null
    updatedAt: string | null
  }
  monthDocuments: Array<{
    monthId: string
    exists: boolean
    year: number
    month: number
    hasIncome: boolean
    hasExpenses: boolean
    hasTransfers: boolean
    hasAdjustments: boolean
    incomeCount: number
    expenseCount: number
    transferCount: number
    adjustmentCount: number
    areAllocationsFinalized: boolean
  }>
  payeesDocument: {
    exists: boolean
    payeeCount: number
  } | null
  issues: string[]
  recommendations: string[]
}

export function useBudgetInspector() {
  const [isInspecting, setIsInspecting] = useState(false)
  const [result, setResult] = useState<BudgetInspectorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function inspectBudget(budgetId: string): Promise<BudgetInspectorResult | null> {
    if (!budgetId.trim()) {
      setError('Budget ID is required')
      return null
    }

    setIsInspecting(true)
    setError(null)
    setResult(null)

    try {
      const issues: string[] = []
      const recommendations: string[] = []

      // 1. Read the budget document
      console.log(`[BudgetInspector] Reading budget: ${budgetId}`)
      const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'budget-inspector: reading budget'
      )

      if (!exists || !budgetData) {
        const notFoundResult: BudgetInspectorResult = {
          budgetId,
          exists: false,
          rawData: null,
          analysis: {
            hasName: false,
            hasAccounts: false,
            hasCategories: false,
            hasCategoryGroups: false,
            hasAccountGroups: false,
            hasMonthMap: false,
            monthMapKeys: [],
            accountCount: 0,
            categoryCount: 0,
            categoryGroupCount: 0,
            accountGroupCount: 0,
            ownerUserId: null,
            sharedWith: [],
            totalAvailable: null,
            createdAt: null,
            updatedAt: null,
          },
          monthDocuments: [],
          payeesDocument: null,
          issues: ['Budget document does not exist in Firestore'],
          recommendations: ['Delete this budget from user documents or restore from backup'],
        }
        setResult(notFoundResult)
        return notFoundResult
      }

      // 2. Analyze budget structure
      const accounts = budgetData.accounts as Record<string, unknown> | undefined
      const categories = budgetData.categories as Record<string, unknown> | undefined
      const categoryGroups = budgetData.category_groups as Record<string, unknown> | undefined
      const accountGroups = budgetData.account_groups as Record<string, unknown> | undefined
      const monthMap = budgetData.month_map as Record<string, unknown> | undefined

      const hasName = typeof budgetData.name === 'string' && budgetData.name.length > 0
      const hasAccounts = !!accounts && Object.keys(accounts).length > 0
      const hasCategories = !!categories && Object.keys(categories).length > 0
      const hasCategoryGroups = !!categoryGroups && Object.keys(categoryGroups).length > 0
      const hasAccountGroups = !!accountGroups && Object.keys(accountGroups).length > 0
      const hasMonthMap = !!monthMap && Object.keys(monthMap).length > 0

      if (!hasName) issues.push('Budget has no name')
      if (!hasAccounts) issues.push('Budget has no accounts defined')
      if (!hasCategories) issues.push('Budget has no categories defined')
      if (!hasMonthMap) issues.push('Budget has no month_map - cannot navigate to any months')

      // 3. Read month documents based on month_map
      const monthDocuments: BudgetInspectorResult['monthDocuments'] = []
      const monthMapKeys = hasMonthMap ? Object.keys(monthMap).sort() : []

      for (const ordinal of monthMapKeys) {
        const year = parseInt(ordinal.slice(0, 4), 10)
        const month = parseInt(ordinal.slice(4, 6), 10)
        const monthDocId = `${budgetId}_${year}_${month}`

        try {
          const { exists: monthExists, data: monthData } = await readDocByPath<FirestoreData>(
            'months',
            monthDocId,
            `budget-inspector: reading month ${year}/${month}`
          )

          if (monthExists && monthData) {
            const income = monthData.income as Array<unknown> | undefined
            const expenses = monthData.expenses as Array<unknown> | undefined
            const transfers = monthData.transfers as Array<unknown> | undefined
            const adjustments = monthData.adjustments as Array<unknown> | undefined

            monthDocuments.push({
              monthId: monthDocId,
              exists: true,
              year,
              month,
              hasIncome: !!income && income.length > 0,
              hasExpenses: !!expenses && expenses.length > 0,
              hasTransfers: !!transfers && transfers.length > 0,
              hasAdjustments: !!adjustments && adjustments.length > 0,
              incomeCount: income?.length ?? 0,
              expenseCount: expenses?.length ?? 0,
              transferCount: transfers?.length ?? 0,
              adjustmentCount: adjustments?.length ?? 0,
              areAllocationsFinalized: monthData.are_allocations_finalized === true,
            })
          } else {
            monthDocuments.push({
              monthId: monthDocId,
              exists: false,
              year,
              month,
              hasIncome: false,
              hasExpenses: false,
              hasTransfers: false,
              hasAdjustments: false,
              incomeCount: 0,
              expenseCount: 0,
              transferCount: 0,
              adjustmentCount: 0,
              areAllocationsFinalized: false,
            })
            issues.push(`Month ${year}/${month} is in month_map but document does not exist`)
          }
        } catch (err) {
          issues.push(`Failed to read month ${year}/${month}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      // 4. Read payees document
      let payeesDocument: BudgetInspectorResult['payeesDocument'] = null
      try {
        const { exists: payeesExist, data: payeesData } = await readDocByPath<FirestoreData>(
          'payees',
          budgetId,
          'budget-inspector: reading payees'
        )
        if (payeesExist && payeesData) {
          const payeesList = payeesData.payees as Array<unknown> | undefined
          payeesDocument = {
            exists: true,
            payeeCount: payeesList?.length ?? 0,
          }
        } else {
          payeesDocument = { exists: false, payeeCount: 0 }
        }
      } catch {
        payeesDocument = { exists: false, payeeCount: 0 }
      }

      // 5. Generate recommendations
      if (!hasMonthMap) {
        recommendations.push('Run "Repair Month Map" migration to rebuild month_map from existing month documents')
        recommendations.push('Or delete this budget and re-upload from backup')
      }

      if (monthDocuments.some(m => !m.exists)) {
        recommendations.push('Some months in month_map do not have corresponding documents - consider running recalculation')
      }

      if (!hasAccounts || !hasCategories) {
        recommendations.push('Budget is missing essential data - consider restoring from backup or deleting')
      }

      const inspectorResult: BudgetInspectorResult = {
        budgetId,
        exists: true,
        rawData: budgetData,
        analysis: {
          hasName,
          hasAccounts,
          hasCategories,
          hasCategoryGroups,
          hasAccountGroups,
          hasMonthMap,
          monthMapKeys,
          accountCount: accounts ? Object.keys(accounts).length : 0,
          categoryCount: categories ? Object.keys(categories).length : 0,
          categoryGroupCount: categoryGroups ? Object.keys(categoryGroups).length : 0,
          accountGroupCount: accountGroups ? Object.keys(accountGroups).length : 0,
          ownerUserId: budgetData.owner_user_id as string | null,
          sharedWith: (budgetData.shared_with as string[]) ?? [],
          totalAvailable: budgetData.total_available as number | null ?? null,
          createdAt: budgetData.created_at as string | null ?? null,
          updatedAt: budgetData.updated_at as string | null ?? null,
        },
        monthDocuments,
        payeesDocument,
        issues,
        recommendations,
      }

      console.log('[BudgetInspector] Complete:', inspectorResult)
      setResult(inspectorResult)
      return inspectorResult
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      console.error('[BudgetInspector] Error:', errorMsg)
      return null
    } finally {
      setIsInspecting(false)
    }
  }

  function downloadResult() {
    if (!result) return

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-inspection-${result.budgetId}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function clearResult() {
    setResult(null)
    setError(null)
  }

  return {
    isInspecting,
    result,
    error,
    inspectBudget,
    downloadResult,
    clearResult,
  }
}
