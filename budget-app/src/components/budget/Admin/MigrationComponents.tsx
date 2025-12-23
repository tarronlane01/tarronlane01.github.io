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
export function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '0.5rem',
      verticalAlign: 'middle',
    }} />
  )
}

// Migration status card for a single migration type
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
  disabled: boolean
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
  disabled,
  children,
}: MigrationStatusCardProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      padding: '1.5rem',
      borderRadius: '8px',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          background: isComplete ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 108, 255, 0.2)',
          color: isComplete ? '#4ade80' : '#a5b4fc',
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {isComplete ? 'Complete' : 'Required'}
        </span>
        {title}
      </h3>
      <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
        {description}
      </p>

      {isMigrating ? (
        <div style={{
          background: 'rgba(100, 108, 255, 0.1)',
          border: '1px solid rgba(100, 108, 255, 0.3)',
          color: '#a5b4fc',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <Spinner /> Running migration across all budgets...
        </div>
      ) : isComplete ? (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#4ade80',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
        }}>
          ✅ All budgets are using the new map structure
        </div>
      ) : needsMigration ? (
        <>
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}>
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

          <button
            onClick={onRunMigration}
            disabled={disabled}
            style={{
              background: '#646cff',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: disabled ? 0.7 : 1,
            }}
          >
            Migrate All Budgets
          </button>
        </>
      ) : null}

      {children}
    </div>
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

