// Re-export all hooks
export { default as useFirebaseAuth } from './useFirebaseAuth'
export { useIsMobile, BREAKPOINTS } from './useIsMobile'

// Budget data hooks - import these directly in components
export { useBudgetData } from './useBudgetData'
export { useBudgetMonth } from './useBudgetMonth'

// Page/Section-specific hooks
export { useAccountsPage, type AccountWithId } from './useAccountsPage'
export { useAllocationsPage } from './useAllocationsPage'
export { useCategoriesPage, type CategoryEntry, type CategoryWithId, type CategoryBalance } from './useCategoriesPage'

