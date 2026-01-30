import type { ReactNode } from 'react'
import { logUserAction } from '@utils/actionLogger'

export interface MigrationStatus {
  categoriesArrayMigrationNeeded: boolean
  accountsArrayMigrationNeeded: boolean
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  loading: boolean
}

export interface BudgetMigrationResult {
  budgetId: string
  budgetName: string
  categoriesMigrated: number
  accountsMigrated: number
  accountGroupsMigrated: number
  balancesCalculated: boolean
  error?: string
}

// Simple CSS spinner component
export function Spinner({ noMargin }: { noMargin?: boolean } = {}) {
  return (
    <span style={{
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid var(--border-strong)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: noMargin ? 0 : '0.5rem',
      verticalAlign: 'middle',
    }} />
  )
}

// =============================================================================
// COMMON MIGRATION CARD - Base component for all migration cards
// =============================================================================

export type MigrationCardStatus = 'unknown' | 'clean' | 'needs-action' | 'complete'

interface MigrationCardProps {
  /** Card title (with emoji if desired) */
  title: string
  /** Description of what this migration does */
  description: string
  /** Current status of this migration */
  status: MigrationCardStatus
  /** Optional custom status text (defaults based on status) */
  statusText?: string
  /** Handler for refresh button */
  onRefresh: () => void
  /** Whether the card is currently refreshing */
  isRefreshing: boolean
  /** Whether the card is busy with an action (disables refresh) */
  isBusy?: boolean
  /** Content to display in the card body */
  children?: ReactNode
  /** Name for action logging */
  cardName?: string
}

/**
 * Common migration card component that provides consistent structure for all migrations
 */
export function MigrationCard({
  title,
  description,
  status,
  statusText,
  onRefresh,
  isRefreshing,
  isBusy = false,
  children,
  cardName,
}: MigrationCardProps) {
  const name = cardName || title
  const getStatusStyle = () => {
    switch (status) {
      case 'unknown':
        return { color: 'var(--text-muted)', text: statusText ?? 'Unknown' }
      case 'clean':
      case 'complete':
        return { color: 'var(--color-success)', text: statusText ?? '✓ Clean' }
      case 'needs-action':
        return { color: 'var(--color-warning)', text: statusText ?? 'Action Needed' }
    }
  }

  const statusStyle = getStatusStyle()
  const isDisabled = isRefreshing || isBusy

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>{title}</h3>
          <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {status !== 'unknown' && (
            <span style={{ color: statusStyle.color, fontWeight: 600, fontSize: '0.9rem' }}>
              {statusStyle.text}
            </span>
          )}
          <button
            onClick={() => { logUserAction('CLICK', `Refresh ${name}`); onRefresh() }}
            disabled={isDisabled}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              color: 'inherit',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem',
              opacity: isDisabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title="Refresh status"
          >
            {isRefreshing ? <Spinner noMargin /> : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}

// =============================================================================
// STANDARDIZED CONTENT COMPONENTS - Use these inside MigrationCard
// =============================================================================

type StatusBoxType = 'unknown' | 'clean' | 'warning' | 'running' | 'success'

const statusBoxStyles: Record<StatusBoxType, { bg: string; border: string; color: string }> = {
  unknown: {
    bg: 'var(--color-error-bg)',
    border: 'var(--color-error-border)',
    color: 'var(--text-muted)',
  },
  clean: {
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
    color: 'var(--color-success)',
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
    color: 'var(--color-warning)',
  },
  running: {
    bg: 'var(--row-alt-bg)',
    border: 'var(--border-strong)',
    color: 'var(--text-primary)',
  },
  success: {
    bg: 'var(--color-success-bg)',
    border: 'var(--color-success-border)',
    color: 'var(--color-success)',
  },
}

/** Standardized status message box */
export function StatusBox({
  type,
  children,
}: {
  type: StatusBoxType
  children: ReactNode
}) {
  const style = statusBoxStyles[type]
  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.color,
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
    }}>
      {children}
    </div>
  )
}

/** Standardized action button */
export function ActionButton({
  onClick,
  disabled,
  isBusy,
  busyText,
  children,
  actionName,
}: {
  onClick: () => void
  disabled?: boolean
  isBusy?: boolean
  busyText?: string
  children: ReactNode
  actionName?: string
}) {
  const isDisabled = disabled || isBusy
  return (
    <button
      onClick={() => { if (actionName) logUserAction('CLICK', actionName); onClick() }}
      disabled={isDisabled}
      style={{
        marginTop: '1rem',
        background: 'var(--color-primary)',
        color: 'white',
        border: 'none',
        padding: '0.75rem 1.5rem',
        borderRadius: '8px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontWeight: 500,
        opacity: isDisabled ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {isBusy ? (
        <>
          <Spinner noMargin /> {busyText ?? 'Running...'}
        </>
      ) : (
        children
      )}
    </button>
  )
}

// =============================================================================
// DATA MIGRATION CARD - Uses MigrationCard for array-to-map migrations
// =============================================================================

interface MigrationStatusCardProps {
  title: string
  description: string
  isComplete: boolean
  isMigrating: boolean
  needsMigration: boolean
  totalBudgetsToMigrate: number
  budgetsToMigrateCategories: number
  budgetsToMigrateAccounts: number
  onRunMigration: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
  isUnknown?: boolean
  children?: ReactNode
}

export function MigrationStatusCard({
  title,
  description,
  isComplete,
  isMigrating,
  needsMigration,
  totalBudgetsToMigrate,
  budgetsToMigrateCategories,
  budgetsToMigrateAccounts,
  onRunMigration,
  onRefresh,
  isRefreshing,
  disabled,
  isUnknown,
  children,
}: MigrationStatusCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (isUnknown) return 'unknown'
    if (isComplete) return 'complete'
    if (needsMigration) return 'needs-action'
    return 'clean'
  }

  const getStatusText = (): string => {
    if (isUnknown) return 'Unknown'
    if (isComplete) return '✓ Complete'
    if (needsMigration) return 'Required'
    return '✓ Clean'
  }

  return (
    <MigrationCard
      title={title}
      description={description}
      status={getStatus()}
      statusText={getStatusText()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isMigrating}
    >
      {isMigrating ? (
        <StatusBox type="running">
          <Spinner /> Running migration across all budgets...
        </StatusBox>
      ) : isUnknown ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to check migration status
        </StatusBox>
      ) : isComplete ? (
        <StatusBox type="clean">
          ✅ All budgets are using the new map structure
        </StatusBox>
      ) : needsMigration ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalBudgetsToMigrate} budget(s) needing migration:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {budgetsToMigrateCategories > 0 && (
                  <li>{budgetsToMigrateCategories} with categories to migrate</li>
                )}
                {budgetsToMigrateAccounts > 0 && (
                  <li>{budgetsToMigrateAccounts} with accounts to migrate</li>
                )}
              </ul>
            </div>
          </StatusBox>
          <ActionButton onClick={onRunMigration} disabled={disabled}>
            Migrate All Budgets
          </ActionButton>
        </>
      ) : null}

      {children}
    </MigrationCard>
  )
}

// Re-export for backwards compatibility
export { MigrationResults } from './MigrationResultDisplay'

