/**
 * Budget Mutations
 *
 * Centralized budget mutation operations organized by feature:
 * - accounts/ - Account and account group operations
 * - categories/ - Category and category group operations
 * - useRenameBudget - Budget rename operation
 */

// Account mutations
export {
  useUpdateAccounts,
  useUpdateAccountGroups,
  useUpdateAccountBalance,
} from './accounts'

// Category mutations
export {
  useUpdateCategories,
  useUpdateCategoryGroups,
} from './categories'

// Budget rename
export { useRenameBudget } from './useRenameBudget'
