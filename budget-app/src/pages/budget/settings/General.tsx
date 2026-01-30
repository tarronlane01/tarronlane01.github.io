/**
 * General Budget Settings
 *
 * Budget-level settings that affect allocation behavior (e.g. percentage income reference).
 */

import { useState, useEffect } from 'react'
import { useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { writeBudgetData } from '@data/mutations/budget/writeBudgetData'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget/fetchBudget'
import { recalculateCachedMonthsForMonthsBackChange } from '@hooks/useLocalRecalculation'
import { bannerQueue } from '@components/ui'

const MIN_MONTHS_BACK = 1
const MAX_MONTHS_BACK = 12

export default function General() {
  const { selectedBudgetId } = useBudget()
  const { budget, isLoading } = useBudgetData()
  // Display value; ?? 1 only for legacy unmigrated budget (migration sets field on all budgets)
  const monthsBack = budget?.percentage_income_months_back ?? 1

  const [localMonthsBack, setLocalMonthsBack] = useState(monthsBack)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Sync local state when budget loads or changes
  useEffect(() => {
    setLocalMonthsBack(budget?.percentage_income_months_back ?? 1)
  }, [budget?.percentage_income_months_back])

  const clampedValue = Math.min(MAX_MONTHS_BACK, Math.max(MIN_MONTHS_BACK, Math.round(Number(localMonthsBack)) || 1))

  async function handleSave() {
    if (!selectedBudgetId) return
    const value = clampedValue
    setSaveError(null)
    setSaving(true)
    try {
      await writeBudgetData({
        budgetId: selectedBudgetId,
        updates: { percentage_income_months_back: value },
        description: 'update percentage income months back',
      })
      queryClient.setQueryData<BudgetData>(queryKeys.budget(selectedBudgetId), (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          budget: { ...prev.budget, percentage_income_months_back: value },
        }
      })
      // Recalculate cached months locally so unfinalized months immediately show correct % allocation values
      await recalculateCachedMonthsForMonthsBackChange(selectedBudgetId, value, queryClient)
      setLocalMonthsBack(value)
      setSaveError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      console.error('[Settings/General] Failed to save percentage income months back:', err)
      bannerQueue.add({
        type: 'error',
        message: 'Failed to save setting. See console for details.',
        autoDismissMs: 0,
      })
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const hasChange = clampedValue !== monthsBack

  if (isLoading || !budget) {
    return (
      <div style={{ padding: '1rem' }}>
        <p style={{ opacity: 0.7 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '32rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Budget behavior</h3>

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="percentage-income-months-back" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
          Income reference for % allocations (months back)
        </label>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.5rem 0' }}>
          Percentage-based category allocations use income from this many months ago. Use 1 for “previous month” or 2 if you budget for the month after next.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            id="percentage-income-months-back"
            type="number"
            min={MIN_MONTHS_BACK}
            max={MAX_MONTHS_BACK}
            value={localMonthsBack}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') setLocalMonthsBack(1)
              else setLocalMonthsBack(Math.min(MAX_MONTHS_BACK, Math.max(MIN_MONTHS_BACK, Math.round(Number(v)) || 1)))
            }}
            style={{
              width: '4rem',
              padding: '0.4rem 0.5rem',
              fontSize: '1rem',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
            }}
          />
          <span style={{ opacity: 0.7 }}>month(s) back</span>
          {hasChange && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.4rem 0.75rem',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
        {saveError && (
          <p style={{ marginTop: '0.5rem', color: 'var(--color-error)', fontSize: '0.9rem' }} aria-live="polite">
            Save failed. See banner for details.
          </p>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
        Changing this only affects non-finalized allocation calculations. Finalized months keep their existing amounts.
      </p>
    </div>
  )
}
