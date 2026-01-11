/**
 * CategoryAutocomplete - Fuzzy search for categories with grouping
 *
 * Sorting matches the order used on the budget Categories page:
 * - Groups sorted by sort_order
 * - Categories sorted by sort_order within their group
 * - Ungrouped categories appear at the end
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '@styles/shared'
import {
  type AutocompleteItem,
  filterAndSortItems,
  groupItemsForDisplay,
  dropdownContainerStyle,
  suggestionItemStyle,
} from './autocompleteHelpers'
import { NO_CATEGORY_ID, NO_CATEGORY_NAME } from '@data/constants'

// Category item uses the shared AutocompleteItem interface
type CategoryItem = AutocompleteItem

interface CategoryAutocompleteProps {
  id?: string
  value: string // categoryId
  onChange: (categoryId: string) => void
  categories: Record<string, { name: string; category_group_id: string | null; sort_order: number; is_hidden?: boolean }>
  categoryGroups: { id: string; name: string; sort_order: number }[]
  placeholder?: string
  required?: boolean
  /** Show the special "No Category" option (for spend entries) */
  showNoCategoryOption?: boolean
  /** Include hidden categories in the list (default: false) */
  showHiddenCategories?: boolean
}

export function CategoryAutocomplete({
  id,
  value,
  onChange,
  categories,
  categoryGroups,
  placeholder = 'Search categories...',
  required,
  showNoCategoryOption = false,
  showHiddenCategories = false,
}: CategoryAutocompleteProps) {
  // Build lookup maps for group info
  const groupNameMap = Object.fromEntries(categoryGroups.map(g => [g.id, g.name]))
  const groupSortOrderMap = Object.fromEntries(categoryGroups.map(g => [g.id, g.sort_order]))

  // Filter out hidden categories unless showHiddenCategories is true
  const visibleCategories = showHiddenCategories
    ? categories
    : Object.fromEntries(Object.entries(categories).filter(([, cat]) => !cat.is_hidden))

  // Build flat list of categories with group info (excluding No Category - handled separately)
  const categoryItems: CategoryItem[] = Object.entries(visibleCategories).map(([catId, cat]) => ({
    id: catId,
    name: cat.name,
    groupId: cat.category_group_id,
    groupName: cat.category_group_id ? groupNameMap[cat.category_group_id] || null : null,
    sortOrder: cat.sort_order,
    groupSortOrder: cat.category_group_id ? groupSortOrderMap[cat.category_group_id] ?? 999 : 999,
  }))

  // Get selected category name for display
  const isNoCategorySelected = value === NO_CATEGORY_ID
  const selectedCategory = isNoCategorySelected ? null : (value ? categories[value] : null)
  // When "No Category" is selected, show empty input with placeholder instead
  const displayValue = isNoCategorySelected ? '' : (selectedCategory?.name || '')

  const [inputValue, setInputValue] = useState(displayValue)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input value when external value changes
  useEffect(() => {
    if (value === NO_CATEGORY_ID) {
      setInputValue('')
    } else if (value) {
      // Only sync for valid selections, not empty string (user is actively typing)
      const selectedCat = categories[value]
      setInputValue(selectedCat?.name || '')
    }
    // When value is '', don't sync - user is actively typing/searching
  }, [value, categories])

  // Get filtered and sorted suggestions using shared helper
  // Only search by item name - group names caused false positives with fuzzy matching
  // (e.g., "Ren" would match all items in "Monthly Recurring" group)
  const suggestions: CategoryItem[] = filterAndSortItems(
    categoryItems,
    inputValue,
    (item) => [item.name]
  )

  // Group suggestions for display using shared helper
  const groupedSuggestions = groupItemsForDisplay(suggestions)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        if (value === NO_CATEGORY_ID) {
          setInputValue('')
        } else {
          const selectedCat = value ? categories[value] : null
          setInputValue(selectedCat?.name || '')
        }
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
      if (value === NO_CATEGORY_ID) {
        setInputValue('')
      } else {
        const selectedCat = value ? categories[value] : null
        setInputValue(selectedCat?.name || '')
      }
    } else if (e.key === 'Tab') {
      // Only select on Tab if user explicitly navigated with arrow keys
      // Otherwise just close dropdown and keep current value
      if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectCategory(suggestions[highlightedIndex])
      } else {
        // Close dropdown and restore input to current selection
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        if (value === NO_CATEGORY_ID) {
          setInputValue('')
        } else {
          const selectedCat = value ? categories[value] : null
          setInputValue(selectedCat?.name || '')
        }
      }
    }
  }

  function selectCategory(cat: CategoryItem) {
    onChange(cat.id)
    setInputValue(cat.id === NO_CATEGORY_ID ? '' : cat.name)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    // Don't refocus - it would trigger handleFocus and reopen the dropdown
  }

  function selectNoCategory() {
    onChange(NO_CATEGORY_ID)
    setInputValue('')
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    // Smart highlight: empty input → No Category (-1), text entered → first matching suggestion (0)
    setHighlightedIndex(newValue.trim() ? 0 : -1)
    if (newValue !== displayValue) {
      // When showNoCategoryOption is enabled AND input is empty, fall back to NO_CATEGORY_ID
      // If input has text but no selection made, keep empty to require user to complete selection
      if (showNoCategoryOption && newValue.trim() === '') {
        onChange(NO_CATEGORY_ID)
      } else {
        onChange('')
      }
    }
  }

  function handleFocus() {
    setShowSuggestions(true)
    // When No Category is selected OR input is empty (showing placeholder), highlight No Category option (-1)
    // Otherwise highlight first suggestion
    if (showNoCategoryOption && (value === NO_CATEGORY_ID || inputValue.trim() === '')) {
      setHighlightedIndex(-1)
    } else if (suggestions.length > 0) {
      setHighlightedIndex(0)
    }
  }

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
        // Don't use HTML5 required when No Category option is enabled - the form's validation
        // handles this properly. HTML5 required can't work with this autocomplete pattern
        // because inputValue (display text) differs from value (selected ID).
        required={required && !showNoCategoryOption}
        style={{
          ...inputStyle,
          borderColor: required && !value ? colors.error : undefined,
        }}
      />
      {showSuggestions && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '250px', overflowY: 'auto' }}>
          {/* Always show No Category option at top when enabled */}
          {showNoCategoryOption && (
            <div
              onClick={selectNoCategory}
              onMouseEnter={() => setHighlightedIndex(-1)}
              style={{
                ...suggestionItemStyle,
                opacity: 0.7,
                fontStyle: 'italic',
                borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                background: highlightedIndex === -1
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
              }}
            >
              {NO_CATEGORY_NAME}
            </div>
          )}
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
                      ...suggestionItemStyle,
                      paddingLeft: group.groupName ? '1.2rem' : '0.8rem',
                      background: idx === highlightedIndex
                        ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                        : 'transparent',
                      borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    {cat.name}
                  </div>
                )
              })}
            </div>
          ))}
          {suggestions.length === 0 && inputValue.trim() && !showNoCategoryOption && (
            <div style={{ padding: '0.6rem 0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
              No matching categories
            </div>
          )}
        </div>
      )}
    </div>
  )
}
