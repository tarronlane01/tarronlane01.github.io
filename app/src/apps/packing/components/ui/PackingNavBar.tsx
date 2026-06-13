import { Link, useLocation, useNavigate } from 'react-router-dom'
import { DropdownMenu, type MenuItem } from '@components/ui'

interface PackingNavBarProps {
  title: string
  showBackArrow?: boolean
}

export function PackingNavBar({ title, showBackArrow = false }: PackingNavBarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const isOnTrips = location.pathname === '/packing' || location.pathname === '/packing/'
  const isOnTripDetail = location.pathname.startsWith('/packing/trip/')

  const menuItems: MenuItem[] = [
    ...(!isOnTrips && !isOnTripDetail ? [{ label: 'Trips', icon: '🎒', onClick: () => navigate('/packing') }] : []),
    { label: 'Master List', icon: '📋', to: '/packing/master-list' },
    { label: 'Settings', icon: '⚙️', to: '/packing/settings' },
    { divider: true, label: '' },
    { label: 'Exit Packing App', icon: '🏠', to: '/' },
  ]

  return (
    <nav style={{
      marginBottom: '1rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    }}>
      <div style={{ flex: '0 0 auto' }}>
        {showBackArrow ? (
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '1.5rem', padding: '0.375rem' }}
            title="Go back"
          >
            ←
          </button>
        ) : (
          <Link to="/packing" title="Packing Home" style={{ fontSize: '1.5rem', textDecoration: 'none' }}>
            🎒
          </Link>
        )}
      </div>

      <span style={{ fontWeight: 600, fontSize: '1.1rem', textAlign: 'center', flex: '1 1 auto' }}>
        {title}
      </span>

      <div style={{ flex: '0 0 auto' }}>
        <DropdownMenu items={menuItems} />
      </div>
    </nav>
  )
}
