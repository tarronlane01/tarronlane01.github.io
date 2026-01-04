/**
 * CategoryAutocomplete - Fuzzy search for categories with grouping
 */

import { useState, useRef, useEffect } from 'react'
import { input as inputStyle, colors } from '@styles/shared'
import { fuzzyMatch, dropdownContainerStyle, suggestionItemStyle } from './autocompleteHelpers'
import { NO_CATEGORY_ID, NO_CATEGORY_NAME } from '@data/constants'

// Category item for autocomplete
interface CategoryItem {
  id: string
  name: string
  groupId: string | null
  groupName: string | null
  sortOrder: number
}

interface CategoryAutocompleteProps {
  id?: string
  value: string // categoryId
  onChange: (categoryId: string) => void
  categories: Record<string, { name: string; category_group_id: string | null; sort_order: number }>
  categoryGroups: { id: string; name: string; sort_order: number }[]
  placeholder?: string
  required?: boolean
  /** Show the special "No Category" option (for spend entries) */
  showNoCategoryOption?: boolean
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

  // Add special "No Category" option if enabled
  if (showNoCategoryOption) {
    categoryItems.unshift({
      id: NO_CATEGORY_ID,
      name: NO_CATEGORY_NAME,
      groupId: null,
      groupName: null,
      sortOrder: -1,
    })
  }

  // Get selected category name for display
  const isNoCategorySelected = value === NO_CATEGORY_ID
  const selectedCategory = isNoCategorySelected ? null : (value ? categories[value] : null)
  const displayValue = isNoCategorySelected ? NO_CATEGORY_NAME : (selectedCategory?.name || '')

  const [inputValue, setInputValue] = useState(displayValue)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input value when external value changes
  useEffect(() => {
    if (value === NO_CATEGORY_ID) {
      setInputValue(NO_CATEGORY_NAME)
    } else {
      const selectedCat = value ? categories[value] : null
      setInputValue(selectedCat?.name || '')
    }
  }, [value, categories])

  // Sort helper for categories
  const sortCategories = (items: CategoryItem[]) => {
    return items.sort((a, b) => {
      if (a.groupId !== b.groupId) {
        if (!a.groupId) return 1
        if (!b.groupId) return -1
        const nameCompare = (a.groupName || '').localeCompare(b.groupName || '')
        if (nameCompare !== 0) return nameCompare
        return a.groupId.localeCompare(b.groupId)
      }
      return a.sortOrder - b.sortOrder
    })
  }

  // Get filtered and sorted suggestions based on input
  const suggestions: CategoryItem[] = inputValue.trim()
    ? categoryItems
        .map(cat => ({
          ...cat,
          ...fuzzyMatch(inputValue, cat.name),
          groupMatch: cat.groupName ? fuzzyMatch(inputValue, cat.groupName) : { match: false, score: 0 },
        }))
        .filter(item => item.match || item.groupMatch.match)
        .sort((a, b) => {
          const scoreA = Math.max(a.score, a.groupMatch.score * 0.5)
          const scoreB = Math.max(b.score, b.groupMatch.score * 0.5)
          if (scoreB !== scoreA) return scoreB - scoreA
          if (a.groupId !== b.groupId) {
            if (!a.groupId) return 1
            if (!b.groupId) return -1
            const nameCompare = (a.groupName || '').localeCompare(b.groupName || '')
            if (nameCompare !== 0) return nameCompare
            return a.groupId.localeCompare(b.groupId)
          }
          return a.sortOrder - b.sortOrder
        })
        .slice(0, 10)
    : sortCategories([...categoryItems]).slice(0, 10)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        if (value === NO_CATEGORY_ID) {
          setInputValue(NO_CATEGORY_NAME)
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
        setInputValue(NO_CATEGORY_NAME)
      } else {
        const selectedCat = value ? categories[value] : null
        setInputValue(selectedCat?.name || '')
      }
    } else if (e.key === 'Tab') {
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
    if (newValue !== displayValue) {
      onChange('')
    }
  }

  function handleFocus() {
    setShowSuggestions(true)
    if (suggestions.length > 0) {
      setHighlightedIndex(0)
    }
  }

  // Group suggestions by category group for display
  const groupedSuggestions: { groupId: string | null; groupName: string | null; items: CategoryItem[] }[] = []
  let currentGroupId: string | null = '__initial__'
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
          borderColor: required && !value ? colors.error : undefined,
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '250px', overflowY: 'auto' }}>
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
        </div>
      )}
      {showSuggestions && suggestions.length === 0 && inputValue.trim() && (
        <div style={{
          ...dropdownContainerStyle,
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

