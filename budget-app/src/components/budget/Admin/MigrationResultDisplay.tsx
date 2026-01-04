/**
 * Migration Results Display Component
 */

import type { BudgetMigrationResult } from './MigrationComponents'

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

