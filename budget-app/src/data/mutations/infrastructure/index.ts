/**
 * Mutation Infrastructure Exports
 *
 * This folder contains core infrastructure for the optimistic mutation system.
 * Files here have special ESLint exceptions to use useMutation and @firestore directly.
 *
 * All other mutation files must use createOptimisticMutation and domain-specific
 * write utilities (writeBudgetData, writeMonthData, etc.)
 */

// Factory for creating optimistic mutations
export {
  createOptimisticMutation,
  type OptimisticMutationConfig,
  type OptimisticUpdateConfig,
  type OptimisticMutationResult,
} from './createOptimisticMutation'

