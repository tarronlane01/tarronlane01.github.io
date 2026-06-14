/**
 * Autocomplete - Shared flat-list autocomplete with optional inline create
 *
 * Flat list (no grouping), fuzzy matching, keyboard navigation.
 * When `onCreateNew` is provided and no exact match exists, shows
 * a "Create '[typed text]'" option at the bottom.
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '@styles/shared'
import {
  type AutocompleteItem,
  filterAndSortItems,
  dropdownContainerStyle,
  suggestionItemStyle,
} from './autocompleteHelpers'
import { useAutocompleteDropdown } from './useAutocompleteDropdown'

interface AutocompleteProps {
  id?: string
  value: string          // selected item ID
  onChange: (id: string) => void
  items: { id: string; name: string }[]
  placeholder?: string
  required?: boolean
  onCreateNew?: (name: string) => string  // returns new ID
}

export function Autocomplete({
  id,
  value,
  onChange,
  items,
  placeholder = 'Search...',
  required,
  onCreateNew,
}: AutocompleteProps) {
  // Build flat AutocompleteItem list sorted alphabetically
  const autocompleteItems: AutocompleteItem[] = items
    .map((item, i) => ({
      id: item.id,
      name: item.name,
      groupId: null,
      groupName: null,
      sortOrder: i,
      groupSortOrder: 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item, i) => ({ ...item, sortOrder: i }))

  const selectedItem = value ? items.find(it => it.id === value) : null
  const displayValue = selectedItem?.name ?? ''

  // null = not editing (show displayValue from props), string = user is typing
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const inputValue = editingValue ?? displayValue

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const createOptionRef = useRef<HTMLDivElement>(null)

  const suggestions = filterAndSortItems(
    autocompleteItems,
    inputValue,
    (item) => [item.name]
  )

  // Check if "Create" option should show
  const trimmedInput = inputValue.trim()
  const hasExactMatch = trimmedInput
    ? items.some(it => it.name.toLowerCase() === trimmedInput.toLowerCase())
    : true
  const showCreateOption = !!onCreateNew && trimmedInput.length > 0 && !hasExactMatch
  const createOptionIndex = showCreateOption ? suggestions.length : -1
  const totalCount = suggestions.length + (showCreateOption ? 1 : 0)

  function stopEditing() {
    setEditingValue(null)
  }

  function selectItem(item: AutocompleteItem) {
    onChange(item.id)
    stopEditing()
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  function handleCreateNew() {
    if (!onCreateNew) return
    const newId = onCreateNew(trimmedInput)
    onChange(newId)
    stopEditing()
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }

  const { handleKeyDown: baseHandleKeyDown, hasNavigatedOrTypedRef, highlightedIndexRef, itemRefs } = useAutocompleteDropdown({
    suggestionsInDisplayOrder: suggestions,
    highlightedIndex,
    setHighlightedIndex,
    showSuggestions,
    setShowSuggestions,
    onSelect: selectItem,
    inputRef,
    onClose: stopEditing,
    minIndex: 0,
  })

  // Scroll create option into view when highlighted
  useEffect(() => {
    if (showSuggestions && highlightedIndex === createOptionIndex && createOptionIndex >= 0) {
      createOptionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }
  }, [showSuggestions, highlightedIndex, createOptionIndex])

  // Wrap keydown to handle create option navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (showCreateOption) {
      if (e.key === 'ArrowDown' && highlightedIndexRef.current === suggestions.length - 1) {
        e.preventDefault()
        setHighlightedIndex(createOptionIndex)
        highlightedIndexRef.current = createOptionIndex
        return
      }
      if (e.key === 'ArrowUp' && highlightedIndexRef.current === createOptionIndex) {
        e.preventDefault()
        const prev = suggestions.length > 0 ? suggestions.length - 1 : 0
        setHighlightedIndex(prev)
        highlightedIndexRef.current = prev
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlightedIndexRef.current === createOptionIndex) {
        e.preventDefault()
        handleCreateNew()
        return
      }
      if (e.key === 'ArrowDown' && suggestions.length === 0 && showSuggestions) {
        e.preventDefault()
        setHighlightedIndex(createOptionIndex)
        highlightedIndexRef.current = createOptionIndex
        return
      }
    }
    baseHandleKeyDown(e)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        stopEditing()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value
    hasNavigatedOrTypedRef.current = true
    setEditingValue(newValue)
    setShowSuggestions(true)
    const nextIdx = newValue.trim() ? 0 : -1
    setHighlightedIndex(nextIdx)
    highlightedIndexRef.current = nextIdx
    if (newValue !== displayValue) {
      onChange('')
    }
  }

  function handleFocus() {
    hasNavigatedOrTypedRef.current = false
    setEditingValue(displayValue)
    setShowSuggestions(true)
    const nextIdx = suggestions.length > 0 ? 0 : -1
    setHighlightedIndex(nextIdx)
    highlightedIndexRef.current = nextIdx
  }

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
          borderColor: required && !value ? colors.error : undefined,
        }}
      />
      {showSuggestions && (totalCount > 0 || (trimmedInput && suggestions.length === 0 && !showCreateOption)) && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '250px', overflowY: 'auto' }}>
          {suggestions.map((item, idx) => (
            <div
              key={item.id}
              ref={(el) => { itemRefs.current[idx] = el }}
              onClick={() => selectItem(item)}
              style={{
                ...suggestionItemStyle,
                background: idx === highlightedIndex
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
                borderBottom: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
              }}
              onMouseEnter={() => {
                setHighlightedIndex(idx)
                highlightedIndexRef.current = idx
              }}
            >
              {item.name}
            </div>
          ))}
          {showCreateOption && (
            <div
              ref={createOptionRef}
              onClick={handleCreateNew}
              style={{
                ...suggestionItemStyle,
                fontStyle: 'italic',
                background: highlightedIndex === createOptionIndex
                  ? `color-mix(in srgb, ${colors.primary} 20%, transparent)`
                  : 'transparent',
              }}
              onMouseEnter={() => {
                setHighlightedIndex(createOptionIndex)
                highlightedIndexRef.current = createOptionIndex
              }}
            >
              Create &lsquo;{trimmedInput}&rsquo;
            </div>
          )}
          {suggestions.length === 0 && !showCreateOption && trimmedInput && (
            <div style={{ padding: '0.6rem 0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  )
}
