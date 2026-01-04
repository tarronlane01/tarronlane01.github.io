import { Link, useLocation } from 'react-router-dom'
import { useBudget } from '@contexts'
import { DropdownMenu, type MenuItem } from './DropdownMenu'
import { logUserAction } from '@utils'

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
  const location = useLocation()

  // Check if we're on the main budget page (not settings, admin, analytics, or my-budgets)
  const isOnBudgetPage = location.pathname === '/budget' ||
    (location.pathname.startsWith('/budget/') &&
     !location.pathname.startsWith('/budget/settings') &&
     !location.pathname.startsWith('/budget/admin') &&
     !location.pathname.startsWith('/budget/analytics') &&
     !location.pathname.startsWith('/budget/my-budgets'))

  const menuItems: MenuItem[] = [
    // Only show Budget link if we're not already on the budget page
    ...(!isOnBudgetPage ? [{ label: 'Budget', icon: '💰', to: '/budget' }] : []),
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
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }}>
      {/* Left: Icon or back arrow */}
      <div style={{ flex: '0 0 auto' }}>
        {showBackArrow ? (
          <Link to="/" onClick={() => logUserAction('NAVIGATE', 'Back to Home')} style={{ opacity: 0.6, fontSize: '1.5rem', textDecoration: 'none' }} title="Back to Home">
            ←
          </Link>
        ) : (
          <Link to="/budget" onClick={() => logUserAction('NAVIGATE', 'Budget Home Icon')} title="Budget Home">
            <img src="/budget-icon.svg" alt="Budget" style={{ width: '1.5rem', height: '1.5rem' }} />
          </Link>
        )}
      </div>

      {/* Center: Title */}
      <span style={{ fontWeight: 600, fontSize: '1.1rem', textAlign: 'center', flex: '1 1 auto' }}>
        {title}
      </span>

      {/* Right: Dropdown menu or empty placeholder for balance */}
      <div style={{ flex: '0 0 auto' }}>
        {!hideMenu ? <DropdownMenu items={menuItems} /> : <div style={{ width: '1.5rem' }} />}
      </div>
    </nav>
  )
}

