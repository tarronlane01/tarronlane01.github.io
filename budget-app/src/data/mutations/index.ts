/**
 * Mutation Hooks Exports
 *
 * Mutations are organized by domain:
 * - infrastructure/ - Core optimistic mutation factory and utilities
 * - budget/ - Budget document mutations (accounts, categories, rename)
 * - month/ - Month document mutations (income, expenses, allocations)
 * - user/ - User-related mutations (budget creation, invites)
 * - feedback/ - Feedback mutations
 * - payees/ - Payee mutations
 *
 * ARCHITECTURE: All mutations should use createOptimisticMutation factory
 * to enforce optimistic updates. Direct useMutation imports are blocked by ESLint.
 */

// Optimistic mutation factory - use this for all new mutations
export {
  createOptimisticMutation,
  type OptimisticMutationConfig,
  type OptimisticUpdateConfig,
  type OptimisticMutationResult,
} from './infrastructure'

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
