import { Link, Outlet, useLocation } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'

function Admin() {
  const { currentBudget, loading, isOwner } = useBudget()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!currentBudget) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <p>No budget found. Please log in.</p>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
        <nav style={{ marginBottom: '1.5rem' }}>
          <Link to="/budget">← Back to Budget</Link>
        </nav>
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.7 }}>Only the budget owner can access admin settings.</p>
      </div>
    )
  }

  const isAccountsPage = location.pathname.includes('/admin/accounts')
  const isCategoriesPage = location.pathname.includes('/admin/categories')
  const isUsersPage = location.pathname.includes('/admin/users')
  const isMigrationPage = location.pathname.includes('/admin/migration')
  const isRootAdmin = location.pathname === '/budget/admin'

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav style={{ marginBottom: '1.5rem' }}>
        <Link to="/budget">← Back to Budget</Link>
      </nav>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>⚙️</span> Admin Settings
      </h1>
      <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>
        Manage your budget settings, users, and data migration.
      </p>
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

      {/* Admin Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
        paddingBottom: '1rem',
        flexWrap: 'wrap',
      }}>
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
      </div>

      {/* Show dashboard or nested route */}
      {isRootAdmin ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
        }}>
          <Link
            to="/budget/admin/accounts"
            style={{
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              padding: '1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }}>🏦</span>
            <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>Accounts</span>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Manage your bank accounts and balances
            </p>
          </Link>
          <Link
            to="/budget/admin/categories"
            style={{
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              padding: '1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }}>🏷️</span>
            <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>Categories & Groups</span>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Manage categories and organize them into groups
            </p>
          </Link>
          <Link
            to="/budget/admin/users"
            style={{
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              padding: '1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }}>👥</span>
            <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>Manage Users</span>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Invite or remove users from this budget
            </p>
          </Link>
          <Link
            to="/budget/admin/migration"
            style={{
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              padding: '1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }}>🔄</span>
            <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>Data Migration</span>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Run data migrations for this budget
            </p>
          </Link>
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  )
}

export default Admin

