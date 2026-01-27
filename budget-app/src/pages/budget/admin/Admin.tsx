import { useEffect, useLayoutEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useBudget, type AdminTab } from '@contexts/budget_context'
import { useUserQuery } from '@data'
import useFirebaseAuth from '@hooks/useFirebaseAuth'
import { TabNavigation, type Tab } from '../../../components/ui'

const VALID_ADMIN_TABS: AdminTab[] = ['budget', 'feedback', 'migration', 'tests']

function Admin() {
  // Context: identifiers and UI flags
  const { isAdmin, isTest, lastAdminTab, setLastAdminTab, setPageTitle } = useBudget()
  
  // Check if user query is fetching to avoid showing access denied with stale data
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()
  const userQuery = useUserQuery(current_user?.uid || null, current_user?.email || null)

  // Set page title for layout header
  useLayoutEffect(() => { setPageTitle('Budget Admin') }, [setPageTitle])

  const location = useLocation()

  const isRootAdmin = location.pathname === '/budget/admin'

  // Derive current tab from URL path
  const currentTab: AdminTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/admin/budget')) return 'budget'
    if (path.includes('/admin/feedback')) return 'feedback'
    if (path.includes('/admin/migration')) return 'migration'
    if (path.includes('/admin/tests')) return 'tests'
    return 'budget'
  }, [location.pathname])

  // For permission checks
  const isTestsPage = currentTab === 'tests'

  // Save current admin tab to context when it changes
  useEffect(() => {
    if (isRootAdmin) return // Don't save when at root (about to redirect)
    setLastAdminTab(currentTab)
  }, [currentTab, isRootAdmin, setLastAdminTab])

  // Get the saved tab for redirect (with permission checks)
  function getSavedAdminTab(): AdminTab {
    // Check if saved tab is valid
    if (!VALID_ADMIN_TABS.includes(lastAdminTab)) return 'budget'

    // Check permissions for restricted tabs
    if (lastAdminTab === 'tests' && !isTest) return 'budget'

    return lastAdminTab
  }

  // Define admin tabs with permission-based visibility
  const adminTabs: Tab[] = useMemo(() => [
    { id: 'budget', label: 'Budget', icon: '📊' },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'migration', label: 'Migration', icon: '🔄' },
    { id: 'tests', label: 'Tests', icon: '🧪', hidden: !isTest },
  ], [isTest])

  // Show loading if user query is loading or fetching (to avoid showing access denied with stale data)
  if (userQuery.isLoading || userQuery.isFetching) {
    return null
  }

  // Non-admins cannot access admin pages at all
  if (!isAdmin) {
    return (
      <div>
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only administrators can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget">
            Go to Budget →
          </Link>
        </p>
      </div>
    )
  }

  // Test-only pages
  if (!isTest && isTestsPage) {
    return (
      <div>
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only test users can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget/admin/budget">
            Go to Admin →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <TabNavigation
        mode="link"
        linkPrefix="/budget/admin"
        tabs={adminTabs}
        activeTab={currentTab}
      />

      {/* Redirect to saved tab (or budget by default), or show nested route */}
      {isRootAdmin ? (
        <Navigate to={`/budget/admin/${getSavedAdminTab()}`} replace />
      ) : (
        <Outlet />
      )}
    </div>
  )
}

export default Admin

