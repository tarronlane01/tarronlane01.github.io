/**
 * Mutation Hooks Exports
 *
 * Mutations are organized by domain:
 * - budget/ - Budget document mutations (accounts, categories, rename)
 * - month/ - Month document mutations (income, expenses, allocations)
 * - user/ - User-related mutations (budget creation, invites)
 * - feedback/ - Feedback mutations
 * - payees/ - Payee mutations
 */

// Month write operations
export {
  writeMonthData,
  type WriteMonthParams,
} from './month'

// Recalculation helpers - re-exported from canonical location
export {
  markMonthsNeedRecalculation,
  setMonthInBudgetMap,
} from '../recalculation'
