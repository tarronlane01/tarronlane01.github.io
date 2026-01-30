/**
 * Settings Category Stats Header
 *
 * Displays category statistics and validation warnings at the top of the settings page.
 */

import { formatStatsCurrency, getBalanceColor, getAllocatedColor } from '@components/ui'

interface SettingsCategoryStatsHeaderProps {
  onBudgetTotal: number
  allocated: number
  unallocated: number
  relationshipMismatch: boolean
  calculationMismatch: boolean
}

export function SettingsCategoryStatsHeader({
  onBudgetTotal,
  allocated,
  unallocated,
  relationshipMismatch,
  calculationMismatch: _calculationMismatch,
}: SettingsCategoryStatsHeaderProps) {
  // calculationMismatch prop kept for API compatibility but not currently used
  void _calculationMismatch
  return (
    <div style={{
      gridColumn: '1 / -1',
      marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
      marginRight: 'calc(-1 * var(--page-padding, 2rem))',
      paddingLeft: 'var(--page-padding, 2rem)',
      paddingRight: 'var(--page-padding, 2rem)',
      paddingTop: '0.5rem',
      paddingBottom: '0.5rem',
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 1rem',
        fontSize: '0.85rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border-medium)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Categories:</span>
          <span>
            <span style={{ opacity: 0.6 }}>On Budget: </span>
            <span style={{ color: getBalanceColor(onBudgetTotal), fontWeight: 600 }}>{formatStatsCurrency(onBudgetTotal)}</span>
          </span>
          <span style={{ opacity: relationshipMismatch ? 1 : 0.5, color: relationshipMismatch ? 'var(--color-error)' : undefined, fontWeight: relationshipMismatch ? 700 : undefined }}>
            {relationshipMismatch ? '≠' : '='}
          </span>
          <span>
            <span style={{ opacity: 0.6 }}>Allocated: </span>
            <span style={{ color: getAllocatedColor(allocated), fontWeight: 600 }}>{formatStatsCurrency(allocated)}</span>
          </span>
          <span style={{ opacity: relationshipMismatch ? 1 : 0.5, color: relationshipMismatch ? 'var(--color-error)' : undefined, fontWeight: relationshipMismatch ? 700 : undefined }}>
            +
          </span>
          <span>
            <span style={{ opacity: 0.6 }}>Unallocated: </span>
            <span style={{ color: getBalanceColor(unallocated), fontWeight: 600 }}>{formatStatsCurrency(unallocated)}</span>
          </span>
          {/* Warnings disabled per user request */}
          {/* {relationshipMismatch && (
            <span style={{ color: 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600 }}>
              ⚠️ Mismatch: {formatCurrency(Math.abs(onBudgetTotal - (allocated + unallocated)))}
            </span>
          )}
          {calculationMismatch && !relationshipMismatch && (
            <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600 }}>
              ⚠️ Balance sync issue
            </span>
          )} */}
          <span style={{ opacity: 0.6 }}>
            Use ▲▼ buttons to reorder categories.
          </span>
        </div>
      </div>
    </div>
  )
}
