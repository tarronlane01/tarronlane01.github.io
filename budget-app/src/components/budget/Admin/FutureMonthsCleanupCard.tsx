import { MONTH_NAMES } from '../../../constants'
import type { FutureMonthInfo } from '../../../data/queries/useSettingsMigrationQuery'
import { Spinner } from './MigrationComponents'

interface FutureMonthsCleanupCardProps {
  hasData: boolean
  futureMonthsCount: number
  futureMonthsToDelete: FutureMonthInfo[]
  isCleaningFutureMonths: boolean
  onCleanup: () => void
  disabled: boolean
  cleanupResult: {
    deleted: number
    errors: string[]
  } | null
}

export function FutureMonthsCleanupCard({
  hasData,
  futureMonthsCount,
  futureMonthsToDelete,
  isCleaningFutureMonths,
  onCleanup,
  disabled,
  cleanupResult,
}: FutureMonthsCleanupCardProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>🗑️ Clean Up Future Months</h3>
          <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
            Deletes month documents that are more than 2 months in the future. These can be created accidentally when navigating too far ahead.
          </p>
        </div>
        {hasData && futureMonthsCount === 0 && (
          <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Clean</span>
        )}
      </div>

      {!hasData ? (
        <p style={{ opacity: 0.6, fontSize: '0.9rem', margin: '1rem 0 0 0' }}>
          Click "Refresh All" to check for future months.
        </p>
      ) : futureMonthsCount > 0 ? (
        <>
          <div style={{
            background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem',
          }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#f59e0b' }}>
              ⚠️ Found {futureMonthsCount} month{futureMonthsCount !== 1 ? 's' : ''} to delete
            </p>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
              {futureMonthsToDelete.slice(0, 10).map((m) => (
                <li key={m.docId}>
                  {MONTH_NAMES[m.month - 1]} {m.year} (budget: {m.budgetId.slice(0, 8)}...)
                </li>
              ))}
              {futureMonthsCount > 10 && (
                <li style={{ opacity: 0.7 }}>...and {futureMonthsCount - 10} more</li>
              )}
            </ul>
          </div>

          <button
            onClick={onCleanup}
            disabled={isCleaningFutureMonths || disabled}
            style={{
              marginTop: '1rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: isCleaningFutureMonths ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: isCleaningFutureMonths ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {isCleaningFutureMonths ? (
              <>
                <Spinner noMargin /> Deleting...
              </>
            ) : (
              `🗑️ Delete ${futureMonthsCount} Future Month${futureMonthsCount !== 1 ? 's' : ''}`
            )}
          </button>
        </>
      ) : (
        <p style={{ margin: '1rem 0 0 0', opacity: 0.7, fontSize: '0.9rem' }}>
          No future months found beyond 2 months from now.
        </p>
      )}

      {/* Cleanup Results */}
      {cleanupResult && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: cleanupResult.errors.length > 0
            ? 'color-mix(in srgb, #f59e0b 10%, transparent)'
            : 'color-mix(in srgb, #22c55e 10%, transparent)',
          border: `1px solid ${cleanupResult.errors.length > 0 ? '#f59e0b' : '#22c55e'}`,
          borderRadius: '8px',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {cleanupResult.errors.length > 0 ? '⚠️' : '✓'} Deleted {cleanupResult.deleted} month{cleanupResult.deleted !== 1 ? 's' : ''}
            {cleanupResult.errors.length > 0 && ` (${cleanupResult.errors.length} error${cleanupResult.errors.length !== 1 ? 's' : ''})`}
          </p>
          {cleanupResult.errors.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#f59e0b' }}>
              {cleanupResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

