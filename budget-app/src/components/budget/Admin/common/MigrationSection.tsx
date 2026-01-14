/**
 * Migration Section Component
 *
 * Container component for grouping related migrations.
 * Provides consistent styling and optional header actions.
 */

import type { ReactNode } from 'react'
import { Spinner } from '../MigrationComponents'
import { logUserAction } from '@utils/actionLogger'

export type SectionType = 'onetime' | 'maintenance' | 'utility'

interface MigrationSectionProps {
  /** Section title */
  title: string
  /** Section icon/emoji */
  icon: string
  /** Description of this section */
  description: string
  /** Type of section for styling */
  type: SectionType
  /** Child migration rows */
  children: ReactNode
  /** Optional: Handler for "Validate All" button (maintenance section) */
  onValidateAll?: () => Promise<void>
  /** Whether validation is running */
  isValidating?: boolean
  /** Whether any migration in section is running */
  isAnyRunning?: boolean
}

const sectionStyles: Record<SectionType, { borderColor: string; iconBg: string }> = {
  onetime: {
    borderColor: 'color-mix(in srgb, #a855f7 30%, transparent)',
    iconBg: 'color-mix(in srgb, #a855f7 15%, transparent)',
  },
  maintenance: {
    borderColor: 'color-mix(in srgb, #3b82f6 30%, transparent)',
    iconBg: 'color-mix(in srgb, #3b82f6 15%, transparent)',
  },
  utility: {
    borderColor: 'color-mix(in srgb, #22c55e 30%, transparent)',
    iconBg: 'color-mix(in srgb, #22c55e 15%, transparent)',
  },
}

export function MigrationSection({
  title,
  icon,
  description,
  type,
  children,
  onValidateAll,
  isValidating = false,
  isAnyRunning = false,
}: MigrationSectionProps) {
  const styles = sectionStyles[type]
  const isDisabled = isValidating || isAnyRunning

  const handleValidateAll = () => {
    if (onValidateAll && !isDisabled) {
      logUserAction('CLICK', `Validate All - ${title}`)
      onValidateAll()
    }
  }

  return (
    <section style={{
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      border: `1px solid ${styles.borderColor}`,
      borderRadius: '12px',
      marginBottom: '1.5rem',
      overflow: 'hidden',
    }}>
      {/* Section Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: `1px solid ${styles.borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
          <span style={{
            fontSize: '1.5rem',
            background: styles.iconBg,
            padding: '0.5rem',
            borderRadius: '8px',
            lineHeight: 1,
          }}>
            {icon}
          </span>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{title}</h3>
            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85rem' }}>
              {description}
            </p>
          </div>
        </div>

        {/* Validate All button for maintenance section */}
        {onValidateAll && (
          <button
            onClick={handleValidateAll}
            disabled={isDisabled}
            style={{
              background: 'color-mix(in srgb, #3b82f6 20%, transparent)',
              color: '#60a5fa',
              border: '1px solid color-mix(in srgb, #3b82f6 40%, transparent)',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem',
              opacity: isDisabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0,
            }}
          >
            {isValidating ? (
              <>
                <Spinner noMargin /> Validating...
              </>
            ) : (
              '🔍 Validate All'
            )}
          </button>
        )}
      </div>

      {/* Migration Rows */}
      <div style={{ padding: '0.5rem' }}>
        {children}
      </div>
    </section>
  )
}

