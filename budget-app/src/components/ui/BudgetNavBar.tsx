import { Link } from 'react-router-dom'
import { useBudget } from '../../contexts/budget_context'
import { DropdownMenu, type MenuItem } from './DropdownMenu'

interface BudgetNavBarProps {
  /** The page title to display centered */
  title: string
  /** Show back arrow to home instead of budget icon (for onboarding screens) */
  showBackArrow?: boolean
  /** Hide the dropdown menu (for onboarding screens) */
  hideMenu?: boolean
}

/**
 * Shared navigation bar for all budget pages.
 * Layout: Icon (left) | Title (centered) | Dropdown Menu (right)
 */
export function BudgetNavBar({ title, showBackArrow = false, hideMenu = false }: BudgetNavBarProps) {
  const { isAdmin } = useBudget()

  const menuItems: MenuItem[] = [
    { label: 'Budget', icon: '💰', to: '/budget' },
    { label: 'Budget Settings', icon: '⚙️', to: '/budget/settings' },
    { label: 'Analytics', icon: '📊', to: '/budget/analytics' },
    ...(isAdmin ? [{ label: 'Admin', icon: '🛡️', to: '/budget/admin' }] : []),
    { label: 'Switch Budgets', icon: '🗂️', to: '/budget/my-budgets' },
    { divider: true, label: '' },
    { label: 'Exit Budget App', icon: '🏠', to: '/' },
  ]

  return (
    <nav style={{
      marginBottom: '1rem',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
    }}>
      {/* Left: Icon or back arrow (wrapped in div to prevent link stretching across full 1fr column) */}
      <div>
        {showBackArrow ? (
          <Link to="/" style={{ opacity: 0.6, fontSize: '1.5rem', textDecoration: 'none' }} title="Back to Home">
            ←
          </Link>
        ) : (
          <Link to="/budget" title="Budget Home">
            <img src="/budget-icon.svg" alt="Budget" style={{ width: '1.5rem', height: '1.5rem' }} />
          </Link>
        )}
      </div>

      {/* Center: Title */}
      <span style={{ fontWeight: 600, fontSize: '1.1rem', textAlign: 'center' }}>
        {title}
      </span>

      {/* Right: Dropdown menu or empty */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!hideMenu && <DropdownMenu items={menuItems} />}
      </div>
    </nav>
  )
}

