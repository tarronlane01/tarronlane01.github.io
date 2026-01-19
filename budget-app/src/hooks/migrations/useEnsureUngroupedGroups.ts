/**
 * Ensure Ungrouped Groups Migration
 *
 * Simple migration that ensures all budgets have the default ungrouped groups
 * for accounts and categories. Uses direct Firebase commands for simplicity.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore'
// eslint-disable-next-line no-restricted-imports
import app from '@firestore/app'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { UNGROUPED_ACCOUNT_GROUP_ID, UNGROUPED_CATEGORY_GROUP_ID } from '@constants'
import type { FirestoreData } from '@types'

// Type for category group in raw Firestore data (array format)
interface CategoryGroupData {
  id: string
  name?: string
  sort_order?: number
  [key: string]: unknown
}

export interface EnsureUngroupedGroupsStatus {
  totalBudgets: number
  budgetsNeedingUpdate: number
}

export interface EnsureUngroupedGroupsResult {
  budgetsProcessed: number
  budgetsUpdated: number
  errors: string[]
}

/**
 * Scan all budgets to see which ones need ungrouped groups
 */
export async function scanEnsureUngroupedGroupsStatus(): Promise<EnsureUngroupedGroupsStatus> {
  const db = getFirestore(app)
  const budgetsRef = collection(db, 'budgets')
  const snapshot = await getDocs(budgetsRef)

  let budgetsNeedingUpdate = 0

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data()

    // Check if ungrouped account group exists
    const accountGroups = data.account_groups || {}
    const hasUngroupedAccountGroup = accountGroups[UNGROUPED_ACCOUNT_GROUP_ID] !== undefined

    // Check if ungrouped category group exists
    const categoryGroups = Array.isArray(data.category_groups) ? data.category_groups as CategoryGroupData[] : []
    const hasUngroupedCategoryGroup = categoryGroups.some(
      (g: CategoryGroupData) => g && g.id === UNGROUPED_CATEGORY_GROUP_ID
    )

    if (!hasUngroupedAccountGroup || !hasUngroupedCategoryGroup) {
      budgetsNeedingUpdate++
    }
  })

  return {
    totalBudgets: snapshot.size,
    budgetsNeedingUpdate,
  }
}

/**
 * Run the migration to ensure all budgets have ungrouped groups
 */
export async function runEnsureUngroupedGroupsMigration(
  progress: ProgressReporter
): Promise<EnsureUngroupedGroupsResult> {
  const result: EnsureUngroupedGroupsResult = {
    budgetsProcessed: 0,
    budgetsUpdated: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets...')
  progress.setProgress(null)

  const db = getFirestore(app)
  const budgetsRef = collection(db, 'budgets')
  const snapshot = await getDocs(budgetsRef)

  progress.setDetails(`Found ${snapshot.size} budget(s) to process`)

  const budgetsToUpdate: Array<{ id: string; name: string; updates: FirestoreData }> = []

  progress.setStage('Scanning budgets...')

  let index = 0
  snapshot.forEach((docSnapshot) => {
    index++
    progress.updateItemProgress(index, snapshot.size, `Budget: ${docSnapshot.data().name || docSnapshot.id}`)

    const data = docSnapshot.data()
    const updates: FirestoreData = {}
    let needsUpdate = false

    // Check and add ungrouped account group if missing
    const accountGroups = data.account_groups || {}
    if (!accountGroups[UNGROUPED_ACCOUNT_GROUP_ID]) {
      updates.account_groups = {
        ...accountGroups,
        [UNGROUPED_ACCOUNT_GROUP_ID]: {
          name: 'Ungrouped',
          sort_order: 0,
          expected_balance: 'positive',
          on_budget: null,
          is_active: null,
        },
      }
      needsUpdate = true
    }

    // Check and add ungrouped category group if missing
    const categoryGroups = Array.isArray(data.category_groups) ? data.category_groups as CategoryGroupData[] : []
    const hasUngroupedCategoryGroup = categoryGroups.some(
      (g: CategoryGroupData) => g && g.id === UNGROUPED_CATEGORY_GROUP_ID
    )

    if (!hasUngroupedCategoryGroup) {
      updates.category_groups = [
        ...categoryGroups,
        {
          id: UNGROUPED_CATEGORY_GROUP_ID,
          name: 'Uncategorized',
          sort_order: 0,
        },
      ]
      needsUpdate = true
    }

    if (needsUpdate) {
      budgetsToUpdate.push({
        id: docSnapshot.id,
        name: data.name || docSnapshot.id,
        updates,
      })
    }

    result.budgetsProcessed++
  })

  // Write updates
  if (budgetsToUpdate.length > 0) {
    progress.setStage(`Updating ${budgetsToUpdate.length} budget(s)...`)
    progress.setProgress(null)

    for (let i = 0; i < budgetsToUpdate.length; i++) {
      const budget = budgetsToUpdate[i]
      progress.updateItemProgress(i + 1, budgetsToUpdate.length, `Updating: ${budget.name}`)

      try {
        const budgetRef = doc(db, 'budgets', budget.id)
        await updateDoc(budgetRef, {
          ...budget.updates,
          updated_at: new Date().toISOString(),
        })
        result.budgetsUpdated++
      } catch (error) {
        const errorMsg = `Failed to update budget ${budget.id}: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        console.error('[runEnsureUngroupedGroupsMigration]', errorMsg, error)
      }
    }
  } else {
    progress.setStage('No updates needed')
    progress.setProgress(null)
  }

  progress.setStage('Complete')
  progress.setProgress(100)

  return result
}

/**
 * Hook for running the Ensure Ungrouped Groups migration
 */
export function useEnsureUngroupedGroups() {
  const [status, setStatus] = useState<EnsureUngroupedGroupsStatus | null>(null)
  const [result, setResult] = useState<EnsureUngroupedGroupsResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const { runMigrationWithProgress } = useMigrationProgress()

  const scanStatus = async () => {
    setIsScanning(true)
    setStatus(null)
    setResult(null)
    try {
      const scanResult = await scanEnsureUngroupedGroupsStatus()
      setStatus(scanResult)
    } catch (error) {
      console.error('[useEnsureUngroupedGroups] Scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const runMigration = async () => {
    setIsRunning(true)
    setResult(null)
    try {
      const migrationResult = await runMigrationWithProgress(
        'Ensure Ungrouped Groups Migration',
        (progress) => runEnsureUngroupedGroupsMigration(progress)
      )
      setResult(migrationResult)
    } catch (error) {
      console.error('[useEnsureUngroupedGroups] Migration failed:', error)
      setResult({
        budgetsProcessed: 0,
        budgetsUpdated: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      })
    } finally {
      setIsRunning(false)
    }
  }

  return {
    status,
    result,
    isScanning,
    isRunning,
    scanStatus,
    runMigration,
  }
}

