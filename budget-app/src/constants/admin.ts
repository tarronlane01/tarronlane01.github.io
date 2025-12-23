/**
 * LocalStorage key for persisting the active admin tab
 */
export const ADMIN_TAB_KEY = 'admin_active_tab'

/**
 * Valid admin tab identifiers for navigation
 */
export const VALID_ADMIN_TABS = [
  'my-budgets',
  'accounts',
  'categories',
  'users',
  'migration',
  'feedback',
  'tests'
] as const

export type AdminTab = typeof VALID_ADMIN_TABS[number]

