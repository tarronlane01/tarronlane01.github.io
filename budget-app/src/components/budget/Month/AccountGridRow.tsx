/**
 * AccountGridRow - Desktop grid row for a single account balance.
 * Renders as grid items (display: contents) within AccountGroupRows.
 */

import type { FinancialAccount, AccountMonthBalance } from '@types'
import type { AccountClearedBalance } from '@calculations'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '@styles/shared'

function getIncomeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}
function getExpenseColor(value: number): string {
  if (value === 0) return colors.zero
  return value < 0 ? colors.error : colors.success
}
function getNetChangeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

const NUM_COL_MIN = '5rem'
const ACCOUNTS_GRID_COLUMNS = `2fr repeat(8, minmax(${NUM_COL_MIN}, 1fr))`
const numericCellStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
}

export interface AccountGridRowProps {
  account: FinancialAccount
  balance: AccountMonthBalance
  clearedBalance?: AccountClearedBalance
  isEvenRow: boolean
  hasUnclearedDetail: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}

export function AccountGridRow({
  account,
  balance,
  clearedBalance,
  isEvenRow,
  hasUnclearedDetail,
  isExpanded,
  onToggleExpand,
}: AccountGridRowProps) {
  const rowBg = isEvenRow ? 'transparent' : 'var(--row-alt-bg)'
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }
  const numericStyle = { ...cellStyle, ...numericCellStyle, justifyContent: 'flex-end' as const }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: ACCOUNTS_GRID_COLUMNS,
    }}>
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.nickname}</span>
      </div>
      <div style={{ ...numericStyle, color: getBalanceColor(balance.start_balance) }}>
        {formatBalanceCurrency(balance.start_balance)}
      </div>
      <div style={{ ...numericStyle, color: getIncomeColor(balance.income) }}>
        +{formatCurrency(balance.income)}
      </div>
      <div style={{ ...numericStyle, color: getExpenseColor(balance.expenses) }}>
        {formatSignedCurrency(balance.expenses)}
      </div>
      <div style={{ ...numericStyle, color: getNetChangeColor(balance.transfers) }}>
        {formatSignedCurrencyAlways(balance.transfers)}
      </div>
      <div style={{ ...numericStyle, color: getNetChangeColor(balance.adjustments) }}>
        {formatSignedCurrencyAlways(balance.adjustments)}
      </div>
      <div style={{ ...numericStyle, color: getNetChangeColor(balance.net_change) }}>
        {formatSignedCurrencyAlways(balance.net_change)}
      </div>
      <div style={{ ...numericStyle, fontWeight: 600, color: getBalanceColor(balance.end_balance) }}>
        {formatBalanceCurrency(balance.end_balance)}
      </div>
      <div style={{ ...numericStyle, gap: '0.25rem', color: clearedBalance ? getBalanceColor(clearedBalance.uncleared_balance) : undefined, fontWeight: 600 }}>
        {clearedBalance ? (
          <>
            <span>{formatBalanceCurrency(clearedBalance.uncleared_balance)}</span>
            {hasUnclearedDetail && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
                title={isExpanded ? 'Hide cleared/uncleared breakdown' : 'Show cleared/uncleared breakdown'}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.5rem', opacity: 0.5,
                  padding: '0.1rem', borderRadius: '2px', transition: 'transform 0.15s',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </button>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
        )}
      </div>
    </div>
  )
}
