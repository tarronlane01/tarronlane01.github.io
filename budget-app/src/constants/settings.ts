/**
 * LocalStorage key for persisting the active settings tab
 */
export const SETTINGS_TAB_KEY = 'settings_active_tab'

/**
 * Valid settings tab identifiers for navigation
 * Updated: Budget summary moved to Admin, only keeping accounts/categories/users
 */
export const VALID_SETTINGS_TABS = [
  'accounts',
  'categories',
  'users',
] as const

export type SettingsTab = typeof VALID_SETTINGS_TABS[number]

/**
 * LocalStorage key for persisting the active admin tab
 */
export const ADMIN_TAB_KEY = 'admin_active_tab'

/**
 * Valid admin tab identifiers for navigation (admin-only section)
 */
export const VALID_ADMIN_TABS = [
  'budget',
  'feedback',
  'migration',
  'tests'
] as const

export type AdminTab = typeof VALID_ADMIN_TABS[number]
