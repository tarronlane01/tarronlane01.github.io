/**
 * Generate month document ID for Firestore
 *
 * Format: {budgetId}_{year}_{month}
 * Example: budget_abc123_2025_01
 */
export function getMonthDocId(budgetId: string, year: number, month: number): string {
  const monthStr = month.toString().padStart(2, '0')
  return `${budgetId}_${year}_${monthStr}`
}

