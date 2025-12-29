/**
 * Autocomplete Components
 *
 * PayeeAutocomplete - fuzzy search for payee names
 * CategoryAutocomplete - fuzzy search for categories with grouping
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '../../styles/shared'

// =============================================================================
// FUZZY SEARCH HELPER
// =============================================================================

// Fuzzy search - matches if all characters appear in order (case insensitive)
// Also matches if query appears anywhere in the string
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()

  // Direct substring match (highest priority)
  if (lowerTarget.includes(lowerQuery)) {
    const index = lowerTarget.indexOf(lowerQuery)
    // Prefer matches at word boundaries
    const atWordStart = index === 0 || /\s/.test(lowerTarget[index - 1])
    return { match: true, score: atWordStart ? 100 : 90 }
  }

  // Fuzzy match - characters in order
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      queryIndex++
      consecutiveMatches++
      score += consecutiveMatches * 2 // Reward consecutive matches
    } else {
      consecutiveMatches = 0
    }
  }

  if (queryIndex === lowerQuery.length) {
    return { match: true, score }
  }

  return { match: false, score: 0 }
}

// =============================================================================
// PAYEE AUTOCOMPLETE
// =============================================================================

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
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--background, #1a1a1a)',
          border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {suggestions.map((payee, index) => (
            <div
              key={payee}
              onClick={() => selectSuggestion(payee)}
              style={{
                padding: '0.6rem 0.8rem',
                cursor: 'pointer',
                background: index === highlightedIndex
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
                borderBottom: index < suggestions.length - 1
                  ? '1px solid color-mix(in srgb, currentColor 10%, transparent)'
                  : 'none',
                transition: 'background 0.1s',
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

// =============================================================================
// CATEGORY AUTOCOMPLETE
// =============================================================================

// Category item for autocomplete
interface CategoryItem {
  id: string
  name: string
  groupId: string | null
  groupName: string | null
  sortOrder: number
}

// Category Autocomplete with fuzzy search (requires selection from dropdown)
interface CategoryAutocompleteProps {
  id?: string
  value: string // categoryId
  onChange: (categoryId: string) => void
  categories: Record<string, { name: string; category_group_id: string | null; sort_order: number }>
  categoryGroups: { id: string; name: string; sort_order: number }[]
  placeholder?: string
  required?: boolean
}

export function CategoryAutocomplete({
  id,
  value,
  onChange,
  categories,
  categoryGroups,
  placeholder = 'Search categories...',
  required,
}: CategoryAutocompleteProps) {
  // Build a lookup map for group names
  const groupNameMap = Object.fromEntries(categoryGroups.map(g => [g.id, g.name]))

  // Build flat list of categories with group info
  const categoryItems: CategoryItem[] = Object.entries(categories).map(([catId, cat]) => ({
    id: catId,
    name: cat.name,
    groupId: cat.category_group_id,
    groupName: cat.category_group_id ? groupNameMap[cat.category_group_id] || null : null,
    sortOrder: cat.sort_order,
  }))

  // Get selected category name for display
  const selectedCategory = value ? categories[value] : null
  const displayValue = selectedCategory?.name || ''

  const [inputValue, setInputValue] = useState(displayValue)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input value when external value changes
  useEffect(() => {
    const selectedCat = value ? categories[value] : null
    setInputValue(selectedCat?.name || '')
  }, [value, categories])

  // Get filtered and sorted suggestions based on input
  const suggestions: CategoryItem[] = inputValue.trim()
    ? categoryItems
        .map(cat => ({
          ...cat,
          ...fuzzyMatch(inputValue, cat.name),
          // Also match against group name
          groupMatch: cat.groupName ? fuzzyMatch(inputValue, cat.groupName) : { match: false, score: 0 },
        }))
        .filter(item => item.match || item.groupMatch.match)
        .sort((a, b) => {
          // Primary sort by match score
          const scoreA = Math.max(a.score, a.groupMatch.score * 0.5) // Group match is weighted lower
          const scoreB = Math.max(b.score, b.groupMatch.score * 0.5)
          if (scoreB !== scoreA) return scoreB - scoreA
          // Secondary sort by group (using groupId for uniqueness) then sort_order
          if (a.groupId !== b.groupId) {
            if (!a.groupId) return 1
            if (!b.groupId) return -1
            // Sort by group name for display order, but groupId ensures uniqueness
            const nameCompare = (a.groupName || '').localeCompare(b.groupName || '')
            if (nameCompare !== 0) return nameCompare
            return a.groupId.localeCompare(b.groupId)
          }
          return a.sortOrder - b.sortOrder
        })
        .slice(0, 10)
    : // Show all categories when input is empty (grouped and sorted)
      [...categoryItems]
        .sort((a, b) => {
          if (a.groupId !== b.groupId) {
            if (!a.groupId) return 1
            if (!b.groupId) return -1
            // Sort by group name for display order, but groupId ensures uniqueness
            const nameCompare = (a.groupName || '').localeCompare(b.groupName || '')
            if (nameCompare !== 0) return nameCompare
            return a.groupId.localeCompare(b.groupId)
          }
          return a.sortOrder - b.sortOrder
        })
        .slice(0, 10)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        // Reset to selected value if user didn't select anything
        const selectedCat = value ? categories[value] : null
        setInputValue(selectedCat?.name || '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value, categories])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showSuggestions) {
        setShowSuggestions(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectCategory(suggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      // Reset to selected value
      const selectedCat = value ? categories[value] : null
      setInputValue(selectedCat?.name || '')
    } else if (e.key === 'Tab') {
      // Auto-select first suggestion on Tab if there's a match
      if (showSuggestions && suggestions.length > 0) {
        const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0
        selectCategory(suggestions[indexToSelect])
      }
    }
  }

  function selectCategory(cat: CategoryItem) {
    onChange(cat.id)
    setInputValue(cat.name)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    setHighlightedIndex(-1)
    // Clear the selected category when user starts typing something different
    if (newValue !== displayValue) {
      onChange('')
    }
  }

  function handleFocus() {
    setShowSuggestions(true)
    // Auto-highlight first item when focusing
    if (suggestions.length > 0) {
      setHighlightedIndex(0)
    }
  }

  // Group suggestions by category group for display (using groupId for uniqueness)
  const groupedSuggestions: { groupId: string | null; groupName: string | null; items: CategoryItem[] }[] = []
  let currentGroupId: string | null = '__initial__' // Use a sentinel value to detect first iteration
  suggestions.forEach(cat => {
    if (cat.groupId !== currentGroupId) {
      currentGroupId = cat.groupId
      groupedSuggestions.push({ groupId: cat.groupId, groupName: cat.groupName, items: [] })
    }
    groupedSuggestions[groupedSuggestions.length - 1].items.push(cat)
  })

  // Calculate flat index for keyboard navigation
  let flatIndex = -1
  const getFlatIndex = () => ++flatIndex

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        style={{
          ...inputStyle,
          // Visual indicator when no valid selection
          borderColor: required && !value ? colors.error : undefined,
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--background, #1a1a1a)',
          border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          maxHeight: '250px',
          overflowY: 'auto',
        }}>
          {groupedSuggestions.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`}>
              {group.groupName && (
                <div style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  opacity: 0.6,
                  background: 'color-mix(in srgb, currentColor 5%, transparent)',
                  borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                }}>
                  {group.groupName}
                </div>
              )}
              {group.items.map((cat) => {
                const idx = getFlatIndex()
                return (
                  <div
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    style={{
                      padding: '0.6rem 0.8rem',
                      paddingLeft: group.groupName ? '1.2rem' : '0.8rem',
                      cursor: 'pointer',
                      background: idx === highlightedIndex
                        ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                        : 'transparent',
                      borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    {cat.name}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
      {showSuggestions && suggestions.length === 0 && inputValue.trim() && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--background, #1a1a1a)',
          border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          padding: '0.6rem 0.8rem',
          opacity: 0.6,
          fontStyle: 'italic',
        }}>
          No matching categories
        </div>
      )}
    </div>
  )
}

