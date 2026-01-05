/**
 * Migration Runner Framework
 *
 * All migrations MUST use this framework to ensure cache invalidation happens
 * after every migration. This prevents stale data issues and ensures the
 * next load will get the cleaned data from Firestore.
 *
 * ARCHITECTURE:
 * - Migrations are pure async functions that return a result
 * - The runMigration wrapper handles cache invalidation automatically
 * - You cannot run a migration without the cache being invalidated after
 *
 * USAGE:
 * ```ts
 * const result = await runMigration(async () => {
 *   // Your migration logic here
 *   return { success: true, itemsFixed: 42 }
 * })
 * ```
 */

import { queryClient } from '@data/queryClient'

/**
 * Clear all React Query caches (in-memory and localStorage).
 * This is called automatically after every migration.
 */
export function clearAllCaches(): void {
  // Clear in-memory React Query cache
  queryClient.removeQueries({ queryKey: ['budget'] })
  queryClient.removeQueries({ queryKey: ['month'] })
  queryClient.removeQueries({ queryKey: ['accessibleBudgets'] })
  queryClient.removeQueries({ queryKey: ['payees'] })
  queryClient.removeQueries({ queryKey: ['user'] })

  // Clear localStorage persistence
  try {
    localStorage.removeItem('BUDGET_APP_QUERY_CACHE')
  } catch {
    // localStorage access might fail in some contexts
  }

  console.log('[Migration] All caches cleared')
}

/**
 * Base interface that all migration results must extend.
 * Ensures every migration reports errors.
 */
export interface MigrationResultBase {
  errors: string[]
}

/**
 * Run a migration with guaranteed cache invalidation.
 *
 * IMPORTANT: Cache is cleared AFTER the migration completes, regardless
 * of success or failure. This ensures the app always fetches fresh data.
 *
 * @param migrationFn - The async migration function to run
 * @returns The result from the migration function
 *
 * @example
 * ```ts
 * interface MyMigrationResult extends MigrationResultBase {
 *   itemsFixed: number
 * }
 *
 * const result = await runMigration<MyMigrationResult>(async () => {
 *   const itemsFixed = await fixAllItems()
 *   return { itemsFixed, errors: [] }
 * })
 * ```
 */
export async function runMigration<T extends MigrationResultBase>(
  migrationFn: () => Promise<T>
): Promise<T> {
  try {
    // Run the migration
    const result = await migrationFn()

    // Always clear caches after migration completes
    clearAllCaches()

    return result
  } catch (error) {
    // Clear caches even on failure - we might have partial writes
    clearAllCaches()

    // Re-throw the error for the caller to handle
    throw error
  }
}

/**
 * Options for creating a migration hook
 */
export interface MigrationHookOptions {
  /** Called when migration completes successfully (after cache clear) */
  onComplete?: () => void
}

