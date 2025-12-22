import { useEffect } from 'react'
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'

const ADMIN_TAB_KEY = 'admin_active_tab'
const VALID_ADMIN_TABS = ['my-budgets', 'accounts', 'categories', 'users', 'migration', 'feedback', 'tests']

function Admin() {
  const { currentBudget, loading, isOwner, isAdmin, isTest } = useBudget()
  const location = useLocation()

  const isAccountsPage = location.pathname.includes('/admin/accounts')
  const isCategoriesPage = location.pathname.includes('/admin/categories')
  const isUsersPage = location.pathname.includes('/admin/users')
  const isMigrationPage = location.pathname.includes('/admin/migration')
  const isFeedbackPage = location.pathname.includes('/admin/feedback')
  const isMyBudgetsPage = location.pathname.includes('/admin/my-budgets')
  const isTestsPage = location.pathname.includes('/admin/tests')
  const isRootAdmin = location.pathname === '/budget/admin'

  // Save current admin tab to localStorage when it changes
  useEffect(() => {
    if (isRootAdmin) return // Don't save when at root (about to redirect)

    let currentTab = 'my-budgets'
    if (isAccountsPage) currentTab = 'accounts'
    else if (isCategoriesPage) currentTab = 'categories'
    else if (isUsersPage) currentTab = 'users'
    else if (isMigrationPage) currentTab = 'migration'
    else if (isFeedbackPage) currentTab = 'feedback'
    else if (isTestsPage) currentTab = 'tests'

    localStorage.setItem(ADMIN_TAB_KEY, currentTab)
  }, [location.pathname, isRootAdmin, isAccountsPage, isCategoriesPage, isUsersPage, isMigrationPage, isFeedbackPage, isMyBudgetsPage, isTestsPage])

  // Get the saved tab for redirect (with permission checks)
  function getSavedAdminTab(): string {
    const saved = localStorage.getItem(ADMIN_TAB_KEY)
    if (!saved || !VALID_ADMIN_TABS.includes(saved)) return 'my-budgets'

    // Check permissions for restricted tabs
    if (saved === 'users' && !isOwner) return 'my-budgets'
    if ((saved === 'migration' || saved === 'feedback') && !isAdmin) return 'my-budgets'
    if (saved === 'tests' && !isTest) return 'my-budgets'

    return saved
  }

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
        </div>
      )}

      {/* Admin Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        paddingBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        {/* My Budgets - available to everyone */}
        <Link
          to="/budget/admin/my-budgets"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            textDecoration: 'none',
            color: 'inherit',
            background: isMyBudgetsPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
            border: isMyBudgetsPage ? '1px solid #646cff' : '1px solid transparent',
            fontWeight: isMyBudgetsPage ? 500 : 400,
          }}
        >
          📂 My Budgets
        </Link>

        {/* Accounts & Categories - available to everyone on the budget */}
        <Link
          to="/budget/admin/accounts"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            textDecoration: 'none',
            color: 'inherit',
            background: isAccountsPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
            border: isAccountsPage ? '1px solid #646cff' : '1px solid transparent',
            fontWeight: isAccountsPage ? 500 : 400,
          }}
        >
          🏦 Accounts
        </Link>
        <Link
          to="/budget/admin/categories"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            textDecoration: 'none',
            color: 'inherit',
            background: isCategoriesPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
            border: isCategoriesPage ? '1px solid #646cff' : '1px solid transparent',
            fontWeight: isCategoriesPage ? 500 : 400,
          }}
        >
          🏷️ Categories
        </Link>

        {/* Owner-only tabs */}
        {isOwner && (
          <Link
            to="/budget/admin/users"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'inherit',
              background: isUsersPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
              border: isUsersPage ? '1px solid #646cff' : '1px solid transparent',
              fontWeight: isUsersPage ? 500 : 400,
            }}
          >
            👥 Users
          </Link>
        )}

        {/* Admin-only tabs */}
        {isAdmin && (
          <>
            <Link
              to="/budget/admin/migration"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                textDecoration: 'none',
                color: 'inherit',
                background: isMigrationPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
                border: isMigrationPage ? '1px solid #646cff' : '1px solid transparent',
                fontWeight: isMigrationPage ? 500 : 400,
              }}
            >
              🔄 Migration
            </Link>
            <Link
              to="/budget/admin/feedback"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                textDecoration: 'none',
                color: 'inherit',
                background: isFeedbackPage ? 'color-mix(in srgb, #646cff 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
                border: isFeedbackPage ? '1px solid #646cff' : '1px solid transparent',
                fontWeight: isFeedbackPage ? 500 : 400,
              }}
            >
              💬 Feedback
            </Link>
          </>
        )}

        {/* Test-only tabs */}
        {isTest && (
          <Link
            to="/budget/admin/tests"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'inherit',
              background: isTestsPage ? 'color-mix(in srgb, #ff6b6b 20%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
              border: isTestsPage ? '1px solid #ff6b6b' : '1px solid transparent',
              fontWeight: isTestsPage ? 500 : 400,
            }}
          >
            🧪 Tests
          </Link>
        )}
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

