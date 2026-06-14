/**
 * PayeeAutocomplete - Fuzzy search for payee names
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '@styles/shared'
import { fuzzyMatch, dropdownContainerStyle, suggestionItemStyle } from '@components/ui/autocompleteHelpers'
import { useAutocompleteDropdown } from '@components/ui/useAutocompleteDropdown'

interface PayeeAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  payees: string[]
  placeholder?: string
  autoFocus?: boolean
}

export function PayeeAutocomplete({ id, value, onChange, payees, placeholder = 'Enter payee name', autoFocus }: PayeeAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const payeeList = Array.isArray(payees) ? payees : []
  const suggestions = value.trim()
    ? payeeList
        .map(payee => ({ payee, ...fuzzyMatch(value, payee) }))
        .filter(item => item.match)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(item => item.payee)
    : []

  function selectSuggestion(payee: string) {
    onChange(payee)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const { handleKeyDown, hasNavigatedOrTypedRef, highlightedIndexRef, itemRefs } = useAutocompleteDropdown({
    suggestionsInDisplayOrder: suggestions,
    highlightedIndex,
    setHighlightedIndex,
    showSuggestions,
    setShowSuggestions,
    onSelect: selectSuggestion,
    inputRef,
    minIndex: -1,
  })

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          hasNavigatedOrTypedRef.current = true
          onChange(e.target.value)
          setShowSuggestions(true)
          setHighlightedIndex(-1)
          highlightedIndexRef.current = -1
        }}
        onFocus={() => {
          hasNavigatedOrTypedRef.current = false
          setShowSuggestions(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        style={inputStyle}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '200px', overflowY: 'auto' }}>
          {suggestions.map((payee, index) => (
            <div
              key={payee}
              ref={(el) => { itemRefs.current[index] = el }}
              onClick={() => selectSuggestion(payee)}
              style={{
                ...suggestionItemStyle,
                background: index === highlightedIndex
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
                borderBottom: index < suggestions.length - 1
                  ? '1px solid color-mix(in srgb, currentColor 10%, transparent)'
                  : 'none',
              }}
              onMouseEnter={() => {
                setHighlightedIndex(index)
                highlightedIndexRef.current = index
              }}
            >
              {payee}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

