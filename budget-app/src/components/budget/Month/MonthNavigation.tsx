import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../../contexts/app_context'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { colors } from '../../../styles/shared'
import { MONTH_NAMES } from '@constants'
import { RecalculateAllButton } from './RecalculateAllButton'
import { logUserAction, getYearMonthOrdinal } from '@utils'
import {
  MonthNavButton,
  getPrevMonth,
  getNextMonth,
  getEffectiveMinMonth,
  getMaxAllowedMonth,
} from './MonthNavigation/index'

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
    currentUserId,
    setCurrentYear,
    setCurrentMonthNumber,
  } = useBudget()
  const { budget: currentBudget, monthMap } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  // Navigation bounds: 3 months in past (or earliest in monthMap if older), 3 months in future
  // This allows navigating to months that don't exist yet - they'll be created on demand
  const prevMonth = getPrevMonth(currentYear, currentMonthNumber)
  const nextMonth = getNextMonth(currentYear, currentMonthNumber)

  const minAllowed = getEffectiveMinMonth(monthMap)
  const maxAllowed = getMaxAllowedMonth()

  const minOrdinal = getYearMonthOrdinal(minAllowed.year, minAllowed.month)
  const maxOrdinal = getYearMonthOrdinal(maxAllowed.year, maxAllowed.month)

  const prevOrdinal = getYearMonthOrdinal(prevMonth.year, prevMonth.month)
  const nextOrdinal = getYearMonthOrdinal(nextMonth.year, nextMonth.month)

  const isPrevDisabled = prevOrdinal < minOrdinal
  const isNextDisabled = nextOrdinal > maxOrdinal

  const [showMonthMenu, setShowMonthMenu] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentYear)
  const [pickerMonth, setPickerMonth] = useState(currentMonthNumber)
  const monthMenuRef = useRef<HTMLDivElement>(null)

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
      // Initialize picker to current month when opening
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

  function handleDownloadJson() {
    if (!currentMonth || !currentBudget) return
    const monthData = {
      ...currentMonth,
      _meta: {
        downloaded_at: new Date().toISOString(),
        budget_id: currentBudget.id,
        budget_name: currentBudget.name,
      }
    }
    const blob = new Blob([JSON.stringify(monthData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `month_${currentYear}_${String(currentMonthNumber).padStart(2, '0')}.json`
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              marginTop: '0.35rem',
            }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid color-mix(in srgb, currentColor 20%, transparent)',
                  borderTopColor: colors.primary,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Loading...</span>
            </div>
          </>
        )}
        {/* Month options menu */}
        {showMonthMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '0.5rem',
              background: 'var(--background, #242424)',
              border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
              borderRadius: '8px',
              padding: '0.25rem',
              zIndex: 100,
              minWidth: '160px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <RecalculateAllButton isDisabled={isLoading} onCloseMenu={() => setShowMonthMenu(false)} />

            {/* Go to Month button */}
            <button
              onClick={handleOpenPicker}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: 'inherit',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              title="Jump to a specific month"
            >
              📅 Go to Month
            </button>

            {/* Month picker */}
            {showMonthPicker && (() => {
              // Bounds: 3 months back (or earliest in map if older) to 3 months ahead
              const earliestYear = minAllowed.year
              const latestYear = maxAllowed.year

              const canGoPrevYear = pickerYear > earliestYear
              const canGoNextYear = pickerYear < latestYear

              return (
              <div style={{
                padding: '0.75rem',
                borderTop: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                marginTop: '0.25rem',
              }}>
                {/* Year selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => setPickerYear(y => y - 1)}
                    disabled={!canGoPrevYear}
                    style={{
                      background: 'color-mix(in srgb, currentColor 10%, transparent)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: canGoPrevYear ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem',
                      opacity: canGoPrevYear ? 1 : 0.3,
                    }}
                    title={canGoPrevYear ? 'Previous year' : 'Cannot go further back'}
                  >
                    ←
                  </button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', fontWeight: 500 }}>
                    {pickerYear}
                  </span>
                  <button
                    onClick={() => setPickerYear(y => y + 1)}
                    disabled={!canGoNextYear}
                    style={{
                      background: 'color-mix(in srgb, currentColor 10%, transparent)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: canGoNextYear ? 'pointer' : 'not-allowed',
                      fontSize: '0.8rem',
                      opacity: canGoNextYear ? 1 : 0.3,
                    }}
                    title={canGoNextYear ? 'Next year' : 'Cannot go further ahead'}
                  >
                    →
                  </button>
                </div>

                {/* Month grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.25rem',
                  marginBottom: '0.5rem',
                }}>
                  {MONTH_NAMES.map((name, idx) => {
                    const monthNum = idx + 1
                    const isSelected = monthNum === pickerMonth
                    const isCurrent = pickerYear === currentYear && monthNum === currentMonthNumber
                    const monthOrdinal = getYearMonthOrdinal(pickerYear, monthNum)

                    // Grey out months outside the allowed range (3 months back to 3 months ahead)
                    const isBeforeMin = monthOrdinal < minOrdinal
                    const isAfterMax = monthOrdinal > maxOrdinal
                    const isDisabled = isBeforeMin || isAfterMax

                    let title: string = name
                    if (isBeforeMin) {
                      title = 'Too far in the past'
                    } else if (isAfterMax) {
                      title = 'Too far in the future'
                    }

                    return (
                      <button
                        key={monthNum}
                        onClick={() => setPickerMonth(monthNum)}
                        disabled={isDisabled}
                        style={{
                          background: isSelected
                            ? colors.primary
                            : 'color-mix(in srgb, currentColor 8%, transparent)',
                          border: isCurrent ? `1px solid ${colors.primary}` : '1px solid transparent',
                          borderRadius: '4px',
                          padding: '0.35rem 0.25rem',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          fontSize: '0.7rem',
                          color: isSelected ? '#fff' : 'inherit',
                          opacity: isDisabled ? 0.3 : 1,
                          transition: 'background 0.15s',
                        }}
                        title={title}
                      >
                        {name.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>

                {/* Go button */}
                {(() => {
                  // Check if selected month is within allowed range
                  const selectedOrdinal = getYearMonthOrdinal(pickerYear, pickerMonth)
                  const isSelectedValid = selectedOrdinal >= minOrdinal && selectedOrdinal <= maxOrdinal

                  return (
                    <button
                      onClick={handleGoToMonth}
                      disabled={!isSelectedValid}
                      style={{
                        width: '100%',
                        background: isSelectedValid ? colors.primary : 'color-mix(in srgb, currentColor 20%, transparent)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.5rem',
                        cursor: isSelectedValid ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        color: isSelectedValid ? '#fff' : 'inherit',
                        fontWeight: 500,
                        opacity: isSelectedValid ? 1 : 0.5,
                      }}
                    >
                      Go to {MONTH_NAMES[pickerMonth - 1]} {pickerYear}
                    </button>
                  )
                })()}
              </div>
            )})()}

            {/* Admin-only: Download month data */}
            {isAdmin && currentMonth && (
              <button
                onClick={() => { logUserAction('CLICK', 'Download Month JSON'); handleDownloadJson() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: 'inherit',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                title="Download month document as JSON (for debugging)"
              >
                📥 Download JSON
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
    </div>
  )
}
