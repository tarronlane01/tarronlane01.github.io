import { Link } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { PageContainer } from '../../components/ui'
import { navBar, quickLinksGrid, quickLinkCard, colors } from '../../styles/shared'

function Budget() {
  const { currentBudget, isOwner } = useBudget()

  return (
    <PageContainer>
      <nav style={navBar}>
        <Link to="/">← Back to Home</Link>
        {isOwner && (
          <Link
            to="/budget/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '8px',
              background: 'color-mix(in srgb, currentColor 8%, transparent)',
              textDecoration: 'none',
              fontSize: '1.25rem',
              transition: 'background 0.15s',
            }}
            title="Admin Settings"
          >
            ⚙️
          </Link>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Budget</h1>
        {currentBudget && (
          <span style={{
            background: `color-mix(in srgb, ${colors.primary} 15%, transparent)`,
            color: colors.primaryLight,
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            {currentBudget.name}
          </span>
        )}
      </div>

      {currentBudget && (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {currentBudget.user_ids.length} user{currentBudget.user_ids.length !== 1 ? 's' : ''} •
          {isOwner ? ' You are the owner' : ' Shared with you'}
        </p>
      )}

      <div style={quickLinksGrid}>
        <Link to="/budget/admin/accounts" style={quickLinkCard}>
          <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }}>💳</span>
          <span style={{ fontWeight: 500 }}>Accounts</span>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Manage your bank accounts and credit cards
          </p>
        </Link>
        <Link to="/budget/admin/categories" style={quickLinkCard}>
          <span style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }}>🏷️</span>
          <span style={{ fontWeight: 500 }}>Categories & Groups</span>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Organize spending with categories and groups
          </p>
        </Link>
      </div>
    </PageContainer>
  )
}

export default Budget
