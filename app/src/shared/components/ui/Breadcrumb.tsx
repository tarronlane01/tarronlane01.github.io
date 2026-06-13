import { Link } from 'react-router-dom'
import { logUserAction } from '@utils'

export interface BreadcrumbItem {
  label: string
  to?: string // If undefined, it's the current page (not a link)
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.85rem',
      opacity: 0.7,
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    }}>
      {items.map((item, index) => (
        <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {index > 0 && <span style={{ opacity: 0.5 }}>›</span>}
          {item.to ? (
            <Link
              to={item.to}
              onClick={() => logUserAction('NAVIGATE', `Breadcrumb: ${item.label}`)}
              style={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = ''}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ opacity: 0.8 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

