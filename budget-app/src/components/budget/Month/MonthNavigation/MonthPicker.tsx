/**
 * MonthPicker - Popup picker for navigating to a specific month
 */

import { MONTH_NAMES } from '@constants'
import { colors } from '@styles/shared'
import { getYearMonthOrdinal } from '@utils'
import type { MonthMap } from '@types'

interface MonthPickerProps {
  pickerYear: number
  pickerMonth: number
  currentYear: number
  currentMonthNumber: number
  minOrdinal: number
  maxOrdinal: number
  minAllowed: { year: number; month: number }
  maxAllowed: { year: number; month: number }
  monthMap: MonthMap | undefined
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onGo: () => void
}

export function MonthPicker({
  pickerYear,
  pickerMonth,
  currentYear,
  currentMonthNumber,
  minOrdinal,
  maxOrdinal,
  minAllowed,
  maxAllowed,
  monthMap,
  onYearChange,
  onMonthChange,
  onGo,
}: MonthPickerProps) {
  const canGoPrevYear = pickerYear > minAllowed.year
  const canGoNextYear = pickerYear < maxAllowed.year
  const selectedOrdinal = Number(getYearMonthOrdinal(pickerYear, pickerMonth))
  // Only allow selecting months that exist in month_map (for past months) or are within max range (for future months)
  const selectedMonthExistsInMap = monthMap ? getYearMonthOrdinal(pickerYear, pickerMonth) in monthMap : false
  const isSelectedInFutureRange = selectedOrdinal <= maxOrdinal
  const isSelectedValid = (selectedMonthExistsInMap || isSelectedInFutureRange) && selectedOrdinal >= minOrdinal

  return (
    <div style={{
      padding: '0.75rem',
      borderTop: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      marginTop: '0.25rem',
    }}>
      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          onClick={() => onYearChange(pickerYear - 1)}
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
          onClick={() => onYearChange(pickerYear + 1)}
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
          const monthOrdinal = Number(getYearMonthOrdinal(pickerYear, monthNum))
          const monthOrdinalStr = getYearMonthOrdinal(pickerYear, monthNum)
          const isBeforeMin = monthOrdinal < minOrdinal
          const isAfterMax = monthOrdinal > maxOrdinal
          // For past months, only allow if they exist in month_map
          const isPastMonth = monthOrdinal < Number(getYearMonthOrdinal(currentYear, currentMonthNumber))
          const monthExistsInMap = monthMap ? monthOrdinalStr in monthMap : false
          const isDisabled = isBeforeMin || isAfterMax || (isPastMonth && !monthExistsInMap)

          let title: string = name
          if (isBeforeMin) title = 'Too far in the past'
          else if (isAfterMax) title = 'Too far in the future'
          else if (isPastMonth && !monthExistsInMap) title = 'Month not in budget'

          return (
            <button
              key={monthNum}
              onClick={() => onMonthChange(monthNum)}
              disabled={isDisabled}
              style={{
                background: isSelected ? colors.primary : 'color-mix(in srgb, currentColor 8%, transparent)',
                border: isCurrent ? `1px solid ${colors.primary}` : '1px solid transparent',
                borderRadius: '4px',
                padding: '0.35rem 0.25rem',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.7rem',
                color: isSelected ? 'var(--color-primary-on-primary)' : 'inherit',
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
      <button
        onClick={onGo}
        disabled={!isSelectedValid}
        style={{
          width: '100%',
          background: isSelectedValid ? colors.primary : 'color-mix(in srgb, currentColor 20%, transparent)',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem',
          cursor: isSelectedValid ? 'pointer' : 'not-allowed',
          fontSize: '0.85rem',
          color: isSelectedValid ? 'var(--color-primary-on-primary)' : 'inherit',
          fontWeight: 500,
          opacity: isSelectedValid ? 1 : 0.5,
        }}
      >
        Go to {MONTH_NAMES[pickerMonth - 1]} {pickerYear}
      </button>
    </div>
  )
}

