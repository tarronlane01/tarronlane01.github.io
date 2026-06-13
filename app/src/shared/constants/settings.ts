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
 * Valid admin tab identifiers for navigation (admin-only section)
 */
export const VALID_ADMIN_TABS = [
  'budget',
  'feedback',
  'migration',
  'tests'
] as const

export type AdminTab = typeof VALID_ADMIN_TABS[number]
