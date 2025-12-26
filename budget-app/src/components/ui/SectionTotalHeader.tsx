import type { ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'

interface SectionTotalHeaderProps {
  label: string
  value: ReactNode
  action?: ReactNode
  /** Action displayed inline with the value (e.g., edit icon) */
  inlineAction?: ReactNode
  /** Display label and value on the same line */
  compact?: boolean
}

export function SectionTotalHeader({ label, value, action, inlineAction, compact }: SectionTotalHeaderProps) {
  const isMobile = useIsMobile()

  if (compact) {
    return (
      <div style={{
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{label}:</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{value}</span>
          </span>
          {action}
        </div>
        {inlineAction}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? '0.75rem' : '1rem',
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
    }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{label}</h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          margin: '0.25rem 0 0 0',
        }}>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 600,
          }}>
            {value}
          </span>
          {inlineAction}
        </div>
      </div>
      {action}
    </div>
  )
}

