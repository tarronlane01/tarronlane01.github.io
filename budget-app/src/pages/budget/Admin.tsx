import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { useBudgetData } from '../../hooks'
import { ADMIN_TAB_KEY, VALID_ADMIN_TABS } from '@constants'
import { TabNavigation, type Tab } from '../../components/ui'

function Admin() {
  // Context: identifiers and UI flags
  const { selectedBudgetId, currentUserId, isAdmin, isTest } = useBudget()

  // Hook: budget data
  const {
    budget: currentBudget,
    accounts,
    accountGroups,
    categories,
    categoryGroups,
    isOwner,
    isLoading: loading,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const location = useLocation()

  const isRootAdmin = location.pathname === '/budget/admin'

  // Derive current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/admin/accounts')) return 'accounts'
    if (path.includes('/admin/categories')) return 'categories'
    if (path.includes('/admin/users')) return 'users'
    if (path.includes('/admin/migration')) return 'migration'
    if (path.includes('/admin/feedback')) return 'feedback'
    if (path.includes('/admin/tests')) return 'tests'
    if (path.includes('/admin/my-budgets')) return 'my-budgets'
    return 'my-budgets'
  }, [location.pathname])

  // For permission checks
  const isUsersPage = currentTab === 'users'
  const isMigrationPage = currentTab === 'migration'
  const isFeedbackPage = currentTab === 'feedback'
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
    if (!isValidTab) return 'my-budgets'

    // Check permissions for restricted tabs
    if (saved === 'users' && !isOwner) return 'my-budgets'
    if ((saved === 'migration' || saved === 'feedback') && !isAdmin) return 'my-budgets'
    if (saved === 'tests' && !isTest) return 'my-budgets'

    return saved
  }

  // Define admin tabs with permission-based visibility
  const adminTabs: Tab[] = useMemo(() => [
    { id: 'my-budgets', label: 'My Budgets', icon: '📂' },
    { id: 'accounts', label: 'Accounts', icon: '🏦' },
    { id: 'categories', label: 'Categories', icon: '🏷️' },
    { id: 'users', label: 'Users', icon: '👥', hidden: !isOwner },
    { id: 'migration', label: 'Migration', icon: '🔄', hidden: !isAdmin },
    { id: 'feedback', label: 'Feedback', icon: '💬', hidden: !isAdmin },
    { id: 'tests', label: 'Tests', icon: '🧪', hidden: !isTest },
  ], [isOwner, isAdmin, isTest])

  if (loading) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    )
  }

  // Owner-only pages (Users)
  const isOwnerOnlyPage = isUsersPage
  // Admin-only pages (Migration, Feedback)
  const isAdminOnlyPage = isMigrationPage || isFeedbackPage
  // Test-only pages
  const isTestOnlyPage = isTestsPage

  if ((!isOwner && isOwnerOnlyPage) || (!isAdmin && isAdminOnlyPage) || (!isTest && isTestOnlyPage)) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <nav style={{ marginBottom: '1.5rem' }}>
          <Link to="/budget">← Back to Budget</Link>
        </nav>
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>
          {isTestOnlyPage
            ? 'Only test users can access this section.'
            : isAdminOnlyPage
              ? 'Only administrators can access this section.'
              : 'Only the budget owner can access this section.'}
        </p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/budget/admin/my-budgets" style={{ color: '#646cff' }}>
            Go to My Budgets →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link to="/budget">← Back to Budget</Link>
      </nav>

      <h1>{isOwner ? 'Admin Settings' : 'Budget Settings'}</h1>
      <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>
        {isOwner
          ? 'Manage your budget settings, users, and data migration.'
          : 'Manage your budgets, accounts, and categories.'}
      </p>

      {currentBudget && (
        <div style={{
          opacity: 0.6,
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📋</span>
            <span>Budget Name: <strong style={{ opacity: 1 }}>{currentBudget.name}</strong></span>
          </p>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🆔</span>
            <span>Budget ID: <code style={{ opacity: 1, background: 'color-mix(in srgb, currentColor 10%, transparent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>{currentBudget.id}</code></span>
          </p>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👤</span>
            <span>Budget Owner: <strong style={{ opacity: 1 }}>{currentBudget.owner_email || currentBudget.owner_id}</strong></span>
          </p>
          {/* Admin-only: Download budget document */}
          {isAdmin && (
            <button
              onClick={() => {
                const budgetData = {
                  ...currentBudget,
                  accounts,
                  account_groups: accountGroups,
                  categories,
                  category_groups: categoryGroups,
                  _meta: {
                    downloaded_at: new Date().toISOString(),
                  }
                }
                const blob = new Blob([JSON.stringify(budgetData, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `budget_${currentBudget.id}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
              style={{
                marginTop: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'color-mix(in srgb, currentColor 10%, transparent)',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: 'inherit',
                opacity: 1,
                transition: 'background 0.15s',
                alignSelf: 'flex-start',
              }}
              title="Download budget document as JSON (for debugging)"
            >
              📥 Download Budget JSON
            </button>
          )}
        </div>
      )}

      {/* Admin Navigation */}
      <div style={{
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        paddingBottom: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        <TabNavigation
          mode="link"
          linkPrefix="/budget/admin"
          tabs={adminTabs}
          activeTab={currentTab}
        />
      </div>

      {/* Redirect to saved tab (or my-budgets by default), or show nested route */}
      {isRootAdmin ? (
        <Navigate to={`/budget/admin/${getSavedAdminTab()}`} replace />
      ) : (
        <Outlet />
      )}
    </div>
  )
}

export default Admin
