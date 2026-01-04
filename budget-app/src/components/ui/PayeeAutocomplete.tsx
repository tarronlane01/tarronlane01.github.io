/**
 * PayeeAutocomplete - Fuzzy search for payee names
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '@styles/shared'
import { fuzzyMatch, dropdownContainerStyle, suggestionItemStyle } from './autocompleteHelpers'

interface PayeeAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  payees: string[]
  placeholder?: string
}

export function PayeeAutocomplete({ id, value, onChange, payees, placeholder = 'Enter payee name' }: PayeeAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get filtered and sorted suggestions
  const suggestions = value.trim()
    ? payees
        .map(payee => ({ payee, ...fuzzyMatch(value, payee) }))
        .filter(item => item.match)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(item => item.payee)
    : []

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      onChange(suggestions[highlightedIndex])
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  function selectSuggestion(payee: string) {
    onChange(payee)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
          setHighlightedIndex(-1)
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '200px', overflowY: 'auto' }}>
          {suggestions.map((payee, index) => (
            <div
              key={payee}
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
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {payee}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

