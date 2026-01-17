import { useState, useEffect, useRef } from 'react'
import { useApp } from '@contexts'
import { useBudget } from '@contexts'
import { useBudgetData, useMonthData } from '@hooks'
import { colors } from '@styles/shared'
import { MONTH_NAMES } from '@constants'
import { RecalculateAllButton } from './RecalculateAllButton'
import { logUserAction, getYearMonthOrdinal, getMonthDocId } from '@utils'
import {
  MonthNavButton,
  MonthPicker,
  DeleteMonthModal,
  getPrevMonth,
  getNextMonth,
  getEffectiveMinMonth,
  getMaxAllowedMonth,
} from './MonthNavigation/index'
// eslint-disable-next-line no-restricted-imports
import { deleteDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'
import JSZip from 'jszip'

interface MonthNavigationProps {
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export function MonthNavigation({
  onPreviousMonth,
  onNextMonth,
}: MonthNavigationProps) {
  const { isLoading } = useApp()
  const {
    currentYear,
    currentMonthNumber,
    isAdmin,
    selectedBudgetId,
    setCurrentYear,
    setCurrentMonthNumber,
  } = useBudget()
  const { budget: currentBudget, monthMap } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  // Navigation bounds
  const prevMonth = getPrevMonth(currentYear, currentMonthNumber)
  const nextMonth = getNextMonth(currentYear, currentMonthNumber)
  const minAllowed = getEffectiveMinMonth(monthMap)
  const maxAllowed = getMaxAllowedMonth()
  const minOrdinal = Number(getYearMonthOrdinal(minAllowed.year, minAllowed.month))
  const maxOrdinal = Number(getYearMonthOrdinal(maxAllowed.year, maxAllowed.month))
  const prevOrdinal = Number(getYearMonthOrdinal(prevMonth.year, prevMonth.month))
  const nextOrdinal = Number(getYearMonthOrdinal(nextMonth.year, nextMonth.month))
  const isPrevDisabled = prevOrdinal < minOrdinal
  const isNextDisabled = nextOrdinal > maxOrdinal

  const [showMonthMenu, setShowMonthMenu] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentYear)
  const [pickerMonth, setPickerMonth] = useState(currentMonthNumber)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const monthMenuRef = useRef<HTMLDivElement>(null)

  // Determine if current month is the last (latest) month in the budget
  const isLastMonth = (() => {
    if (!monthMap || Object.keys(monthMap).length === 0) return false
    const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonthNumber)
    const maxOrdinalInMap = Math.max(...Object.keys(monthMap).map(Number))
    return Number(currentOrdinal) === maxOrdinalInMap
  })()

  async function handleDeleteMonth() {
    if (!selectedBudgetId) return
    setIsDeleting(true)
    try {
      const monthDocId = getMonthDocId(selectedBudgetId, currentYear, currentMonthNumber)
      await deleteDocByPath('months', monthDocId, `deleting month ${currentYear}/${currentMonthNumber}`)
      logUserAction('DELETE', 'Delete Month', { details: `${currentYear}/${currentMonthNumber}` })

      // Clear caches
      queryClient.removeQueries({ queryKey: queryKeys.month(selectedBudgetId, currentYear, currentMonthNumber) })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(selectedBudgetId) })
      localStorage.removeItem('BUDGET_APP_QUERY_CACHE')

      const prev = getPrevMonth(currentYear, currentMonthNumber)
      setShowDeleteConfirm(false)
      setShowMonthMenu(false)
      window.location.href = `/budget/${prev.year}/${prev.month}/categories`
    } catch (error) {
      console.error('Failed to delete month:', error)
      alert(`Failed to delete month: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // Close month menu when clicking outside
  useEffect(() => {
    if (!showMonthMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
        setShowMonthMenu(false)
        setShowMonthPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMonthMenu])

  function handleOpenPicker() {
    if (!showMonthPicker) {
      setPickerYear(currentYear)
      setPickerMonth(currentMonthNumber)
    }
    setShowMonthPicker(!showMonthPicker)
  }

  function handleGoToMonth() {
    logUserAction('NAVIGATE', 'Go to Month', { details: `${pickerYear}/${pickerMonth}` })
    setCurrentYear(pickerYear)
    setCurrentMonthNumber(pickerMonth)
    setShowMonthPicker(false)
    setShowMonthMenu(false)
  }

  async function handleDownloadJson() {
    if (!currentMonth || !currentBudget) return

    const now = new Date()
    const datePrefix = now.toISOString().split('T')[0] // YYYY-MM-DD format
    const monthPrefix = `${datePrefix}_month_${currentYear}_${String(currentMonthNumber).padStart(2, '0')}`

    const zip = new JSZip()

    // Create separate files for each transaction type
    const files: Array<{ name: string; data: unknown }> = [
      { name: `${monthPrefix}_income.json`, data: currentMonth.income || [] },
      { name: `${monthPrefix}_expenses.json`, data: currentMonth.expenses || [] },
      { name: `${monthPrefix}_transfers.json`, data: currentMonth.transfers || [] },
      { name: `${monthPrefix}_adjustments.json`, data: currentMonth.adjustments || [] },
      { name: `${monthPrefix}_account_balances.json`, data: currentMonth.account_balances || [] },
      { name: `${monthPrefix}_category_balances.json`, data: currentMonth.category_balances || [] },
    ]

    // Add metadata file
    const metadata = {
      budget_id: currentBudget.id,
      budget_name: currentBudget.name,
      year_month_ordinal: currentMonth.year_month_ordinal,
      year: currentMonth.year,
      month: currentMonth.month,
      total_income: currentMonth.total_income,
      previous_month_income: currentMonth.previous_month_income,
      total_expenses: currentMonth.total_expenses,
      are_allocations_finalized: currentMonth.are_allocations_finalized,
      created_at: currentMonth.created_at,
      updated_at: currentMonth.updated_at,
      downloaded_at: now.toISOString(),
    }
    files.push({ name: `${monthPrefix}_metadata.json`, data: metadata })

    // Add all files to zip
    for (const file of files) {
      zip.file(file.name, JSON.stringify(file.data, null, 2))
    }

    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${monthPrefix}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowMonthMenu(false)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      marginBottom: '1.5rem',
      padding: '1rem',
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
    }}>
      <MonthNavButton
        direction="prev"
        isDisabled={isPrevDisabled}
        isLoading={isLoading}
        disabledReason="Cannot create months more than 3 months into the past"
        onNavigate={onPreviousMonth}
      />

      <div ref={monthMenuRef} style={{ textAlign: 'center', minWidth: '180px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {MONTH_NAMES[currentMonthNumber - 1]} {currentYear}
          </h2>
          <button
            onClick={() => setShowMonthMenu(!showMonthMenu)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.5rem',
              opacity: 0.4,
              padding: '0.15rem',
              borderRadius: '4px',
              transition: 'opacity 0.15s, transform 0.15s',
              transform: showMonthMenu ? 'rotate(180deg)' : 'rotate(0deg)',
              marginTop: '0.25rem',
            }}
            title="Month options"
          >
            ▼
          </button>
        </div>

        {isLoading && (
          <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
              <span style={{
                display: 'inline-block', width: '14px', height: '14px',
                border: '2px solid color-mix(in srgb, currentColor 20%, transparent)',
                borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading...</span>
            </div>
          </>
        )}

        {/* Month options menu */}
        {showMonthMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: '0.5rem', background: 'var(--background, #242424)',
            border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
            borderRadius: '8px', padding: '0.25rem', zIndex: 100, minWidth: '160px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <RecalculateAllButton isDisabled={isLoading} onCloseMenu={() => setShowMonthMenu(false)} />

            <button
              onClick={handleOpenPicker}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                background: 'transparent', border: 'none', borderRadius: '6px',
                padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                color: 'inherit', textAlign: 'left', transition: 'background 0.15s',
              }}
              title="Jump to a specific month"
            >
              📅 Go to Month
            </button>

            {showMonthPicker && (
              <MonthPicker
                pickerYear={pickerYear}
                pickerMonth={pickerMonth}
                currentYear={currentYear}
                currentMonthNumber={currentMonthNumber}
                minOrdinal={minOrdinal}
                maxOrdinal={maxOrdinal}
                minAllowed={minAllowed}
                maxAllowed={maxAllowed}
                onYearChange={setPickerYear}
                onMonthChange={setPickerMonth}
                onGo={handleGoToMonth}
              />
            )}

            {isAdmin && currentMonth && (
              <button
                onClick={() => { logUserAction('CLICK', 'Download Month JSON'); handleDownloadJson() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  background: 'transparent', border: 'none', borderRadius: '6px',
                  padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                  color: 'inherit', textAlign: 'left', transition: 'background 0.15s',
                }}
                title="Download month document as JSON (for debugging)"
              >
                📥 Download JSON
              </button>
            )}

            {isAdmin && currentMonth && isLastMonth && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  background: 'transparent', border: 'none', borderRadius: '6px',
                  padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                  color: '#ef4444', textAlign: 'left', transition: 'background 0.15s',
                }}
                title="Delete this month (last month only)"
              >
                🗑️ Delete Month
              </button>
            )}
          </div>
        )}
      </div>

      <MonthNavButton
        direction="next"
        isDisabled={isNextDisabled}
        isLoading={isLoading}
        disabledReason="Cannot create months more than 3 months into the future"
        onNavigate={onNextMonth}
      />

      <DeleteMonthModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        year={currentYear}
        month={currentMonthNumber}
        isDeleting={isDeleting}
        onConfirm={handleDeleteMonth}
      />
    </div>
  )
}
