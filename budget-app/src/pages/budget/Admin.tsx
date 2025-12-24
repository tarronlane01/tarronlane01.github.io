import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { ADMIN_TAB_KEY, VALID_ADMIN_TABS } from '@constants'
import { TabNavigation, type Tab, BudgetNavBar } from '../../components/ui'

function Admin() {
  // Context: identifiers and UI flags
  const { isAdmin, isTest } = useBudget()

  const location = useLocation()

  const isRootAdmin = location.pathname === '/budget/admin'

  // Derive current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/admin/budget')) return 'budget'
    if (path.includes('/admin/feedback')) return 'feedback'
    if (path.includes('/admin/migration')) return 'migration'
    if (path.includes('/admin/tests')) return 'tests'
    return 'budget'
  }, [location.pathname])

  // For permission checks
  const isTestsPage = currentTab === 'tests'

  // Save current admin tab to localStorage when it changes
  useEffect(() => {
    if (isRootAdmin) return // Don't save when at root (about to redirect)
    localStorage.setItem(ADMIN_TAB_KEY, currentTab)
  }, [currentTab, isRootAdmin])

  // Get the saved tab for redirect (with permission checks)
  function getSavedAdminTab(): string {
    const saved = localStorage.getItem(ADMIN_TAB_KEY)
    // Type guard: check if saved is a valid admin tab
    const isValidTab = saved && (VALID_ADMIN_TABS as readonly string[]).includes(saved)
    if (!isValidTab) return 'budget'

    // Check permissions for restricted tabs
    if (saved === 'tests' && !isTest) return 'budget'

    return saved
  }

  // Define admin tabs with permission-based visibility
  const adminTabs: Tab[] = useMemo(() => [
    { id: 'budget', label: 'Budget', icon: '📊' },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'migration', label: 'Migration', icon: '🔄' },
    { id: 'tests', label: 'Tests', icon: '🧪', hidden: !isTest },
  ], [isTest])

  // Non-admins cannot access admin pages at all
  if (!isAdmin) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <BudgetNavBar title="Budget Admin" />
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only administrators can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget" style={{ color: '#646cff' }}>
            Go to Budget →
          </Link>
        </p>
      </div>
    )
  }

  // Test-only pages
  if (!isTest && isTestsPage) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <BudgetNavBar title="Budget Admin" />
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          Only test users can access this section.
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget/admin/budget" style={{ color: '#646cff' }}>
            Go to Admin →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <BudgetNavBar title="Budget Admin" />
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
