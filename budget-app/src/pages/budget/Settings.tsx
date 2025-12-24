import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import { SETTINGS_TAB_KEY, VALID_SETTINGS_TABS } from '@constants'
import { TabNavigation, type Tab, BudgetNavBar } from '../../components/ui'

function Settings() {
  // Context: identifiers and UI flags
  const { selectedBudgetId, currentUserId } = useBudget()

  // Hook: budget data
  const {
    isOwner,
    isLoading: loading,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const location = useLocation()

  const isRootSettings = location.pathname === '/budget/settings'

  // Derive current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/settings/accounts')) return 'accounts'
    if (path.includes('/settings/categories')) return 'categories'
    if (path.includes('/settings/users')) return 'users'
    return 'accounts'
  }, [location.pathname])

  // For permission checks
  const isUsersPage = currentTab === 'users'

  // Save current settings tab to localStorage when it changes
  useEffect(() => {
    if (isRootSettings) return // Don't save when at root (about to redirect)
    localStorage.setItem(SETTINGS_TAB_KEY, currentTab)
  }, [currentTab, isRootSettings])

  // Get the saved tab for redirect (with permission checks)
  function getSavedSettingsTab(): string {
    const saved = localStorage.getItem(SETTINGS_TAB_KEY)
    // Type guard: check if saved is a valid settings tab
    const isValidTab = saved && (VALID_SETTINGS_TABS as readonly string[]).includes(saved)
    if (!isValidTab) return 'accounts'

    // Handle legacy saved values that moved to Admin
    if (saved === 'budget' || saved === 'migration' || saved === 'feedback' || saved === 'tests') {
      return 'accounts'
    }

    // Check permissions for restricted tabs
    if (saved === 'users' && !isOwner) return 'accounts'

    return saved
  }

  // Define settings tabs with permission-based visibility
  const settingsTabs: Tab[] = useMemo(() => [
    { id: 'accounts', label: 'Accounts', icon: '🏦' },
    { id: 'categories', label: 'Categories', icon: '🏷️' },
    { id: 'users', label: 'Users', icon: '👥', hidden: !isOwner },
  ], [isOwner])

  if (loading) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    )
  }

  // Owner-only pages (Users)
  const isOwnerOnlyPage = isUsersPage

  if (!isOwner && isOwnerOnlyPage) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <BudgetNavBar title="Budget Settings" />
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only the budget owner can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget/settings/accounts" style={{ color: '#646cff' }}>
            Go to Accounts →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <BudgetNavBar title="Budget Settings" />
      <TabNavigation
        mode="link"
        linkPrefix="/budget/settings"
        tabs={settingsTabs}
        activeTab={currentTab}
      />

      {/* Redirect to saved tab (or accounts by default), or show nested route */}
      {isRootSettings ? (
        <Navigate to={`/budget/settings/${getSavedSettingsTab()}`} replace />
      ) : (
        <Outlet />
      )}
    </div>
  )
}

export default Settings
