/**
 * Firestore Logging Utility
 *
 * Internal logging for Firebase operations with source context and document count.
 */

import { featureFlags } from '@constants/featureFlags'

/**
 * Conditionally log Firebase operations with source context and document count
 *
 * @param operation - The operation type (READ, WRITE, DELETE, QUERY)
 * @param path - The Firestore path
 * @param source - Description of why this operation is happening
 * @param docCount - Number of documents (default 1)
 * @param exists - For READ operations, whether the document exists (undefined = not applicable)
 */
export function logFirebase(
  operation: string,
  path: string,
  source: string,
  docCount: number = 1,
  exists?: boolean
): void {
  if (featureFlags.logFirebaseOperations) {
    // Clean up the path for readability:
    // - budgets/budget_xxx → budgets
    // - months/budget_xxx_2025_12 → months/2025/12
    let cleanPath = path
    if (path.startsWith('budgets/')) {
      cleanPath = 'budgets'
    } else if (path.startsWith('months/')) {
      // Extract year/month from doc ID (format: budgetId_YYYY_MM)
      const docId = path.replace('months/', '')
      const parts = docId.split('_')
      if (parts.length >= 2) {
        const month = parts[parts.length - 1]
        const year = parts[parts.length - 2]
        cleanPath = `months/${year}/${month}`
      }
    }

    // Add existence indicator for READ operations
    const existsIndicator = exists === false ? ' [NOT FOUND]' : ''

    console.log(`[Firebase] ${operation}(${docCount}): ${cleanPath}${existsIndicator} ← ${source}`)
  }
}

