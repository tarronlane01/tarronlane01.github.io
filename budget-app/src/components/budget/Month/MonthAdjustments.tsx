import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useMonthData } from '@hooks'
import { useIsMobile } from '@hooks'
import { usePayeesQuery } from '@data'
import { useAddAdjustment, useUpdateAdjustment, useDeleteAdjustment } from '@data/mutations/month'
import type { FinancialAccount } from '@types'
import { Button } from '../../ui'
import { colors } from '@styles/shared'
import { AdjustmentForm } from '../Adjustments'
import { AdjustmentGridRow } from './AdjustmentGridRow'
import { logUserAction, getDefaultFormDate, parseDateToYearMonth } from '@utils'
import { isNoCategory, NO_CATEGORY_NAME, isNoAccount, NO_ACCOUNT_NAME } from '@data/constants'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem',
  borderTop: '1px solid rgba(255,255,255,0.1)',
}

export function MonthAdjustments() {
  const { selectedBudgetId, currentYear, currentMonthNumber, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const { accounts, accountGroups, categories, categoryGroups } = useBudgetData()
  const { month: currentMonth, isLoading: monthLoading } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  // Adjustment mutations - imported directly
  const { addAdjustment } = useAddAdjustment()
  const { updateAdjustment } = useUpdateAdjustment()
  const { deleteAdjustment } = useDeleteAdjustment()

  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [showAddAdjustment, setShowAddAdjustment] = useState(false)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null)

  // Note: Recalculation is NOT triggered on this tab since it only shows raw transactions.

  // Only fetch payees when a form is open (lazy loading)
  const isFormOpen = showAddAdjustment || editingAdjustmentId !== null
  const payeesQuery = usePayeesQuery(selectedBudgetId, { enabled: isFormOpen })
  const payees = payeesQuery.data || []

  // Helper to get effective is_active value considering group overrides
  function getEffectiveActive(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.is_active !== undefined) return group.is_active
    return account.is_active !== false
  }

  // Helper to get effective on_budget value considering group overrides
  function getEffectiveOnBudget(account: FinancialAccount): boolean {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    if (group?.on_budget !== undefined) return group.on_budget
    return account.on_budget !== false
  }

  // Account entry type for working with accounts map
  type AccountEntry = [string, FinancialAccount]

  // Filter accounts for adjustment dropdown - all active on-budget accounts
  const activeOnBudgetAccounts = Object.entries(accounts).filter(
    ([, a]) => getEffectiveActive(a) && getEffectiveOnBudget(a)
  ) as AccountEntry[]

  // Handle adjustment operations
  // Note: Mutations handle optimistic cache updates internally
  function handleAddAdjustment(amount: number, accountId: string, categoryId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    if (!selectedBudgetId) return
    setError(null)
    setShowAddAdjustment(false) // Close form immediately - mutation handles optimistic update

    // Parse the date to determine which month this adjustment belongs to
    const { year: adjustmentYear, month: adjustmentMonth } = parseDateToYearMonth(date)

    // Navigate to target month if different
    if (adjustmentYear !== currentYear || adjustmentMonth !== currentMonthNumber) {
      setCurrentYear(adjustmentYear)
      setCurrentMonthNumber(adjustmentMonth)
    }

    // Call mutation directly with explicit params
    addAdjustment(selectedBudgetId, adjustmentYear, adjustmentMonth, amount, accountId, categoryId, date, payee, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to add adjustment')
      })
  }

  function handleUpdateAdjustment(adjustmentId: string, amount: number, accountId: string, categoryId: string, date: string, payee?: string, description?: string, cleared?: boolean) {
    if (!selectedBudgetId) return
    setError(null)
    setEditingAdjustmentId(null) // Close form immediately - mutation handles optimistic update

    // Call mutation directly with explicit params
    updateAdjustment(selectedBudgetId, currentYear, currentMonthNumber, adjustmentId, amount, accountId, categoryId, date, payee, description, cleared)
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to update adjustment')
      })
  }

  function handleDeleteAdjustment(adjustmentId: string) {
    if (!selectedBudgetId) return
    if (!confirm('Are you sure you want to delete this adjustment?')) return
    setError(null)

    // Call mutation directly with explicit params
    deleteAdjustment(selectedBudgetId, currentYear, currentMonthNumber, adjustmentId).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to delete adjustment')
    })
  }

  return (
    <div style={{
      opacity: monthLoading ? 0.5 : 1,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: monthLoading ? 'none' : 'auto',
    }}>
      {error && (
        <div style={{
          background: `color-mix(in srgb, ${colors.error} 15%, transparent)`,
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '1rem',
          color: colors.error,
        }}>
          {error}
        </div>
      )}

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '5rem 1fr 1fr 6rem 1.5fr 3rem 4rem',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: '#242424',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Stats + Button row - spans all columns */}
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem 1rem',
            fontSize: '0.85rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Adjustments:</span>
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                Incoming or outgoing transactions that should bypass income and spend calculations
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {!showAddAdjustment && (
                <Button
                  actionName="Open Add Adjustment Form"
                  onClick={() => setShowAddAdjustment(true)}
                  disabled={Object.keys(categories).length === 0 && activeOnBudgetAccounts.length === 0}
                  style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
                >
                  + Add Adjustment
                </Button>
              )}
            </div>
          </div>

          {/* Column headers - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Date</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>Category</div>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Amount</div>
              <div style={columnHeaderStyle}>Description</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'center' }}>Clr</div>
              <div style={columnHeaderStyle}></div>
            </>
          )}
        </div>

        {/* Warning messages - span all columns */}
        {activeOnBudgetAccounts.length === 0 && Object.keys(categories).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: '0.9rem', padding: '1rem 0' }}>
            You need to create at least one account or category before adding adjustments.{' '}
            <Link to="/budget/accounts" style={{ opacity: 1 }}>
              Manage accounts →
            </Link>
          </p>
        )}

        {/* Add Adjustment Form - spans all columns */}
        {showAddAdjustment && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
            <AdjustmentForm
              accounts={activeOnBudgetAccounts}
              accountGroups={accountGroups}
              categories={categories}
              categoryGroups={categoryGroups}
              payees={payees}
              defaultDate={getDefaultFormDate(currentYear, currentMonthNumber)}
              onSubmit={handleAddAdjustment}
              onCancel={() => setShowAddAdjustment(false)}
              submitLabel="Add Adjustment"
            />
          </div>
        )}

        {/* Adjustments List - each row uses display: contents */}
        {currentMonth?.adjustments
          ?.slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map((adjustment, index) => (
            editingAdjustmentId === adjustment.id ? (
              <div key={adjustment.id} style={{ gridColumn: '1 / -1', padding: '0.5rem' }}>
                <AdjustmentForm
                  accounts={activeOnBudgetAccounts}
                  accountGroups={accountGroups}
                  categories={categories}
                  categoryGroups={categoryGroups}
                  payees={payees}
                  initialData={adjustment}
                  onSubmit={(amount, accountId, categoryId, date, payee, description, cleared) =>
                    handleUpdateAdjustment(adjustment.id, amount, accountId, categoryId, date, payee, description, cleared)
                  }
                  onCancel={() => setEditingAdjustmentId(null)}
                  onDelete={() => handleDeleteAdjustment(adjustment.id)}
                  submitLabel="Save"
                />
              </div>
            ) : (
              <AdjustmentGridRow
                key={adjustment.id}
                adjustment={adjustment}
                categoryName={isNoCategory(adjustment.category_id) ? NO_CATEGORY_NAME : (categories[adjustment.category_id]?.name || 'Unknown Category')}
                accountName={isNoAccount(adjustment.account_id) ? NO_ACCOUNT_NAME : (accounts[adjustment.account_id]?.nickname || 'Unknown Account')}
                accountGroupName={
                  isNoAccount(adjustment.account_id) ? undefined : (
                    accounts[adjustment.account_id]?.account_group_id
                      ? accountGroups[accounts[adjustment.account_id]!.account_group_id!]?.name
                      : undefined
                  )
                }
                onEdit={() => {
                  logUserAction('CLICK', 'Edit Adjustment', { details: adjustment.description || `$${adjustment.amount}` })
                  setEditingAdjustmentId(adjustment.id)
                }}
                onDelete={() => handleDeleteAdjustment(adjustment.id)}
                isMobile={isMobile}
                isEvenRow={index % 2 === 0}
              />
            )
          ))}

        {/* Empty state - spans all columns */}
        {(!currentMonth?.adjustments || currentMonth.adjustments.length === 0) && !showAddAdjustment && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.5, fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
            No adjustments recorded for this month
          </p>
        )}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </div>
  )
}
