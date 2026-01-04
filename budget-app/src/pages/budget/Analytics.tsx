import { useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { colors } from '@styles/shared'

function Analytics() {
  const { setPageTitle } = useBudget()

  // Set page title for layout header
  useLayoutEffect(() => { setPageTitle('Analytics') }, [setPageTitle])

  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        textAlign: 'center',
        gap: '1.5rem',
      }}>
        <div style={{
          fontSize: '4rem',
          opacity: 0.8,
        }}>
          📊
        </div>
        <h1 style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 600,
        }}>
          Analytics
        </h1>
        <p style={{
          margin: 0,
          fontSize: '1.25rem',
          opacity: 0.6,
          maxWidth: '400px',
        }}>
          Coming Soon
        </p>
        <p style={{
          margin: 0,
          fontSize: '0.95rem',
          opacity: 0.5,
          maxWidth: '500px',
          lineHeight: 1.6,
        }}>
          Track spending trends, category breakdowns, and insights about your budget over time.
        </p>
        <Link
          to="/budget"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: colors.primary,
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 500,
            transition: 'opacity 0.15s',
          }}
        >
          Back to Budget
        </Link>
      </div>
  )
}

export default Analytics
