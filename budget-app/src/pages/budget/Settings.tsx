import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useApp } from '../../contexts/app_context'
import { useBudget, type SettingsTab } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import { TabNavigation, type Tab, ContentContainer } from '../../components/ui'

const VALID_SETTINGS_TABS: SettingsTab[] = ['accounts', 'categories', 'users']

function Settings() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentUserId, lastSettingsTab, setLastSettingsTab, setPageTitle } = useBudget()

  // Set page title for layout header
  useLayoutEffect(() => { setPageTitle('Budget Settings') }, [setPageTitle])

  // Hook: budget data
  const {
    isOwner,
    isLoading: loading,
  } = useBudgetData(selectedBudgetId, currentUserId)

  // Add loading hold while loading
  useEffect(() => {
    if (loading) {
      addLoadingHold('settings', 'Loading settings...')
    } else {
      removeLoadingHold('settings')
    }
    return () => removeLoadingHold('settings')
  }, [loading, addLoadingHold, removeLoadingHold])

  const location = useLocation()

  const isRootSettings = location.pathname === '/budget/settings'

  // Derive current tab from URL path
  const currentTab: SettingsTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/settings/accounts')) return 'accounts'
    if (path.includes('/settings/categories')) return 'categories'
    if (path.includes('/settings/users')) return 'users'
    return 'categories'
  }, [location.pathname])

  // For permission checks
  const isUsersPage = currentTab === 'users'

  // Save current settings tab to context when it changes
  useEffect(() => {
    if (isRootSettings) return // Don't save when at root (about to redirect)
    setLastSettingsTab(currentTab)
  }, [currentTab, isRootSettings, setLastSettingsTab])

  // Get the saved tab for redirect (with permission checks)
  function getSavedSettingsTab(): SettingsTab {
    // Check if saved tab is valid
    if (!VALID_SETTINGS_TABS.includes(lastSettingsTab)) return 'categories'

    // Check permissions for restricted tabs
    if (lastSettingsTab === 'users' && !isOwner) return 'categories'

    return lastSettingsTab
  }

  // Define settings tabs with permission-based visibility
  const settingsTabs: Tab[] = useMemo(() => [
    { id: 'accounts', label: 'Accounts', icon: '🏦' },
    { id: 'categories', label: 'Categories', icon: '🏷️' },
    { id: 'users', label: 'Users', icon: '👥', hidden: !isOwner },
  ], [isOwner])

  if (loading) return null

  // Owner-only pages (Users)
  const isOwnerOnlyPage = isUsersPage

  if (!isOwner && isOwnerOnlyPage) {
    return (
      <div>
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only the budget owner can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget/settings/categories" style={{ color: '#646cff' }}>
            Go to Categories →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <TabNavigation
        mode="link"
        linkPrefix="/budget/settings"
        tabs={settingsTabs}
        activeTab={isRootSettings ? getSavedSettingsTab() : currentTab}
      />

      {/* Redirect to saved tab (or accounts by default), or show nested route */}
      {isRootSettings ? (
        <Navigate to={`/budget/settings/${getSavedSettingsTab()}`} replace />
      ) : (
        <ContentContainer>
          <Outlet />
        </ContentContainer>
      )}
    </div>
  )
}

export default Settings
