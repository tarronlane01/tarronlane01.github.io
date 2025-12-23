/**
 * Data Layer Exports
 *
 * Central export point for all data layer modules.
 */

// Query client and provider
export { queryClient, queryKeys, setupQueryPersistence } from './queryClient'
export { QueryProvider } from './QueryProvider'

// Query hooks
export { useBudgetQuery, useBudgetDataQuery, type BudgetData } from './queries/useBudgetQuery'
export {
  useMonthQuery,
  type MonthQueryData,
  markNextMonthSnapshotStaleInCache,
  markNextMonthSnapshotStaleInFirestore,
} from './queries/useMonthQuery'
export { usePayeesQuery } from './queries/usePayeesQuery'
export { useUserQuery } from './queries/useUserQuery'
export { useAccessibleBudgetsQuery } from './queries/useAccessibleBudgetsQuery'
export { useFeedbackQuery, type FeedbackItem, type FlattenedFeedbackItem, type FeedbackData } from './queries/useFeedbackQuery'
export { useAdminMigrationQuery } from './queries/useAdminMigrationQuery'

// Mutation hooks
export { useBudgetMutations } from './mutations/useBudgetMutations'
export { useMonthMutations } from './mutations/useMonthMutations'
export { useUserMutations } from './mutations/useUserMutations'
export { useFeedbackMutations } from './mutations/useFeedbackMutations'
