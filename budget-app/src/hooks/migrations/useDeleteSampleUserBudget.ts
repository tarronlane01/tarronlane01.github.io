/**
 * Delete Sample User Budget Migration Hook
 * Deletes ALL budget data for sample@sample.com and resets to new user state.
 * WARNING: This is a destructive operation!
 */
import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports -- Migration requires direct Firestore access
import { batchDeleteDocs, deleteDocByPath, queryCollection, readDocByPath, writeDocByPath } from '@firestore'
// eslint-disable-next-line no-restricted-imports -- Type import
import type { UserDocument } from '@firestore'
import { clearAllCaches } from './migrationRunner'

const SAMPLE_USER_EMAIL = 'sample@sample.com'
const FALLBACK_SAMPLE_BUDGET_ID = 'budget_1767746876726_xuj7nzl4l' // Fallback if owner_email wasn't set

interface BudgetDocument { name: string; owner_email: string | null }

export interface SampleBudgetInfo {
  budgetId: string
  budgetName: string
  monthCount: number
}

export interface DeleteSampleUserBudgetStatus {
  budgets: SampleBudgetInfo[]
  totalBudgets: number
  totalMonths: number
  hasPayees: boolean
  // Stale budget IDs found in user document that reference non-existent budgets
  staleBudgetIds: string[]
}

export interface DeleteSampleUserBudgetResult {
  budgetsDeleted: number
  monthsDeleted: number
  payeesDeleted: number
  errors: string[]
}

export type DeleteSamplePhase = 'deleting-months' | 'deleting-payees' | 'deleting-budgets' | 'updating-user' | 'clearing-cache' | 'complete'

export interface DeleteSampleProgress {
  phase: DeleteSamplePhase
  monthsDeleted: number
  totalMonths: number
  budgetsDeleted: number
  totalBudgets: number
  percentComplete: number
}

interface UseDeleteSampleUserBudgetOptions {
  currentUser: { uid: string } | null | undefined
  onComplete?: () => void
}

export function useDeleteSampleUserBudget({
  currentUser,
  onComplete,
}: UseDeleteSampleUserBudgetOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [status, setStatus] = useState<DeleteSampleUserBudgetStatus | null>(null)
  const [deleteResult, setDeleteResult] = useState<DeleteSampleUserBudgetResult | null>(null)
  const [deleteProgress, setDeleteProgress] = useState<DeleteSampleProgress | null>(null)

  // Scan for sample user's budgets and months
  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      // Find all budgets owned by sample@sample.com
      const budgetsResult = await queryCollection<BudgetDocument>(
        'budgets',
        'delete sample user budget: scanning for sample user budgets',
        [{ field: 'owner_email', op: '==', value: SAMPLE_USER_EMAIL }]
      )

      // If no budgets found by owner_email, check fallback budget ID
      // (owner_email may not have been set correctly when budget was created)
      let budgetDocs = budgetsResult.docs
      if (budgetDocs.length === 0) {
        console.log('delete sample user budget: no budgets found by owner_email, checking fallback budget ID')
        const fallbackResult = await readDocByPath<BudgetDocument>(
          'budgets',
          FALLBACK_SAMPLE_BUDGET_ID,
          'delete sample user budget: checking fallback budget ID'
        )
        if (fallbackResult.exists && fallbackResult.data) {
          console.log('delete sample user budget: found fallback budget', FALLBACK_SAMPLE_BUDGET_ID)
          budgetDocs = [{ id: FALLBACK_SAMPLE_BUDGET_ID, data: fallbackResult.data }]
        }
      }

      const budgets: SampleBudgetInfo[] = []
      let totalMonths = 0
      let hasPayees = false

      for (const budgetDoc of budgetDocs) {
        const budgetId = budgetDoc.id
        const budgetName = budgetDoc.data.name

        // Count months for this budget
        const monthsResult = await queryCollection<{ budget_id: string }>(
          'months',
          `delete sample user budget: counting months for budget ${budgetId}`,
          [{ field: 'budget_id', op: '==', value: budgetId }]
        )

        const monthCount = monthsResult.docs.length
        totalMonths += monthCount

        budgets.push({
          budgetId,
          budgetName,
          monthCount,
        })

        // Check if payees document exists (query for any payees with this budget_id)
        const payeesResult = await queryCollection<{ budget_id: string }>(
          'payees',
          `delete sample user budget: checking payees for budget ${budgetId}`,
          [{ field: 'budget_id', op: '==', value: budgetId }]
        )

        if (payeesResult.docs.length > 0) {
          hasPayees = true
        }
      }

      // Also check if the sample@sample.com user has stale budget references (budget IDs in their document
      // that no longer exist as budget documents)
      const staleBudgetIds: string[] = []

      // Query for the sample user's document by email
      const sampleUserResult = await queryCollection<UserDocument>(
        'users',
        'delete sample user budget: finding sample user document',
        [{ field: 'email', op: '==', value: SAMPLE_USER_EMAIL }]
      )

      if (sampleUserResult.docs.length > 0) {
        const sampleUserDoc = sampleUserResult.docs[0]
        const sampleUserData = sampleUserDoc.data

        if (sampleUserData.budget_ids?.includes(FALLBACK_SAMPLE_BUDGET_ID)) {
          // Check if the fallback budget ID is in user's list but doesn't exist as a budget doc
          const budgetExists = budgets.some(b => b.budgetId === FALLBACK_SAMPLE_BUDGET_ID)
          if (!budgetExists) {
            console.log('delete sample user budget: found stale budget reference in sample user document', FALLBACK_SAMPLE_BUDGET_ID)
            staleBudgetIds.push(FALLBACK_SAMPLE_BUDGET_ID)
          }
        }
      }

      setStatus({
        budgets,
        totalBudgets: budgets.length,
        totalMonths,
        hasPayees,
        staleBudgetIds,
      })
    } catch (error) {
      console.error('Error scanning for sample user budgets:', error)
    } finally {
      setIsScanning(false)
    }
  }

  async function deleteSampleUserBudget() {
    if (!currentUser) return
    // Allow running if there are budgets to delete OR stale budget IDs to clean up
    if (!status || (status.budgets.length === 0 && status.staleBudgetIds.length === 0)) return

    setIsDeleting(true)
    setDeleteResult(null)

    const errors: string[] = []
    let monthsDeleted = 0
    let budgetsDeleted = 0
    let payeesDeleted = 0

    const totalMonths = status.totalMonths
    const totalBudgets = status.totalBudgets

    // Phase 1: Delete all months (0-60% of progress)
    setDeleteProgress({
      phase: 'deleting-months',
      monthsDeleted: 0,
      totalMonths,
      budgetsDeleted: 0,
      totalBudgets,
      percentComplete: 0,
    })

    for (const budgetInfo of status.budgets) {
      try {
        // Get all month document IDs for this budget
        const monthsResult = await queryCollection<{ budget_id: string }>(
          'months',
          `delete sample user budget: fetching month IDs for budget ${budgetInfo.budgetId}`
        )

        const monthDocsToDelete = monthsResult.docs
          .filter(doc => {
            const data = doc.data as { budget_id?: string }
            return data.budget_id === budgetInfo.budgetId
          })
          .map(doc => ({
            collectionPath: 'months',
            docId: doc.id,
          }))

        if (monthDocsToDelete.length > 0) {
          await batchDeleteDocs(
            monthDocsToDelete,
            `delete sample user budget: deleting ${monthDocsToDelete.length} months for budget ${budgetInfo.budgetId}`,
            (deletedSoFar) => {
              monthsDeleted = deletedSoFar
              setDeleteProgress({
                phase: 'deleting-months',
                monthsDeleted,
                totalMonths,
                budgetsDeleted,
                totalBudgets,
                percentComplete: Math.round((monthsDeleted / Math.max(totalMonths, 1)) * 60),
              })
            }
          )
          monthsDeleted = monthDocsToDelete.length
        }
      } catch (err) {
        errors.push(`Failed to delete months for budget ${budgetInfo.budgetId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // Phase 2: Delete payees documents (60-70% of progress)
    setDeleteProgress({
      phase: 'deleting-payees',
      monthsDeleted,
      totalMonths,
      budgetsDeleted,
      totalBudgets,
      percentComplete: 60,
    })

    for (const budgetInfo of status.budgets) {
      try {
        // Payees document has the same ID as the budget
        await deleteDocByPath(
          'payees',
          budgetInfo.budgetId,
          `delete sample user budget: deleting payees for budget ${budgetInfo.budgetId}`
        )
        payeesDeleted++
      } catch {
        // Payees doc might not exist, which is fine
      }
    }

    // Phase 3: Delete budget documents (70-80% of progress)
    setDeleteProgress({
      phase: 'deleting-budgets',
      monthsDeleted,
      totalMonths,
      budgetsDeleted,
      totalBudgets,
      percentComplete: 70,
    })

    for (const budgetInfo of status.budgets) {
      try {
        await deleteDocByPath(
          'budgets',
          budgetInfo.budgetId,
          `delete sample user budget: deleting budget ${budgetInfo.budgetId}`
        )
        budgetsDeleted++

        setDeleteProgress({
          phase: 'deleting-budgets',
          monthsDeleted,
          totalMonths,
          budgetsDeleted,
          totalBudgets,
          percentComplete: 70 + Math.round((budgetsDeleted / totalBudgets) * 10),
        })
      } catch (err) {
        errors.push(`Failed to delete budget ${budgetInfo.budgetId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // Phase 4: Update user document to remove deleted budget IDs (75-90%)
    setDeleteProgress({
      phase: 'updating-user',
      monthsDeleted,
      totalMonths,
      budgetsDeleted,
      totalBudgets,
      percentComplete: 80,
    })

    // Combine deleted budget IDs with stale budget IDs that need to be removed from user doc
    const budgetIdsToRemove = [
      ...status.budgets.map(b => b.budgetId),
      ...status.staleBudgetIds,
    ]
    try {
      // Query for the sample user's document by email
      const sampleUserResult = await queryCollection<UserDocument>(
        'users',
        'delete sample user budget: finding sample user document to remove budget references',
        [{ field: 'email', op: '==', value: SAMPLE_USER_EMAIL }]
      )

      if (sampleUserResult.docs.length > 0) {
        const sampleUserDoc = sampleUserResult.docs[0]
        const sampleUserId = sampleUserDoc.id
        const sampleUserData = sampleUserDoc.data

        const updatedBudgetIds = (sampleUserData.budget_ids || []).filter(id => !budgetIdsToRemove.includes(id))

        await writeDocByPath(
          'users',
          sampleUserId,
          {
            ...sampleUserData,
            budget_ids: updatedBudgetIds,
            updated_at: new Date().toISOString(),
          },
          'delete sample user budget: removing deleted budget IDs from sample user document'
        )
        console.log(`delete sample user budget: removed ${budgetIdsToRemove.length} budget IDs from sample user document`)
      } else {
        console.log('delete sample user budget: no sample user document found, skipping user update')
      }
    } catch (err) {
      errors.push(`Failed to update sample user document: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    // Phase 5: Clear cache (90-100%)
    setDeleteProgress({
      phase: 'clearing-cache',
      monthsDeleted,
      totalMonths,
      budgetsDeleted,
      totalBudgets,
      percentComplete: 95,
    })

    clearAllCaches()

    // Final progress update
    setDeleteProgress({
      phase: 'complete',
      monthsDeleted,
      totalMonths,
      budgetsDeleted,
      totalBudgets,
      percentComplete: 100,
    })

    setDeleteResult({
      budgetsDeleted,
      monthsDeleted,
      payeesDeleted,
      errors,
    })
    setIsDeleting(false)
    setDeleteProgress(null)

    // Clear the status and trigger onComplete only on success (no errors)
    if (errors.length === 0) {
      setStatus({
        budgets: [],
        totalBudgets: 0,
        totalMonths: 0,
        hasPayees: false,
        staleBudgetIds: [],
      })
      onComplete?.()
    }
  }

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    // Delete
    isDeleting,
    deleteResult,
    deleteProgress,
    deleteSampleUserBudget,
  }
}

