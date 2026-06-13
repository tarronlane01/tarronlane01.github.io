import { Link } from 'react-router-dom'
import { colors } from '@styles/shared'

interface PrerequisiteWarningProps {
  message: string
  linkText: string
  linkTo: string
}

/**
 * A prominent warning banner shown when prerequisites (accounts/categories)
 * are missing. Features a pulsing yellow border to draw attention.
 */
export function PrerequisiteWarning({ message, linkText, linkTo }: PrerequisiteWarningProps) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: `color-mix(in srgb, ${colors.warning} 12%, transparent)`,
        border: `2px solid ${colors.warning}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        margin: '0.75rem 0',
        animation: 'warningPulse 2s ease-in-out infinite',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>⚠️</span>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <p style={{
            margin: 0,
            fontWeight: 500,
            color: colors.warning,
            fontSize: '0.95rem',
          }}>
            {message}
          </p>
          <Link
            to={linkTo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              marginTop: '0.5rem',
              color: colors.warning,
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            {linkText} →
          </Link>
        </div>
      </div>
    </div>
  )
}

