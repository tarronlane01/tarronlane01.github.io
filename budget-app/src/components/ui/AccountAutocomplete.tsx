/**
 * AccountAutocomplete - Fuzzy search for accounts with grouping
 *
 * Sorting matches the order used on the budget Accounts page:
 * - Groups sorted by sort_order
 * - Accounts sorted by sort_order within their group
 * - Ungrouped accounts appear at the end
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
import { NO_ACCOUNT_ID, NO_ACCOUNT_NAME } from '@data/constants'

// Account item uses the shared AutocompleteItem interface
type AccountItem = AutocompleteItem

interface AccountAutocompleteProps {
  id?: string
  value: string // accountId
  onChange: (accountId: string) => void
  accounts: [string, { nickname: string; account_group_id: string | null; sort_order: number; is_hidden?: boolean }][]
  accountGroups: Record<string, { name: string; sort_order: number }>
  placeholder?: string
  required?: boolean
  /** Show the special "No Account" option */
  showNoAccountOption?: boolean
  /** Include hidden accounts in the list (default: false) */
  showHiddenAccounts?: boolean
}

export function AccountAutocomplete({
  id,
  value,
  onChange,
  accounts,
  accountGroups,
  placeholder = 'Search accounts...',
  required,
  showNoAccountOption = false,
  showHiddenAccounts = false,
}: AccountAutocompleteProps) {
  // Filter out hidden accounts unless showHiddenAccounts is true
  const visibleAccounts = showHiddenAccounts
    ? accounts
    : accounts.filter(([, acc]) => !acc.is_hidden)

  // Build flat list of accounts with group info (excluding No Account - handled separately)
  const accountItems: AccountItem[] = visibleAccounts.map(([accId, acc]) => ({
    id: accId,
    name: acc.nickname,
    groupId: acc.account_group_id,
    groupName: acc.account_group_id ? accountGroups[acc.account_group_id]?.name || null : null,
    sortOrder: acc.sort_order,
    groupSortOrder: acc.account_group_id ? accountGroups[acc.account_group_id]?.sort_order ?? 999 : 999,
  }))

  // Get selected account name for display
  const isNoAccountSelected = value === NO_ACCOUNT_ID
  const selectedAccount = isNoAccountSelected ? null : accounts.find(([accId]) => accId === value)?.[1]
  // When "No Account" is selected, show empty input with placeholder instead
  const displayValue = isNoAccountSelected ? '' : (selectedAccount?.nickname || '')

  const [inputValue, setInputValue] = useState(displayValue)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input value when external value changes
  useEffect(() => {
    if (value === NO_ACCOUNT_ID) {
      setInputValue('')
    } else {
      const selectedAcc = accounts.find(([accId]) => accId === value)?.[1]
      setInputValue(selectedAcc?.nickname || '')
    }
  }, [value, accounts])

  // Get filtered and sorted suggestions using shared helper
  const suggestions: AccountItem[] = filterAndSortItems(
    accountItems,
    inputValue,
    (item) => [item.name, item.groupName || ''].filter(Boolean)
  )

  // Group suggestions for display using shared helper
  const groupedSuggestions = groupItemsForDisplay(suggestions)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        if (value === NO_ACCOUNT_ID) {
          setInputValue('')
        } else {
          const selectedAcc = accounts.find(([accId]) => accId === value)?.[1]
          setInputValue(selectedAcc?.nickname || '')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value, accounts])

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
        selectAccount(suggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      if (value === NO_ACCOUNT_ID) {
        setInputValue('')
      } else {
        const selectedAcc = accounts.find(([accId]) => accId === value)?.[1]
        setInputValue(selectedAcc?.nickname || '')
      }
    } else if (e.key === 'Tab') {
      if (showSuggestions && suggestions.length > 0) {
        const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0
        selectAccount(suggestions[indexToSelect])
      }
    }
  }

  function selectAccount(acc: AccountItem) {
    onChange(acc.id)
    setInputValue(acc.id === NO_ACCOUNT_ID ? '' : acc.name)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  function selectNoAccount() {
    onChange(NO_ACCOUNT_ID)
    setInputValue('')
    setShowSuggestions(false)
    setHighlightedIndex(-1)
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
      {showSuggestions && (
        <div style={{ ...dropdownContainerStyle, maxHeight: '250px', overflowY: 'auto' }}>
          {/* Always show No Account option at top when enabled */}
          {showNoAccountOption && (
            <div
              onClick={selectNoAccount}
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
              {NO_ACCOUNT_NAME}
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
              {group.items.map((acc) => {
                const idx = getFlatIndex()
                return (
                  <div
                    key={acc.id}
                    onClick={() => selectAccount(acc)}
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
                    {acc.name}
                  </div>
                )
              })}
            </div>
          ))}
          {suggestions.length === 0 && inputValue.trim() && !showNoAccountOption && (
            <div style={{ padding: '0.6rem 0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
              No matching accounts
            </div>
          )}
        </div>
      )}
    </div>
  )
}
