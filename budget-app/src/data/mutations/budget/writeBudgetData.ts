/**
 * Budget Write Operations
 *
 * Core infrastructure for writing budget documents with proper cache updates.
 * This is the ONLY allowed way to write budget documents in mutation files.
 *
 * PATTERN: Uses updateDoc (not setDoc with merge) so map fields (categories, accounts)
 * are fully replaced. With setDoc(merge: true), Firestore deep-merges nested objects,
 * so omitted keys (e.g. deleted categories) would remain. updateDoc replaces each
 * specified field entirely, so deletions persist.
 */

import type { FirestoreData } from '@types'
import { deleteField, readDocByPath, updateDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import { cleanForFirestore } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for writing budget data
 */
export interface WriteBudgetParams {
  budgetId: string
  /** Partial budget data - ONLY include fields you want to update */
  updates: Partial<FirestoreData>
  /** Description for logging */
  description: string
}

// ============================================================================
// READ UTILITY (USE SPARINGLY)
// ============================================================================

/**
 * Read budget document for cases that REQUIRE current state.
 *
 * ⚠️ AVOID when possible! Use this ONLY when you need to:
 * - Validate current state before writing
 * - Perform computations based on current values (e.g., reorder arrays)
 *
 * For simple updates, use writeBudgetData (updateDoc) instead.
 * For array additions, use arrayUnion. For removals, use arrayRemove.
 */
export async function readBudgetForEdit(
  budgetId: string,
  description: string
): Promise<FirestoreData> {
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `VALIDATION-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error('Budget not found')
  }

  return data
}

// ============================================================================
// TARGETED DELETE (single key from map)
// ============================================================================

/**
 * Remove a single category from the budget document by deleting only that key.
 * Uses Firestore's deleteField() so no other document fields or category keys are touched.
 */
export async function deleteBudgetCategoryKey(
  budgetId: string,
  categoryId: string,
  description: string
): Promise<void> {
  const payload: FirestoreData = {
    [`categories.${categoryId}`]: deleteField(),
    updated_at: new Date().toISOString(),
  }
  await updateDocByPath('budgets', budgetId, payload, description)

  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget?.categories && categoryId in cachedBudget.categories) {
    const { [categoryId]: _removed, ...rest } = cachedBudget.categories
    void _removed
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      categories: rest,
      budget: {
        ...cachedBudget.budget,
        categories: rest,
      },
    })
  }
}

/**
 * Remove a single account from the budget document by deleting only that key.
 * Uses Firestore's deleteField() so no other document fields or account keys are touched.
 */
export async function deleteBudgetAccountKey(
  budgetId: string,
  accountId: string,
  description: string
): Promise<void> {
  const payload: FirestoreData = {
    [`accounts.${accountId}`]: deleteField(),
    updated_at: new Date().toISOString(),
  }
  await updateDocByPath('budgets', budgetId, payload, description)

  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget?.accounts && accountId in cachedBudget.accounts) {
    const { [accountId]: _removed, ...rest } = cachedBudget.accounts
    void _removed
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: rest,
      budget: {
        ...cachedBudget.budget,
        accounts: rest,
      },
    })
  }
}

/**
 * Remove a single account group from the budget document and move its accounts to ungrouped.
 * Uses Firestore's deleteField() for the group key and dot-notation updates for each account.
 */
export async function deleteBudgetAccountGroupKey(
  budgetId: string,
  groupId: string,
  accountIdsToUngroup: string[],
  description: string
): Promise<void> {
  const payload: FirestoreData = {
    [`account_groups.${groupId}`]: deleteField(),
    updated_at: new Date().toISOString(),
  }
  for (const accountId of accountIdsToUngroup) {
    payload[`accounts.${accountId}.account_group_id`] = UNGROUPED_ACCOUNT_GROUP_ID
  }
  await updateDocByPath('budgets', budgetId, payload, description)

  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget?.accounts && cachedBudget?.accountGroups && groupId in cachedBudget.accountGroups) {
    const { [groupId]: _removedGroup, ...restGroups } = cachedBudget.accountGroups
    void _removedGroup
    const updatedAccounts = { ...cachedBudget.accounts }
    for (const accountId of accountIdsToUngroup) {
      if (updatedAccounts[accountId]) {
        updatedAccounts[accountId] = {
          ...updatedAccounts[accountId],
          account_group_id: UNGROUPED_ACCOUNT_GROUP_ID,
        }
      }
    }
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: updatedAccounts,
      accountGroups: restGroups,
      budget: {
        ...cachedBudget.budget,
        accounts: updatedAccounts,
        account_groups: restGroups,
      },
    })
  }
}

// ============================================================================
// WRITE UTILITY (updateDoc)
// ============================================================================

/**
 * Write budget data to Firestore using updateDoc.
 *
 * IMPORTANT: Only pass the fields you want to update in `updates`.
 * Each field you pass is replaced entirely (map fields like categories/accounts
 * are fully replaced, so deleted keys are removed). Other top-level fields are
 * left unchanged. Document must already exist.
 *
 * @example
 * // Good: Only updating name
 * await writeBudgetData({ budgetId, updates: { name: 'New Name' }, description: '...' })
 *
 * // Good: Replacing categories map (removed keys are deleted in Firestore)
 * await writeBudgetData({ budgetId, updates: { categories: newMap }, description: '...' })
 */
export async function writeBudgetData(params: WriteBudgetParams): Promise<void> {
  const { budgetId, updates, description } = params

  // Strip fields that shouldn't be saved to Firestore (calculated/managed locally)
  // Budget-level account/category balances are computed locally only; never persist them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove fields
  const { total_available: _total_available, is_needs_recalculation: _is_needs_recalculation, ...updatesWithoutCalculatedFields } = updates as {
    total_available?: number
    is_needs_recalculation?: boolean
    [key: string]: unknown
  }

  // Strip balance from accounts and categories if present (never persist budget-level balances)
  let safeUpdates: FirestoreData = { ...updatesWithoutCalculatedFields }
  if (safeUpdates.accounts && typeof safeUpdates.accounts === 'object') {
    const accounts = safeUpdates.accounts as Record<string, Record<string, unknown>>
    safeUpdates = {
      ...safeUpdates,
      accounts: Object.fromEntries(
        Object.entries(accounts).map(([id, acc]) => {
          if (acc && typeof acc === 'object') {
            // Omit balance from payload (balances live on budget, not in accounts update)
            const { balance: _balanceOmitted, ...accWithoutBalance } = acc as { balance?: number; [key: string]: unknown }
            void _balanceOmitted
            return [id, accWithoutBalance]
          }
          return [id, acc]
        })
      ),
    }
  }
  if (safeUpdates.categories && typeof safeUpdates.categories === 'object') {
    const categories = safeUpdates.categories as Record<string, Record<string, unknown>>
    safeUpdates = {
      ...safeUpdates,
      categories: Object.fromEntries(
        Object.entries(categories).map(([id, cat]) => {
          if (cat && typeof cat === 'object') {
            // Omit balance from payload (balances live on budget, not in categories update)
            const { balance: _balanceOmitted, ...catWithoutBalance } = cat as { balance?: number; [key: string]: unknown }
            void _balanceOmitted
            return [id, catWithoutBalance]
          }
          return [id, cat]
        })
      ),
    }
  }

  // Add timestamp to updates
  const dataToWrite: FirestoreData = {
    ...safeUpdates,
    updated_at: new Date().toISOString(),
  }

  // Clean undefined values before writing (Firestore doesn't allow undefined)
  const cleanedData = cleanForFirestore(dataToWrite)

  // Use updateDoc so map fields (categories, accounts) are fully replaced, not deep-merged.
  // setDoc(merge: true) would keep omitted keys in nested objects; updateDoc replaces each field.
  await updateDocByPath('budgets', budgetId, cleanedData, description)

  // Update cache after successful write
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      budget: {
        ...cachedBudget.budget,
        ...updates,
      },
    })
  }
}

