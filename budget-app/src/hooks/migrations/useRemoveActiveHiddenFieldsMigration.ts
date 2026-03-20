/**
 * Remove Active/Hidden Fields Migration
 *
 * This one-time migration removes deprecated fields from budget documents:
 * - Account-level: is_active, is_hidden
 * - AccountGroup-level: is_active
 *
 * Before removing, migrates semantics to on_budget:
 * - Accounts with is_hidden === true → set on_budget = false
 * - Accounts with is_active === false → set on_budget = false
 * - AccountGroups with is_active === false → set on_budget = false (if on_budget isn't already set)
 */

import { useState } from 'react'
import type { FirestoreData } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgets } from './migrationDataHelpers'
// eslint-disable-next-line no-restricted-imports
import { updateDocByPath } from '@firestore'
import { cleanForFirestore } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

export interface RemoveActiveHiddenFieldsMigrationStatus {
  totalBudgets: number
  budgetsWithLegacyFields: number
  accountsWithIsHidden: number
  accountsWithIsActiveFalse: number
  groupsWithIsActive: number
}

export interface RemoveActiveHiddenFieldsMigrationResult {
  budgetsProcessed: number
  budgetsUpdated: number
  accountsMigratedToOffBudget: number
  groupFieldsRemoved: number
  errors: string[]
}

// ============================================================================
// HELPERS
// ============================================================================

function scanBudgetForLegacyFields(budgetData: FirestoreData): {
  hasLegacy: boolean
  accountsHidden: number
  accountsInactive: number
  groupsWithActive: number
} {
  let accountsHidden = 0
  let accountsInactive = 0
  let groupsWithActive = 0

  const accounts = budgetData.accounts as Record<string, FirestoreData> | undefined
  if (accounts && typeof accounts === 'object') {
    for (const account of Object.values(accounts)) {
      if (account.is_hidden === true) accountsHidden++
      if (account.is_active === false) accountsInactive++
    }
  }

  const accountGroups = budgetData.account_groups as Record<string, FirestoreData> | undefined
  if (accountGroups && typeof accountGroups === 'object' && !Array.isArray(accountGroups)) {
    for (const group of Object.values(accountGroups)) {
      if (group.is_active !== undefined) groupsWithActive++
    }
  }

  // Also check array format (sample budgets)
  if (Array.isArray(budgetData.account_groups)) {
    for (const group of budgetData.account_groups as FirestoreData[]) {
      if (group.is_active !== undefined) groupsWithActive++
    }
  }

  const hasLegacy = accountsHidden > 0 || accountsInactive > 0 || groupsWithActive > 0
    || hasAnyAccountField(accounts, 'is_hidden') || hasAnyAccountField(accounts, 'is_active')
  return { hasLegacy, accountsHidden, accountsInactive, groupsWithActive }
}

function hasAnyAccountField(
  accounts: Record<string, FirestoreData> | undefined,
  field: string
): boolean {
  if (!accounts || typeof accounts !== 'object') return false
  return Object.values(accounts).some(a => field in a)
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

export async function scanRemoveActiveHiddenFieldsStatus(): Promise<RemoveActiveHiddenFieldsMigrationStatus> {
  const budgets = await readAllBudgets('remove-active-hidden-fields-scan')

  let budgetsWithLegacyFields = 0
  let accountsWithIsHidden = 0
  let accountsWithIsActiveFalse = 0
  let groupsWithIsActive = 0

  for (const budget of budgets) {
    const scan = scanBudgetForLegacyFields(budget.data as FirestoreData)
    if (scan.hasLegacy) budgetsWithLegacyFields++
    accountsWithIsHidden += scan.accountsHidden
    accountsWithIsActiveFalse += scan.accountsInactive
    groupsWithIsActive += scan.groupsWithActive
  }

  return {
    totalBudgets: budgets.length,
    budgetsWithLegacyFields,
    accountsWithIsHidden,
    accountsWithIsActiveFalse,
    groupsWithIsActive,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

export async function runRemoveActiveHiddenFieldsMigration(
  progress: ProgressReporter
): Promise<RemoveActiveHiddenFieldsMigrationResult> {
  const result: RemoveActiveHiddenFieldsMigrationResult = {
    budgetsProcessed: 0,
    budgetsUpdated: 0,
    accountsMigratedToOffBudget: 0,
    groupFieldsRemoved: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets...')
  progress.setProgress(null)

  const budgets = await readAllBudgets('remove-active-hidden-fields-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  progress.setStage('Processing budgets...')

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    progress.updateItemProgress(i + 1, budgets.length, `Budget: ${budget.id.slice(0, 20)}`)

    try {
      const budgetData = budget.data as FirestoreData
      const scan = scanBudgetForLegacyFields(budgetData)

      if (!scan.hasLegacy) {
        result.budgetsProcessed++
        continue
      }

      // Build updated accounts map
      const accounts = { ...(budgetData.accounts as Record<string, FirestoreData> || {}) }
      let accountsChanged = false

      for (const [accountId, account] of Object.entries(accounts)) {
        const updates: FirestoreData = {}

        // Migrate is_hidden === true → on_budget = false
        if (account.is_hidden === true && account.on_budget !== false) {
          updates.on_budget = false
          result.accountsMigratedToOffBudget++
        }

        // Migrate is_active === false → on_budget = false
        if (account.is_active === false && account.on_budget !== false) {
          updates.on_budget = false
          result.accountsMigratedToOffBudget++
        }

        // Remove the fields
        if ('is_hidden' in account || 'is_active' in account) {
          const cleaned = { ...account, ...updates }
          delete cleaned.is_hidden
          delete cleaned.is_active
          accounts[accountId] = cleaned
          accountsChanged = true
        } else if (Object.keys(updates).length > 0) {
          accounts[accountId] = { ...account, ...updates }
          accountsChanged = true
        }
      }

      // Build updated account_groups (object format)
      let groupsChanged = false
      const updateData: FirestoreData = {}

      if (budgetData.account_groups && typeof budgetData.account_groups === 'object' && !Array.isArray(budgetData.account_groups)) {
        const groups = { ...(budgetData.account_groups as Record<string, FirestoreData>) }
        for (const [groupId, group] of Object.entries(groups)) {
          if ('is_active' in group) {
            // If group had is_active = false and on_budget isn't already set, migrate to off-budget
            if (group.is_active === false && group.on_budget === null) {
              groups[groupId] = { ...group, on_budget: false }
              delete groups[groupId].is_active
            } else {
              const cleaned = { ...group }
              delete cleaned.is_active
              groups[groupId] = cleaned
            }
            groupsChanged = true
            result.groupFieldsRemoved++
          }
        }
        if (groupsChanged) {
          updateData.account_groups = groups
        }
      }

      // Also handle array format account_groups (use deleteField for is_active)
      if (Array.isArray(budgetData.account_groups)) {
        const groups = (budgetData.account_groups as FirestoreData[]).map(group => {
          if ('is_active' in group) {
            const cleaned = { ...group }
            delete cleaned.is_active
            groupsChanged = true
            result.groupFieldsRemoved++
            return cleaned
          }
          return group
        })
        if (groupsChanged) {
          updateData.account_groups = groups
        }
      }

      if (!accountsChanged && !groupsChanged) {
        result.budgetsProcessed++
        continue
      }

      if (accountsChanged) {
        updateData.accounts = accounts
      }
      updateData.updated_at = new Date().toISOString()

      await updateDocByPath(
        'budgets',
        budget.id,
        cleanForFirestore(updateData),
        'remove-active-hidden-fields-migration'
      )

      result.budgetsUpdated++
      result.budgetsProcessed++
    } catch (err) {
      result.errors.push(
        `Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`
      )
      result.budgetsProcessed++
    }
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)

  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRemoveActiveHiddenFieldsMigrationOptions {
  currentUser: unknown
}

export function useRemoveActiveHiddenFieldsMigration({ currentUser }: UseRemoveActiveHiddenFieldsMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RemoveActiveHiddenFieldsMigrationStatus | null>(null)
  const [result, setResult] = useState<RemoveActiveHiddenFieldsMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRemoveActiveHiddenFieldsStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan active/hidden fields status:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function runMigrationHandler(): Promise<void> {
    if (!currentUser) return
    setIsRunning(true)
    setResult(null)
    try {
      const migrationResult = await runMigrationWithProgress(
        'Remove Active/Hidden Fields Migration',
        (progress) => runRemoveActiveHiddenFieldsMigration(progress)
      )
      setResult(migrationResult)
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        budgetsUpdated: 0,
        accountsMigratedToOffBudget: 0,
        groupFieldsRemoved: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  const needsMigration = status !== null && status.budgetsWithLegacyFields > 0
  const totalItemsToFix = status?.budgetsWithLegacyFields ?? 0

  return {
    isScanning,
    isRunning,
    status,
    result,
    scanStatus,
    runMigration: runMigrationHandler,
    needsMigration,
    totalItemsToFix,
  }
}
