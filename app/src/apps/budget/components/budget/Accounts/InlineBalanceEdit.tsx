/**
 * InlineBalanceEdit - Inline editable balance for off-budget accounts
 *
 * Provides click-to-edit balance input with +/- toggle for both
 * desktop (table cell) and mobile (card) layouts.
 */

import { useState, useRef, useEffect } from 'react'
import { CurrencyInput } from '@components/ui'
import { formatSignedCurrency, getBalanceColor } from '@budget/components/ui'

// ============================================================================
// DESKTOP: Inline edit inside a grid cell
// ============================================================================

export function InlineBalanceEdit({ currentBalance, cellStyle, onSubmit }: {
  currentBalance: number
  cellStyle: React.CSSProperties
  onSubmit: (value: number) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isNegative, setIsNegative] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  function startEditing() {
    const neg = currentBalance < 0
    setIsNegative(neg)
    setInputValue(Math.abs(currentBalance).toFixed(2))
    setIsEditing(true)
  }

  function submit() {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed)) {
      onSubmit(isNegative ? -parsed : parsed)
    }
    setIsEditing(false)
  }

  function cancel() {
    setIsEditing(false)
  }

  // Close on click outside
  useEffect(() => {
    if (!isEditing) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        submit()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, inputValue, isNegative])

  if (isEditing) {
    return (
      <div ref={wrapperRef} style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
        <SignToggle isNegative={isNegative} onClick={() => setIsNegative(n => !n)} />
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
        >
          <CurrencyInput
            value={inputValue}
            onChange={setInputValue}
            autoFocus
            style={{ width: '7rem', fontSize: '0.85rem', textAlign: 'right', padding: '0.2rem 0.3rem' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ ...cellStyle, justifyContent: 'flex-end', cursor: 'pointer' }}
      onClick={startEditing}
      title="Click to set balance"
    >
      <span style={{ color: getBalanceColor(currentBalance), fontWeight: 600, borderBottom: '1px dashed currentColor', paddingBottom: '1px' }}>
        {formatSignedCurrency(currentBalance)}
      </span>
    </div>
  )
}

// ============================================================================
// MOBILE: Editable balance column with "Last set" label
// ============================================================================

export function MobileEditableBalance({ value, lastSetLabel, onSubmit }: {
  value: number; lastSetLabel: string; onSubmit?: (v: number) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isNegative, setIsNegative] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  function startEditing() {
    if (!onSubmit) return
    setIsNegative(value < 0)
    setInputValue(Math.abs(value).toFixed(2))
    setIsEditing(true)
  }

  function submit() {
    const parsed = parseFloat(inputValue)
    if (!isNaN(parsed) && onSubmit) {
      onSubmit(isNegative ? -parsed : parsed)
    }
    setIsEditing(false)
  }

  // Close on click outside
  useEffect(() => {
    if (!isEditing) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) submit()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, inputValue, isNegative])

  if (isEditing) {
    return (
      <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
        <div
          style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false) }
          }}
        >
          <SignToggle isNegative={isNegative} onClick={() => setIsNegative(n => !n)} size="small" />
          <CurrencyInput
            value={inputValue}
            onChange={setInputValue}
            autoFocus
            style={{ width: '6rem', fontSize: '0.8rem', textAlign: 'right', padding: '0.15rem 0.25rem' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }} onClick={startEditing}>
      <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>Total</span>
      <span style={{ color: getBalanceColor(value), fontWeight: 600, cursor: onSubmit ? 'pointer' : 'default', borderBottom: onSubmit ? '1px dashed currentColor' : undefined, paddingBottom: '1px' }}>
        {formatSignedCurrency(value)}
      </span>
      <span style={{ opacity: 0.45, fontSize: '0.65rem' }}>{lastSetLabel}</span>
    </div>
  )
}

// ============================================================================
// SHARED: Sign toggle button
// ============================================================================

function SignToggle({ isNegative, onClick, size = 'normal' }: {
  isNegative: boolean; onClick: () => void; size?: 'normal' | 'small'
}) {
  const isSmall = size === 'small'
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: '1px solid var(--border-medium)',
        borderRadius: '4px', cursor: 'pointer',
        fontSize: isSmall ? '0.8rem' : '0.85rem',
        padding: isSmall ? '0.1rem 0.3rem' : '0.15rem 0.35rem',
        fontWeight: 600, minWidth: isSmall ? undefined : '1.5rem',
      }}
      title="Toggle positive/negative"
    >
      {isNegative ? '−' : '+'}
    </button>
  )
}
