import type { ReactNode } from 'react'

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
      border: '2px solid rgba(255, 255, 255, 0.3)',
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
}: MigrationCardProps) {
  const getStatusStyle = () => {
    switch (status) {
      case 'unknown':
        return { color: '#9ca3af', text: statusText ?? 'Unknown' }
      case 'clean':
      case 'complete':
        return { color: '#22c55e', text: statusText ?? '✓ Clean' }
      case 'needs-action':
        return { color: '#f59e0b', text: statusText ?? 'Action Needed' }
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
            onClick={onRefresh}
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
    bg: 'rgba(100, 100, 100, 0.1)',
    border: 'rgba(100, 100, 100, 0.3)',
    color: '#9ca3af',
  },
  clean: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.3)',
    color: '#4ade80',
  },
  warning: {
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.3)',
    color: '#fbbf24',
  },
  running: {
    bg: 'rgba(100, 108, 255, 0.1)',
    border: 'rgba(100, 108, 255, 0.3)',
    color: '#a5b4fc',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.3)',
    color: '#4ade80',
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
}: {
  onClick: () => void
  disabled?: boolean
  isBusy?: boolean
  busyText?: string
  children: ReactNode
}) {
  const isDisabled = disabled || isBusy
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        marginTop: '1rem',
        background: '#646cff',
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

// Migration results display
export function MigrationResults({ results }: { results: BudgetMigrationResult[] }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Migration Results:</h4>
      <div style={{
        maxHeight: '300px',
        overflowY: 'auto',
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        borderRadius: '8px',
        padding: '0.75rem',
      }}>
        {results.map((result, idx) => (
          <MigrationResultItem key={idx} result={result} isLast={idx === results.length - 1} />
        ))}
      </div>
    </div>
  )
}

function MigrationResultItem({ result, isLast }: { result: BudgetMigrationResult; isLast: boolean }) {
  const hasError = result.error && result.error !== 'Already migrated'
  const isSkipped = result.error === 'Already migrated'

  return (
    <div
      style={{
        padding: '0.5rem',
        marginBottom: isLast ? 0 : '0.5rem',
        borderRadius: '4px',
        background: hasError
          ? 'rgba(220, 38, 38, 0.1)'
          : isSkipped
            ? 'rgba(100, 100, 100, 0.1)'
            : 'rgba(34, 197, 94, 0.1)',
        border: hasError
          ? '1px solid rgba(220, 38, 38, 0.3)'
          : isSkipped
            ? '1px solid rgba(100, 100, 100, 0.3)'
            : '1px solid rgba(34, 197, 94, 0.3)',
      }}
    >
      <div style={{ fontWeight: 500 }}>
        {hasError ? '❌' : isSkipped ? '⏭️' : '✅'} {result.budgetName}
      </div>
      {hasError ? (
        <div style={{ fontSize: '0.85rem', opacity: 0.8, color: '#f87171' }}>
          Error: {result.error}
        </div>
      ) : isSkipped ? (
        <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
          Already using map structure
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {result.categoriesMigrated > 0 && `Migrated ${result.categoriesMigrated} categories`}
          {result.categoriesMigrated > 0 && (result.accountsMigrated > 0 || result.accountGroupsMigrated > 0) && ', '}
          {result.accountsMigrated > 0 && `${result.accountsMigrated} accounts`}
          {result.accountsMigrated > 0 && result.accountGroupsMigrated > 0 && ', '}
          {result.accountGroupsMigrated > 0 && `${result.accountGroupsMigrated} account groups`}
          {result.balancesCalculated && ' with calculated balances'}
        </div>
      )}
    </div>
  )
}

