/**
 * Context Exports
 *
 * Re-exports all React contexts and their hooks/types.
 * Import via @contexts alias.
 */

// App context - global loading state management
export { AppProvider, useApp } from './app_context'

// Budget context - active budget and data management
export {
  BudgetProvider,
  useBudget,
  type CategoriesMap,
  type AccountsMap,
  type BudgetTab,
} from './budget_context'

// User context - authentication state
export { default as UserContext } from './user_context'

// Sync context - document change tracking and background saves
export { SyncProvider, useSync } from './sync_context'

