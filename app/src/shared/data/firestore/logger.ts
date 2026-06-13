/**
 * Firestore Logging Utility
 *
 * Internal logging for Firebase operations with source context and document count.
 *
 * Toggle flags in featureFlags.ts:
 * - logFirebaseOperations: Enable/disable all Firebase logging
 * - logFirebaseSource: Show source descriptions (e.g., "← loading budget")
 * - logFirebaseFullPath: Show full document paths vs shortened versions
 * - logFirebaseData: Log the actual data being read/written (verbose!)
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
 * @param data - Optional data being read/written (only logged if logFirebaseData is true)
 */
export function logFirebase(
  operation: string,
  path: string,
  source: string,
  docCount: number = 1,
  exists?: boolean,
  data?: unknown
): void {
  if (!featureFlags.logFirebaseOperations) return

  // Use full path or clean it up based on flag
  let displayPath = path
  if (!featureFlags.logFirebaseFullPath) {
    // Clean up the path for readability:
    // - budgets/budget_xxx → budgets
    // - months/budget_xxx_2025_12 → months/2025/12
    if (path.startsWith('budgets/')) {
      displayPath = 'budgets'
    } else if (path.startsWith('months/')) {
      // Extract year/month from doc ID (format: budgetId_YYYY_MM)
      const docId = path.replace('months/', '')
      const parts = docId.split('_')
      if (parts.length >= 2) {
        const month = parts[parts.length - 1]
        const year = parts[parts.length - 2]
        displayPath = `months/${year}/${month}`
      }
    }
  }

  // Add existence indicator for READ operations
  const existsIndicator = exists === false ? ' [NOT FOUND]' : ''

  // Conditionally include source description
  const sourceText = featureFlags.logFirebaseSource ? ` ← ${source}` : ''

  console.log(`[Firebase] ${operation}(${docCount}): ${displayPath}${existsIndicator}${sourceText}`)

  // Log data if flag is enabled and data is provided
  if (featureFlags.logFirebaseData && data !== undefined) {
    console.log(`[Firebase] ${operation} data:`, data)
  }
}

